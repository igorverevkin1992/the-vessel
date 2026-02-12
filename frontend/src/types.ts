/**
 * Система типов для фронтенда «Умного блокбастера».
 * Зеркало Python agent_types.py + models.py
 */

// ---------------------------------------------------------------------------
// Типы агентов
// ---------------------------------------------------------------------------

export enum AgentType {
  SCOUT = "scout",
  RADAR = "radar",
  ANALYST = "analyst",
  ARCHITECT = "architect",
  WRITER = "writer",
  COMPLETED = "completed",
}

export enum StepStatus {
  IDLE = "idle",
  WAITING_FOR_APPROVAL = "waiting",
  PROCESSING = "processing",
}

// ---------------------------------------------------------------------------
// Перечисления из models.py
// ---------------------------------------------------------------------------

export enum DopamineLevel {
  STIMULATION = 1,
  CAPTIVATION = 2,
  ANTICIPATION = 3,
  VALIDATION = 4,
  AFFECTION = 5,
  REVELATION = 6,
}

export enum HookArchetype {
  INVESTIGATOR = "investigator",
  CONTRARIAN = "contrarian",
  MAGICIAN = "magician",
  FORTUNE_TELLER = "fortune_teller",
  EXPERIMENTER = "experimenter",
  TEACHER = "teacher",
}

export enum ContentType {
  INVESTIGATION = "investigation",
  EXPLAINER = "explainer",
  GEOPOLITICS = "geopolitics",
  BUSINESS = "business",
}

export enum SerratedPhase {
  HIGH_START = "high_start",
  CONTEXT_BRIDGE = "context_bridge",
  REHOOK = "rehook",
  INVESTIGATION = "investigation",
  SYNTHESIS = "synthesis",
}

export enum VisualType {
  BROLL = "b-roll",
  STOCK_FOOTAGE = "stock_footage",
  TEXT_OVERLAY = "text_overlay",
  MEME_REFERENCE = "meme_reference",
  SNAP_ZOOM = "snap_zoom",
  MAP = "map",
  DOCUMENT = "document",
  TALKING_HEAD = "talking_head",
}

// ---------------------------------------------------------------------------
// Структуры данных
// ---------------------------------------------------------------------------

export interface HookStep {
  name: string;
  goal: string;
  text: string;
  visual: string;
}

export interface Hook {
  archetype: HookArchetype;
  step1_anchor: HookStep;
  step2_interjection: HookStep;
  step3_snapback: HookStep;
}

export interface EvidenceLoop {
  context: string;
  deictic_driver: string;
  evidence: string;
  reveal: string;
  transition: string;
}

export interface ScriptBlock {
  phase: SerratedPhase;
  timecode_start: string;
  timecode_end: string;
  evidence_loops: EvidenceLoop[];
  rehook_text: string;
  intensity_pct: number;
}

export interface AVLine {
  timecode: string;
  audio_text: string;
  visual_description: string;
  visual_type: VisualType;
  sfx: string;
  music_mood: string;
}

export interface AVScript {
  title: string;
  promise: string;
  hook: Hook;
  blocks: ScriptBlock[];
  av_lines: AVLine[];
  total_duration_sec: number;
}

// ---------------------------------------------------------------------------
// Выходы агентов
// ---------------------------------------------------------------------------

export interface TopicSuggestion {
  title: string;
  hook_idea: string;
  content_type: ContentType;
  archetype: HookArchetype;
  viral_factor: string;
}

export interface RadarOutput {
  topic: string;
  viral_angles: string[];
  dopamine_hooks: string[];
  target_emotion: string;
  contrarian_take: string;
}

export interface ResearchDossier {
  topic: string;
  claims: string[];
  counter_claims: string[];
  visual_anchors: string[];
  data_points: Array<{ label: string; value: string }>;
  evidence_loops: EvidenceLoop[];
  villain: string;
  victim: string;
  shocking_artifact: string;
}

export interface StructureBlueprint {
  title: string;
  promise: string;
  hook: Hook;
  blocks: ScriptBlock[];
  thumbnail_concept: string;
  duration_min: number;
  but_therefore_chain: string;
}

export interface WriterOutput {
  script: AVScript;
  word_count: number;
  block_count: number;
}

// ---------------------------------------------------------------------------
// Состояние системы (аналог PipelineState)
// ---------------------------------------------------------------------------

export interface SystemState {
  currentAgent: AgentType | "idle";
  isProcessing: boolean;
  isSteppable: boolean;
  stepStatus: StepStatus;
  logs: string[];

  topic: string;
  contentType: ContentType | null;

  scoutSuggestions: TopicSuggestion[];
  radarOutput: RadarOutput | null;
  researchDossier: ResearchDossier | null;
  structureBlueprint: StructureBlueprint | null;
  writerOutput: WriterOutput | null;

  // Текстовые представления для отображения
  scoutText: string;
  radarText: string;
  analystText: string;
  architectText: string;
  writerText: string;

  error: string | null;
}

export const INITIAL_STATE: SystemState = {
  currentAgent: "idle",
  isProcessing: false,
  isSteppable: false,
  stepStatus: StepStatus.IDLE,
  logs: [],

  topic: "",
  contentType: null,

  scoutSuggestions: [],
  radarOutput: null,
  researchDossier: null,
  structureBlueprint: null,
  writerOutput: null,

  scoutText: "",
  radarText: "",
  analystText: "",
  architectText: "",
  writerText: "",

  error: null,
};

// ---------------------------------------------------------------------------
// История
// ---------------------------------------------------------------------------

export interface HistoryItem {
  id: string;
  timestamp: string;
  topic: string;
  state: SystemState;
}

// ---------------------------------------------------------------------------
// Конфигурация агентов конвейера
// ---------------------------------------------------------------------------

export const AGENT_PIPELINE_ORDER: AgentType[] = [
  AgentType.SCOUT,
  AgentType.RADAR,
  AgentType.ANALYST,
  AgentType.ARCHITECT,
  AgentType.WRITER,
];

export interface AgentMeta {
  nameRu: string;
  role: string;
  description: string;
  icon: string;
}

export const AGENT_DESCRIPTIONS: Record<string, AgentMeta> = {
  [AgentType.SCOUT]: {
    nameRu: "Скаут (Scout)",
    role: "Разведка тем",
    description:
      "Сканирует информационное поле и генерирует предложения тем для «Умного блокбастера» с указанием типа контента, архетипа хука и вирусного фактора.",
    icon: "🔭",
  },
  [AgentType.RADAR]: {
    nameRu: "Радар (Radar)",
    role: "Вирусные углы",
    description:
      "Анализирует тему через призму Дофаминовой лестницы и 4 вирусных триггеров. Определяет контрарный отскок и целевую эмоцию для максимального удержания.",
    icon: "📡",
  },
  [AgentType.ANALYST]: {
    nameRu: "Аналитик (Analyst)",
    role: "Факт-чекинг и визуальные якоря",
    description:
      "Формирует исследовательское досье: утверждения, 7+ визуальных якорей, Петли Доказательств, определяет Злодея и Жертву.",
    icon: "🔬",
  },
  [AgentType.ARCHITECT]: {
    nameRu: "Архитектор (Architect)",
    role: "Структура и хук",
    description:
      "Проектирует Зубчатую дугу, конструирует трёхшаговый хук по формуле синтеза, строит цепочку But/Therefore.",
    icon: "📐",
  },
  [AgentType.WRITER]: {
    nameRu: "Сценарист (Writer)",
    role: "Полный A/V сценарий",
    description:
      "Генерирует двухколоночный сценарий в стиле Стаккато с дейктическими драйверами, коннекторами Харриса, SFX и музыкой.",
    icon: "✍️",
  },
};
