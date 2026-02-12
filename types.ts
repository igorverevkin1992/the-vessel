
export enum AgentType {
  SCOUT = 'SCOUT',
  RADAR = 'RADAR',
  ANALYST = 'ANALYST',
  ARCHITECT = 'ARCHITECT',
  WRITER = 'WRITER',
  COMPLETED = 'COMPLETED'
}

export interface DataPoint {
  label: string;
  value: string;
}

export interface TopicSuggestion {
  title: string;
  hook: string;
  viralFactor: string;
}

export interface ResearchDossier {
  topic: string;
  claims: string[];
  counterClaims: string[];
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

  isSteppable: boolean;
  stepStatus: 'IDLE' | 'WAITING_FOR_APPROVAL' | 'PROCESSING';

  scoutSuggestions?: TopicSuggestion[];
  radarOutput?: string;
  researchDossier?: ResearchDossier | string;
  structureMap?: string;
  finalScript?: ScriptBlock[];

  history: HistoryItem[];
  showHistory: boolean;
}

export const INITIAL_STATE: SystemState = {
  currentAgent: 'IDLE',
  topic: '',
  isProcessing: false,
  isSteppable: false,
  stepStatus: 'IDLE',
  logs: ['> SMART.BLOCKBUSTER INITIALIZED...', '> WAITING FOR TARGET VECTOR...'],
  history: [],
  showHistory: false
};
