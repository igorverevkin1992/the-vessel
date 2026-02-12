import { GoogleGenAI, Type } from "@google/genai";
import { AGENT_SCOUT_PROMPT, AGENT_A_PROMPT, AGENT_B_PROMPT, AGENT_C_PROMPT, AGENT_D_PROMPT, CHARS_PER_SECOND, MIN_BLOCK_DURATION_SEC, IMAGE_GEN_MODEL, IMAGE_GEN_PROMPT_PREFIX, API_RETRY_COUNT, API_RETRY_BASE_DELAY_MS, AGENT_MODELS } from "../constants";
import { ResearchDossier, ScriptBlock, TopicSuggestion } from "../types";
import { logger } from "./logger";

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Set GEMINI_API_KEY in .env");
  }
  return new GoogleGenAI({ apiKey });
};

// --- RETRY HELPER ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= API_RETRY_COUNT; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < API_RETRY_COUNT) {
        const waitMs = API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        logger.warn(`${label}: attempt ${attempt + 1} failed, retrying in ${waitMs}ms`, err);
        await delay(waitMs);
      }
    }
  }
  throw lastError;
}

// --- SAFE JSON PARSER ---

function safeJsonParse<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    logger.error(`${label}: Failed to parse JSON response`, { text: text.substring(0, 200), err });
    throw new Error(`${label}: Invalid JSON response from API`, { cause: err });
  }
}

// --- TIMING CALCULATION MODULE ---

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const numberToWords = (n: number): string => {
  if (n === 0) return 'zero';
  let str = '';

  if (n >= 1000000) {
      str += numberToWords(Math.floor(n / 1000000)) + ' million ';
      n %= 1000000;
  }
  if (n >= 1000) {
      str += numberToWords(Math.floor(n / 1000)) + ' thousand ';
      n %= 1000;
  }
  if (n >= 100) {
      str += ONES[Math.floor(n / 100)] + ' hundred ';
      n %= 100;
      if (n > 0) str += 'and ';
  }
  if (n >= 20) {
      str += TENS[Math.floor(n / 10)] + ' ';
      n %= 10;
  }
  if (n >= 10) {
      str += TEENS[n - 10] + ' ';
      n = 0;
  }
  if (n > 0) {
      str += ONES[n] + ' ';
  }
  return str.trim();
};

const expandTextForTiming = (text: string): string => {
  if (!text) return '';
  let s = text.toLowerCase().trim();

  s = s.replace(/\$([0-9,]+(?:\.[0-9]+)?)/g, (_match, p1) => {
     return p1 + ' us dollars';
  });
  s = s.replace(/([0-9,]+(?:\.[0-9]+)?)%/g, '$1 percent');
  s = s.replace(/\b(19|20)(\d{2})\b/g, (_match, p1, p2) => {
      return numberToWords(parseInt(p1)) + ' ' + numberToWords(parseInt(p2));
  });
  s = s.replace(/(\d+)\.(\d+)/g, (_match, p1, p2) => {
      return numberToWords(parseInt(p1.replace(/,/g, ''))) + ' point ' + numberToWords(parseInt(p2));
  });
  s = s.replace(/\d+/g, (match) => {
      return numberToWords(parseInt(match.replace(/,/g, '')));
  });
  s = s.replace(/[^a-z0-9\s]/g, '');

  return s.replace(/\s+/g, ' ').trim();
};

const calculateDurationAndRetiming = (script: ScriptBlock[]): ScriptBlock[] => {
  let runningTimeSeconds = 0;

  return script.map(block => {
    const spokenText = expandTextForTiming(block.audioScript);
    const charCount = spokenText.length;

    let duration = Math.ceil(charCount / CHARS_PER_SECOND);
    if (duration < MIN_BLOCK_DURATION_SEC) duration = MIN_BLOCK_DURATION_SEC;

    const startTotal = runningTimeSeconds;
    const endTotal = runningTimeSeconds + duration;
    runningTimeSeconds = endTotal;

    const formatTime = (totalSec: number) => {
        const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
        const sec = (totalSec % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    return {
      ...block,
      timecode: `${formatTime(startTotal)} - ${formatTime(endTotal)}`
    };
  });
};

// --- AGENT FUNCTIONS ---

const getToolsForModel = (model: string) => {
  if (model.includes('gemini-3')) {
    return [{ googleSearch: {} }];
  }
  return undefined;
};

export const runScoutAgent = async (): Promise<TopicSuggestion[]> => {
  const model = AGENT_MODELS.SCOUT;
  return withRetry(async () => {
    const ai = getClient();
    const tools = getToolsForModel(model);

    const response = await ai.models.generateContent({
      model,
      contents: AGENT_SCOUT_PROMPT,
      config: {
        tools,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              hook: { type: Type.STRING },
              viralFactor: { type: Type.STRING }
            },
            required: ["title", "hook", "viralFactor"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Scout returned empty intel.");
    return safeJsonParse<TopicSuggestion[]>(text, 'Scout');
  }, 'runScoutAgent');
};

export const runRadarAgent = async (topic: string): Promise<string> => {
  const model = AGENT_MODELS.RADAR;
  return withRetry(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model,
      contents: `ТЕМА: ${topic}\n\n${AGENT_A_PROMPT}`,
      config: { temperature: 0.7 }
    });
    return response.text || "Radar failed to acquire target.";
  }, 'runRadarAgent');
};

export const runAnalystAgent = async (topic: string, radarAnalysis: string): Promise<ResearchDossier> => {
  const model = AGENT_MODELS.ANALYST;
  return withRetry(async () => {
    const ai = getClient();
    const tools = getToolsForModel(model);

    const response = await ai.models.generateContent({
      model,
      contents: `ТЕМА: ${topic}\n\nАНАЛИЗ РАДАРА: ${radarAnalysis}\n\n${AGENT_B_PROMPT}`,
      config: {
        tools,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            claims: { type: Type.ARRAY, items: { type: Type.STRING } },
            counterClaims: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualAnchors: { type: Type.ARRAY, items: { type: Type.STRING } },
            dataPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING }
                },
                required: ["label", "value"]
              }
            }
          },
          required: ["topic", "claims", "counterClaims", "visualAnchors", "dataPoints"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Analyst returned empty data.");
    return safeJsonParse<ResearchDossier>(text, 'Analyst');
  }, 'runAnalystAgent');
};

export const runArchitectAgent = async (dossier: ResearchDossier | string): Promise<string> => {
  const model = AGENT_MODELS.ARCHITECT;
  return withRetry(async () => {
    const ai = getClient();
    const dossierStr = typeof dossier === 'string' ? dossier : JSON.stringify(dossier, null, 2);

    const response = await ai.models.generateContent({
      model,
      contents: `ДОСЬЕ: ${dossierStr}\n\n${AGENT_C_PROMPT}`,
    });
    return response.text || "Architect failed to build structure.";
  }, 'runArchitectAgent');
};

export const runWriterAgent = async (structure: string, dossier: ResearchDossier | string): Promise<ScriptBlock[]> => {
  const model = AGENT_MODELS.WRITER;
  return withRetry(async () => {
    const ai = getClient();
    const dossierStr = typeof dossier === 'string' ? dossier : JSON.stringify(dossier, null, 2);

    const thinkingConfig = (model.includes('gemini-3') || model.includes('gemini-2.5'))
      ? { thinkingBudget: 2048 }
      : undefined;

    const response = await ai.models.generateContentStream({
      model,
      contents: `ДОСЬЕ: ${dossierStr}\nСТРУКТУРА: ${structure}\n\n${AGENT_D_PROMPT}`,
      config: {
        responseMimeType: "application/json",
        thinkingConfig,
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              timecode: { type: Type.STRING },
              visualCue: { type: Type.STRING },
              audioScript: { type: Type.STRING },
              russianScript: { type: Type.STRING },
              blockType: { type: Type.STRING, enum: ['INTRO', 'BODY', 'TRANSITION', 'SALES', 'OUTRO'] }
            },
            required: ["timecode", "visualCue", "audioScript", "russianScript", "blockType"]
          }
        }
      }
    });

    let fullText = '';
    for await (const chunk of response) {
      const part = chunk.text;
      if (part) fullText += part;
    }

    if (!fullText) throw new Error("Writer returned empty script.");

    const rawScript = safeJsonParse<ScriptBlock[]>(fullText, 'Writer');
    return calculateDurationAndRetiming(rawScript);
  }, 'runWriterAgent');
};

export const generateImageForBlock = async (prompt: string): Promise<string | null> => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_GEN_MODEL,
      contents: `${IMAGE_GEN_PROMPT_PREFIX} ${prompt}`,
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("Image generation failed", { message, prompt: prompt.substring(0, 80) });
    return null;
  }
};
