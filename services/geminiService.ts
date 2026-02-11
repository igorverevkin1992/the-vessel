import { GoogleGenAI, Type } from "@google/genai";
import { AGENT_SCOUT_PROMPT, AGENT_A_PROMPT, AGENT_B_PROMPT, AGENT_C_PROMPT, AGENT_D_PROMPT, CHARS_PER_SECOND, MIN_BLOCK_DURATION_SEC, IMAGE_GEN_MODEL, IMAGE_GEN_PROMPT_PREFIX, API_RETRY_COUNT, API_RETRY_BASE_DELAY_MS, AGENT_MODELS } from "../constants";
import { ResearchDossier, ScriptBlock, TopicSuggestion } from "../types";
import { logger } from "./logger";

// Helper to ensure API key exists
const getClient = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set VITE_GOOGLE_API_KEY");
  }
  return new GoogleGenAI({ apiKey });
};

// --- STYLE RETRIEVAL HELPER ---
const BACKEND_URL = "http://localhost:8000";

async function fetchVesselStyle(topic: string): Promise<string> {
  try {
    logger.info(`Requesting Vessel style examples for topic: "${topic}"...`);
    const response = await fetch(`${BACKEND_URL}/api/get-vessel-style`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic })
    });

    if (response.ok) {
      const data = await response.json();
      logger.info("Style examples loaded from knowledge base.");
      return data.style_context || "";
    } else {
      logger.warn("Style backend returned error", { status: response.status });
      return "";
    }
  } catch (e) {
    logger.warn("Could not fetch style (backend offline?)", e);
    return "";
  }
}

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
              narrativeLens: { type: Type.STRING }
            },
            required: ["title", "hook", "narrativeLens"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Scout returned empty intel.");
    return safeJsonParse<TopicSuggestion[]>(text, 'Scout');
  }, 'runScoutAgent');
};

export const runDecoderAgent = async (topic: string): Promise<string> => {
  const model = AGENT_MODELS.DECODER;
  return withRetry(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model,
      contents: `TOPIC: ${topic}\n\n${AGENT_A_PROMPT}`,
      config: {
        temperature: 0.7,
      }
    });
    return response.text || "Decoder failed to find narrative pattern.";
  }, 'runDecoderAgent');
};

export const runResearcherAgent = async (topic: string, decoderAnalysis: string): Promise<ResearchDossier> => {
  const model = AGENT_MODELS.RESEARCHER;
  return withRetry(async () => {
    const ai = getClient();
    const tools = getToolsForModel(model);

    const response = await ai.models.generateContent({
      model,
      contents: `TOPIC: ${topic}\n\nDECODER ANALYSIS: ${decoderAnalysis}\n\n${AGENT_B_PROMPT}`,
      config: {
        tools,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING },
            officialNarrative: { type: Type.ARRAY, items: { type: Type.STRING } },
            decodedReality: { type: Type.ARRAY, items: { type: Type.STRING } },
            culturalAnchors: { type: Type.ARRAY, items: { type: Type.STRING } },
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
          required: ["topic", "officialNarrative", "decodedReality", "culturalAnchors", "visualAnchors", "dataPoints"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Researcher returned empty data.");
    return safeJsonParse<ResearchDossier>(text, 'Researcher');
  }, 'runResearcherAgent');
};

export const runArchitectAgent = async (dossier: ResearchDossier | string): Promise<string> => {
  const model = AGENT_MODELS.ARCHITECT;
  return withRetry(async () => {
    const ai = getClient();
    const dossierStr = typeof dossier === 'string' ? dossier : JSON.stringify(dossier, null, 2);

    const response = await ai.models.generateContent({
      model,
      contents: `DOSSIER: ${dossierStr}\n\n${AGENT_C_PROMPT}`,
    });
    return response.text || "Architect failed to build structure.";
  }, 'runArchitectAgent');
};

// Narrator uses streaming to prevent ERR_CONNECTION_CLOSED on large responses.
export const runNarratorAgent = async (structure: string, dossier: ResearchDossier | string): Promise<ScriptBlock[]> => {
  const model = AGENT_MODELS.NARRATOR;
  return withRetry(async () => {
    const ai = getClient();
    const dossierStr = typeof dossier === 'string' ? dossier : JSON.stringify(dossier, null, 2);

    // Extract topic and fetch style context
    let topicForStyle = "Narrative deconstruction";
    try {
        const dossierObj = typeof dossier === 'string' ? JSON.parse(dossier) : dossier;
        if (dossierObj.topic) topicForStyle = dossierObj.topic;
    } catch (_e) {
        logger.warn("Could not parse dossier topic for style fetch, using default.");
    }

    const styleContext = await fetchVesselStyle(topicForStyle);

    const enhancedPrompt = `
      ${AGENT_D_PROMPT}

      === STYLE REFERENCE: THE VESSEL VOICE ===
      Use the following real examples from reference transcripts to replicate the rhythm,
      vocabulary, visual storytelling, and investigative tone of THE VESSEL.
      Your script must sound EXACTLY like this.

      ${styleContext ? `STYLE EXAMPLES FOR THIS TOPIC:\n${styleContext}` : "No style examples found. Use the general Narrative Detective tone: cinematic, investigative, film-industry jargon, punchy, direct."}
      ======================================
    `;

    const thinkingConfig = (model.includes('gemini-3') || model.includes('gemini-2.5'))
      ? { thinkingBudget: 2048 }
      : undefined;

    const response = await ai.models.generateContentStream({
      model,
      contents: `DOSSIER: ${dossierStr}\nSTRUCTURE: ${structure}\n\n${enhancedPrompt}`,
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

    if (!fullText) throw new Error("Narrator returned empty script.");

    const rawScript = safeJsonParse<ScriptBlock[]>(fullText, 'Narrator');
    return calculateDurationAndRetiming(rawScript);
  }, 'runNarratorAgent');
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
