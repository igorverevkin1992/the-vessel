
export enum AgentType {
  SCOUT = 'SCOUT',
  DECODER = 'DECODER',
  RESEARCHER = 'RESEARCHER',
  ARCHITECT = 'ARCHITECT',
  NARRATOR = 'NARRATOR',
  COMPLETED = 'COMPLETED'
}

export interface DataPoint {
  label: string;
  value: string;
}

export interface TopicSuggestion {
  title: string;
  hook: string;
  narrativeLens: string;
}

export interface ResearchDossier {
  topic: string;
  officialNarrative: string[];
  decodedReality: string[];
  culturalAnchors: string[];
  visualAnchors: string[];
  dataPoints: DataPoint[];
}

export interface ScriptBlock {
  timecode: string;
  visualCue: string;
  audioScript: string;
  russianScript: string;
  blockType: 'INTRO' | 'BODY' | 'TRANSITION' | 'SALES' | 'OUTRO';
  imageUrl?: string;
}

export interface HistoryItem {
  id: number;
  created_at: string;
  topic: string;
  model: string;
  script: ScriptBlock[];
}

export interface SystemState {
  currentAgent: AgentType | 'IDLE';
  topic: string;
  isProcessing: boolean;
  logs: string[];

  // Execution Mode
  isSteppable: boolean;
  stepStatus: 'IDLE' | 'WAITING_FOR_APPROVAL' | 'PROCESSING';

  // Agent Outputs
  scoutSuggestions?: TopicSuggestion[];
  decoderOutput?: string;
  researchDossier?: ResearchDossier | string;
  structureMap?: string;
  finalScript?: ScriptBlock[];

  // History
  history: HistoryItem[];
  showHistory: boolean;
}

export const INITIAL_STATE: SystemState = {
  currentAgent: 'IDLE',
  topic: '',
  isProcessing: false,
  isSteppable: false,
  stepStatus: 'IDLE',
  logs: ['> THE VESSEL.CORE INITIALIZED...', '> DECODING NARRATIVES. AWAITING SUBJECT...'],
  history: [],
  showHistory: false
};
