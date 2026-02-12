// --- APP CONFIG ---
export const APP_VERSION = '1.0';

// --- PER-AGENT MODEL MAPPING (display only — backend handles actual calls) ---
export const AGENT_MODELS = {
  SCOUT:     'gemini-3-flash-preview',
  RADAR:     'gemini-3-flash-preview',
  ANALYST:   'gemini-3-pro-preview',
  ARCHITECT: 'gemini-3-flash-preview',
  WRITER:    'gemini-3-pro-preview',
} as const;

// --- TIMING CONFIG ---
export const CHARS_PER_SECOND = 12;
export const MIN_BLOCK_DURATION_SEC = 2;

// --- LOG CONFIG ---
export const MAX_LOG_ENTRIES = 500;
