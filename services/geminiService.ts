/**
 * Gemini Service — calls the Python backend API.
 *
 * Backend: python main.py
 * Frontend proxies /api/* via Vite dev server.
 */

import { ResearchDossier, ScriptBlock, TopicSuggestion } from "../types";
import { logger } from "./logger";
import { CHARS_PER_SECOND, MIN_BLOCK_DURATION_SEC } from "../constants";

const API_BASE = "/api";

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

// --- HELPER ---

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

// --- AGENT FUNCTIONS ---

export const runScoutAgent = async (): Promise<TopicSuggestion[]> => {
  logger.info("Scout: calling backend...");
  return apiFetch<TopicSuggestion[]>(`${API_BASE}/scout`, { method: "POST" });
};

export const runRadarAgent = async (topic: string): Promise<string> => {
  logger.info("Radar: calling backend...");
  const data = await apiFetch<{ result: string }>(`${API_BASE}/radar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  return data.result;
};

export const runAnalystAgent = async (topic: string, radarAnalysis: string): Promise<ResearchDossier> => {
  logger.info("Analyst: calling backend...");
  return apiFetch<ResearchDossier>(`${API_BASE}/analyst`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, radarAnalysis }),
  });
};

export const runArchitectAgent = async (dossier: ResearchDossier | string): Promise<string> => {
  logger.info("Architect: calling backend...");
  const dossierStr = typeof dossier === "string" ? dossier : JSON.stringify(dossier, null, 2);
  const data = await apiFetch<{ result: string }>(`${API_BASE}/architect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dossier: dossierStr }),
  });
  return data.result;
};

export const runWriterAgent = async (structure: string, dossier: ResearchDossier | string): Promise<ScriptBlock[]> => {
  logger.info("Writer: calling backend...");
  const dossierStr = typeof dossier === "string" ? dossier : JSON.stringify(dossier, null, 2);
  const rawScript = await apiFetch<ScriptBlock[]>(`${API_BASE}/writer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ structure, dossier: dossierStr }),
  });
  return calculateDurationAndRetiming(rawScript);
};

export const generateImageForBlock = async (prompt: string): Promise<string | null> => {
  try {
    const data = await apiFetch<{ imageUrl: string | null }>(`${API_BASE}/generate-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    return data.imageUrl || null;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("Image generation failed", { message, prompt: prompt.substring(0, 80) });
    return null;
  }
};
