// --- APP CONFIG ---
export const APP_VERSION = '1.0';

// --- PER-AGENT MODEL MAPPING (display only — backend handles actual calls) ---
export const AGENT_MODELS = {
  SCOUT:     'gemini-2.0-flash',
  RADAR:     'gemini-2.0-flash',
  ANALYST:   'gemini-2.0-flash',
  ARCHITECT: 'gemini-2.0-flash',
  WRITER:    'gemini-2.0-flash',
} as const;

// --- TIMING CONFIG ---
export const CHARS_PER_SECOND = 12;
export const MIN_BLOCK_DURATION_SEC = 2;

// --- LOG CONFIG ---
export const MAX_LOG_ENTRIES = 500;
