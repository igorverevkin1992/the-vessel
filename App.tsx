
import React, { useState, useCallback, useEffect, useReducer, useRef } from 'react';
import { AgentType, SystemState, INITIAL_STATE, ResearchDossier, HistoryItem, TopicSuggestion } from './types';
import { runDecoderAgent, runResearcherAgent, runArchitectAgent, runNarratorAgent, generateImageForBlock, runScoutAgent } from './services/geminiService';
import { saveRunToHistory, fetchHistory, deleteHistoryItem } from './services/supabaseClient';
import { APP_VERSION, MAX_LOG_ENTRIES, AGENT_MODELS } from './constants';
import { logger } from './services/logger';
import AgentLog from './components/AgentLog';
import ScriptDisplay from './components/ScriptDisplay';
import HistorySidebar from './components/HistorySidebar';
import RichTextDisplay from './components/RichTextDisplay';

// Icons
const ScoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>;
const DecoderIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
const ResearcherIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const ArchitectIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
const NarratorIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>;

// --- STATE REDUCER ---

type Action =
  | { type: 'SET_FIELD'; field: keyof SystemState; value: SystemState[keyof SystemState] }
  | { type: 'ADD_LOG'; message: string }
  | { type: 'MERGE'; partial: Partial<SystemState> }
  | { type: 'UPDATE_SCRIPT_IMAGE'; index: number; imageUrl: string }
  | { type: 'SET_HISTORY'; history: HistoryItem[] };

function stateReducer(state: SystemState, action: Action): SystemState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'ADD_LOG': {
      const logs = [...state.logs, action.message];
      return { ...state, logs: logs.length > MAX_LOG_ENTRIES ? logs.slice(-MAX_LOG_ENTRIES) : logs };
    }
    case 'MERGE':
      return { ...state, ...action.partial };
    case 'UPDATE_SCRIPT_IMAGE': {
      if (!state.finalScript) return state;
      const newScript = [...state.finalScript];
      newScript[action.index] = { ...newScript[action.index], imageUrl: action.imageUrl };
      return { ...state, finalScript: newScript };
    }
    case 'SET_HISTORY':
      return { ...state, history: action.history };
    default:
      return state;
  }
}

// Helper to format Dossier Object to String
const formatDossierToString = (d: ResearchDossier): string => {
  let output = `TOPIC: ${d.topic}\n\n`;

  output += `/// OFFICIAL NARRATIVE (WHAT THEY SAY)\n`;
  d.officialNarrative.forEach(c => output += `- ${c}\n`);
  output += `\n`;

  output += `/// DECODED REALITY (WHAT THE LENS REVEALS)\n`;
  d.decodedReality.forEach(c => output += `- ${c}\n`);
  output += `\n`;

  output += `/// CULTURAL ANCHORS (FILM / BOOK / SHOW REFERENCES)\n`;
  d.culturalAnchors.forEach(c => output += `- ${c}\n`);
  output += `\n`;

  output += `/// HARD DATA POINTS\n`;
  d.dataPoints.forEach(dp => output += `- **${dp.label}**: ${dp.value}\n`);
  output += `\n`;

  output += `/// VISUAL ANCHORS (PHYSICAL EVIDENCE)\n`;
  d.visualAnchors.forEach(a => output += `- ${a}\n`);

  return output;
};

function App() {
  const [state, dispatch] = useReducer(stateReducer, INITIAL_STATE);
  const [editedDecoder, setEditedDecoder] = useState('');
  const [editedDossier, setEditedDossier] = useState('');
  const [editedStructure, setEditedStructure] = useState('');

  const stateRef = useRef(state);
  stateRef.current = state;

  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((msg: string) => {
    dispatch({ type: 'ADD_LOG', message: msg });
  }, []);

  // Load History on Mount
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const history = await fetchHistory();
        if (!cancelled) {
          dispatch({ type: 'SET_HISTORY', history });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to load history', message);
        if (!cancelled) {
          addLog(`ERROR: Could not load history: ${message}`);
        }
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [addLog]);

  // --- EXECUTION FUNCTIONS ---

  const cancelCurrentOperation = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const executeScout = async () => {
    cancelCurrentOperation();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'MERGE', partial: { isProcessing: true, stepStatus: 'PROCESSING', currentAgent: AgentType.SCOUT, scoutSuggestions: undefined } });
    addLog(`>>> ACTIVATING THE SCOUT: SCANNING NARRATIVE LANDSCAPE...`);

    try {
      const suggestions = await runScoutAgent();
      if (controller.signal.aborted) return;

      addLog(`>>> SCOUT REPORT: ${suggestions.length} NARRATIVES IDENTIFIED.`);
      dispatch({ type: 'MERGE', partial: { scoutSuggestions: suggestions, isProcessing: false, stepStatus: 'IDLE' } });
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      addLog(`ERROR: ${message}`);
      dispatch({ type: 'MERGE', partial: { isProcessing: false, stepStatus: 'IDLE' } });
    }
  };

  const handleSelectTopic = (suggestion: TopicSuggestion) => {
    addLog(`>>> NARRATIVE SELECTED: ${suggestion.title}`);
    dispatch({ type: 'MERGE', partial: { topic: suggestion.title, currentAgent: 'IDLE' } });
    executeDecoder(suggestion.title);
  };

  const executeDecoder = async (overrideTopic?: string) => {
    const activeTopic = overrideTopic || stateRef.current.topic;

    if (!activeTopic.trim()) {
      addLog("ERROR: No subject to decode.");
      return;
    }

    cancelCurrentOperation();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'MERGE', partial: { topic: activeTopic, isProcessing: true, stepStatus: 'PROCESSING', currentAgent: AgentType.DECODER } });
    addLog(`>>> ACTIVATING THE DECODER: APPLYING CINEMA LENS...`);

    try {
      const decoderOutput = await runDecoderAgent(activeTopic);
      if (controller.signal.aborted) return;

      addLog(">>> NARRATIVE DECODED.");

      const isSteppable = stateRef.current.isSteppable;
      dispatch({ type: 'MERGE', partial: {
        decoderOutput,
        isProcessing: !isSteppable,
        stepStatus: isSteppable ? 'WAITING_FOR_APPROVAL' : 'PROCESSING'
      }});
      setEditedDecoder(decoderOutput);

      if (!isSteppable) executeResearcher(decoderOutput);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      addLog(`ERROR: ${message}`);
      dispatch({ type: 'MERGE', partial: { isProcessing: false, stepStatus: 'IDLE' } });
    }
  };

  const executeResearcher = async (inputDecoder: string) => {
    cancelCurrentOperation();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'MERGE', partial: {
      decoderOutput: inputDecoder,
      currentAgent: AgentType.RESEARCHER,
      isProcessing: true,
      stepStatus: 'PROCESSING'
    }});
    addLog(">>> ACTIVATING THE RESEARCHER: DEEP INVESTIGATION (Google Grounding)...");

    try {
      const dossier = await runResearcherAgent(stateRef.current.topic, inputDecoder);
      if (controller.signal.aborted) return;

      addLog(">>> INVESTIGATION DOSSIER COMPILED.");
      const readableDossier = formatDossierToString(dossier);

      const isSteppable = stateRef.current.isSteppable;
      dispatch({ type: 'MERGE', partial: {
        researchDossier: readableDossier,
        isProcessing: !isSteppable,
        stepStatus: isSteppable ? 'WAITING_FOR_APPROVAL' : 'PROCESSING'
      }});
      setEditedDossier(readableDossier);

      if (!isSteppable) executeArchitect(readableDossier);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      addLog(`ERROR: ${message}`);
      dispatch({ type: 'MERGE', partial: { isProcessing: false, stepStatus: 'IDLE' } });
    }
  };

  const executeArchitect = async (inputDossier: ResearchDossier | string) => {
    cancelCurrentOperation();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'MERGE', partial: {
      researchDossier: inputDossier,
      currentAgent: AgentType.ARCHITECT,
      isProcessing: true,
      stepStatus: 'PROCESSING'
    }});
    addLog(">>> ACTIVATING THE ARCHITECT: BUILDING NARRATIVE STRUCTURE...");

    try {
      const structure = await runArchitectAgent(inputDossier);
      if (controller.signal.aborted) return;

      addLog(">>> STRUCTURE LOCKED.");

      const isSteppable = stateRef.current.isSteppable;
      dispatch({ type: 'MERGE', partial: {
        structureMap: structure,
        isProcessing: !isSteppable,
        stepStatus: isSteppable ? 'WAITING_FOR_APPROVAL' : 'PROCESSING'
      }});
      setEditedStructure(structure);

      if (!isSteppable) executeNarrator(structure, inputDossier);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      addLog(`ERROR: ${message}`);
      dispatch({ type: 'MERGE', partial: { isProcessing: false, stepStatus: 'IDLE' } });
    }
  };

  const executeNarrator = async (inputStructure: string, inputDossier: ResearchDossier | string) => {
    cancelCurrentOperation();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'MERGE', partial: {
      structureMap: inputStructure,
      currentAgent: AgentType.NARRATOR,
      isProcessing: true,
      stepStatus: 'PROCESSING'
    }});
    addLog(">>> ACTIVATING THE NARRATOR: WRITING SCRIPT...");

    try {
      const script = await runNarratorAgent(inputStructure, inputDossier);
      if (controller.signal.aborted) return;

      addLog(">>> SCRIPT GENERATED.");

      const savedEntry = await saveRunToHistory(stateRef.current.topic, AGENT_MODELS.NARRATOR, script);
      if (controller.signal.aborted) return;

      const newHistory = savedEntry ? [savedEntry, ...stateRef.current.history] : stateRef.current.history;

      dispatch({ type: 'MERGE', partial: {
        currentAgent: AgentType.COMPLETED,
        finalScript: script,
        isProcessing: false,
        stepStatus: 'IDLE',
        history: newHistory
      }});
      addLog(">>> INVESTIGATION COMPLETE. SYSTEM STANDBY.");
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      addLog(`ERROR: ${message}`);
      dispatch({ type: 'MERGE', partial: { isProcessing: false, stepStatus: 'IDLE' } });
    }
  };

  // --- HANDLERS FOR STEPPABLE UI ---

  const handleApproveDecoder = () => {
    executeResearcher(editedDecoder);
  };

  const handleApproveResearcher = () => {
    executeArchitect(editedDossier);
  };

  const handleApproveArchitect = () => {
    if (state.researchDossier) {
      executeNarrator(editedStructure, state.researchDossier);
    }
  };

  const handleImageGen = async (index: number) => {
    if (!state.finalScript) return;

    const blockPrompt = state.finalScript[index].visualCue;
    addLog(`>>> GENERATING STORYBOARD FOR BLOCK ${index}...`);

    const imageUrl = await generateImageForBlock(blockPrompt);

    if (imageUrl) {
      dispatch({ type: 'UPDATE_SCRIPT_IMAGE', index, imageUrl });
      addLog(`>>> STORYBOARD GENERATED FOR BLOCK ${index}.`);
    } else {
      addLog(`>>> FAILED TO GENERATE STORYBOARD FOR BLOCK ${index}.`);
    }
  };

  // --- HISTORY & UI HELPERS ---

  const loadFromHistory = (item: HistoryItem) => {
    dispatch({ type: 'MERGE', partial: {
      topic: item.topic,
      finalScript: item.script,
      currentAgent: AgentType.COMPLETED,
      researchDossier: undefined,
      decoderOutput: undefined,
      scoutSuggestions: undefined,
      showHistory: false,
    }});
    addLog(`>>> LOADED ARCHIVE ID: ${item.id} [${item.topic}]`);
  };

  const handleDeleteHistory = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const previousHistory = state.history;
    dispatch({ type: 'SET_HISTORY', history: state.history.filter(item => item.id !== id) });
    const success = await deleteHistoryItem(id);
    if (success) {
      addLog(`>>> ARCHIVE ID ${id} DELETED PERMANENTLY.`);
    } else {
      dispatch({ type: 'SET_HISTORY', history: previousHistory });
      addLog(`>>> ERROR: COULD NOT DELETE ARCHIVE ID ${id}.`);
    }
  };

  const Steps = [
    { id: AgentType.SCOUT, label: "The Scout", icon: ScoutIcon, desc: "Narrative Landscape Scan" },
    { id: AgentType.DECODER, label: "The Decoder", icon: DecoderIcon, desc: "Cinema Lens Analysis" },
    { id: AgentType.RESEARCHER, label: "The Researcher", icon: ResearcherIcon, desc: "Deep Investigation" },
    { id: AgentType.ARCHITECT, label: "The Architect", icon: ArchitectIcon, desc: "Structure Blueprint" },
    { id: AgentType.NARRATOR, label: "The Narrator", icon: NarratorIcon, desc: "Script Writing" },
  ];

  return (
    <div className="min-h-screen bg-tv-black text-slate-300 font-sans selection:bg-tv-amber selection:text-black">
      {/* Header */}
      <header className="border-b border-tv-slate/30 bg-black/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-tv-amber rounded-full animate-pulse shadow-[0_0_10px_#d4a017]" />
            <h1 className="text-xl font-bold tracking-widest text-white">
              THE VESSEL<span className="text-tv-amber">.CORE</span> <span className="text-xs text-tv-slate ml-2 font-mono border border-tv-slate/50 px-1 rounded">V{APP_VERSION}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <button
              onClick={() => dispatch({ type: 'SET_FIELD', field: 'showHistory', value: true })}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-tv-slate hover:text-tv-amber transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>
              Archives ({state.history.length})
            </button>
            <div className="font-mono text-xs text-tv-slate hidden sm:block border-l border-tv-slate/30 pl-4">
              STATUS: {state.isProcessing ? 'DECODING' : state.stepStatus === 'WAITING_FOR_APPROVAL' ? 'AWAITING' : 'STANDBY'}
            </div>
          </div>
        </div>
      </header>

      <HistorySidebar
        history={state.history}
        isOpen={state.showHistory}
        onClose={() => dispatch({ type: 'SET_FIELD', field: 'showHistory', value: false })}
        onSelect={loadFromHistory}
        onDelete={handleDeleteHistory}
      />

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative">

        {/* Left Column: Controls & Status - Sticky */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 h-fit">

          <div className="bg-tv-gray/30 p-6 rounded-lg border border-tv-slate/30 backdrop-blur-sm">
            <div className="mb-4">
              <label className="block text-xs font-bold text-tv-slate uppercase mb-2 tracking-wider">Agent Models</label>
              <div className="bg-black border border-tv-slate/50 rounded p-3 font-mono text-[11px] space-y-1">
                <div className="flex justify-between"><span className="text-tv-slate">Scout / Decoder / Architect</span><span className="text-green-400">Flash</span></div>
                <div className="flex justify-between"><span className="text-tv-slate">Researcher / Narrator</span><span className="text-purple-400">Pro</span></div>
              </div>
            </div>

            <label className="block text-xs font-bold text-tv-amber uppercase mb-2 tracking-wider">Subject to Decode</label>
            <div className="flex gap-2">
                <input
                  type="text"
                  value={state.topic}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'topic', value: e.target.value })}
                  placeholder="Enter narrative to decode..."
                  className="w-full bg-black border border-tv-slate/50 rounded p-3 text-white focus:border-tv-amber focus:ring-1 focus:ring-tv-amber outline-none transition-all placeholder:text-tv-slate/50 font-mono"
                  disabled={state.isProcessing || state.stepStatus !== 'IDLE'}
                />
            </div>

            <div className="mt-4 flex flex-col gap-2">
               {/* SCOUT BUTTON */}
               <button
                  onClick={executeScout}
                  disabled={state.isProcessing || (state.currentAgent !== 'IDLE' && state.currentAgent !== AgentType.COMPLETED)}
                  className={`w-full py-3 px-4 rounded font-bold uppercase tracking-widest transition-all border border-tv-amber/50 text-tv-amber hover:bg-tv-amber hover:text-black flex items-center justify-center gap-2 ${
                    state.isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
               >
                  <ScoutIcon />
                  SCAN NARRATIVES (IDEAS)
               </button>

               {/* MANUAL START BUTTON */}
               <button
                  onClick={() => executeDecoder()}
                  disabled={state.isProcessing || !state.topic || (state.currentAgent !== 'IDLE' && state.currentAgent !== AgentType.COMPLETED)}
                  className={`w-full py-3 px-4 rounded font-bold uppercase tracking-widest transition-all ${
                    state.isProcessing || (state.currentAgent !== 'IDLE' && state.currentAgent !== AgentType.COMPLETED)
                      ? 'bg-tv-slate/20 text-tv-slate cursor-not-allowed'
                      : 'bg-tv-amber hover:bg-amber-600 text-black shadow-[0_0_15px_rgba(212,160,23,0.4)]'
                  }`}
                >
                  {state.isProcessing ? 'Decoding...' : 'Decode Narrative (Manual Topic)'}
                </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
               <div
                 onClick={() => !state.isProcessing && dispatch({ type: 'SET_FIELD', field: 'isSteppable', value: !state.isSteppable })}
                 className={`cursor-pointer flex items-center gap-2 px-3 py-2 rounded border transition-all ${state.isSteppable ? 'border-tv-amber bg-tv-amber/10 text-white' : 'border-tv-slate/50 text-tv-slate'}`}
               >
                 <div className={`w-3 h-3 rounded-full ${state.isSteppable ? 'bg-tv-amber' : 'bg-tv-slate'}`} />
                 <span className="text-xs font-bold uppercase tracking-wider">Steppable Mode</span>
               </div>
            </div>

          </div>

          <div className="space-y-2">
             <h3 className="text-xs font-bold text-tv-slate uppercase tracking-wider pl-1">Chain of Agents</h3>
             {Steps.map((step) => {
               const isActive = state.currentAgent === step.id;
               const agentOrder = [AgentType.SCOUT, AgentType.DECODER, AgentType.RESEARCHER, AgentType.ARCHITECT, AgentType.NARRATOR, AgentType.COMPLETED];
               const currentIdx = state.currentAgent === 'IDLE' ? -1 : agentOrder.indexOf(state.currentAgent);
               const thisIdx = agentOrder.indexOf(step.id);
               const isPast = currentIdx > thisIdx;

               return (
                 <div key={step.id} className={`flex items-center gap-4 p-4 rounded border transition-all ${isActive ? 'bg-tv-amber/10 border-tv-amber text-white' : isPast ? 'bg-tv-gray/20 border-tv-slate/30 text-green-500' : 'bg-transparent border-transparent text-tv-slate opacity-50'}`}>
                   <step.icon />
                   <div>
                     <div className="font-bold text-sm uppercase">{step.label}</div>
                     <div className="text-xs font-mono opacity-70">{step.desc}</div>
                   </div>
                   {isActive && <div className="ml-auto w-2 h-2 bg-tv-amber rounded-full animate-ping" />}
                   {isPast && <div className="ml-auto text-green-500 text-xs font-mono">[OK]</div>}
                 </div>
               );
             })}
          </div>
          <AgentLog logs={state.logs} />
        </div>

        {/* Right Column: Output Visualization */}
        <div className="lg:col-span-8 space-y-6">

          {/* Empty State */}
          {!state.currentAgent && !state.finalScript && !state.scoutSuggestions && state.currentAgent === 'IDLE' && (
             <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-tv-slate/20 rounded-lg p-12 text-center opacity-50">
               <div className="text-6xl mb-4">&#x1F50D;</div>
               <h2 className="text-2xl font-bold mb-2">Awaiting Subject</h2>
               <p className="max-w-md mx-auto">Click &ldquo;SCAN NARRATIVES&rdquo; to discover stories to decode, or enter a subject manually. Decoding Narratives.</p>
             </div>
          )}

          {/* SCOUT OUTPUT */}
          {(state.currentAgent === AgentType.SCOUT || state.scoutSuggestions) && state.scoutSuggestions && (
            <div className={`bg-tv-gray/20 p-6 rounded border ${state.currentAgent === AgentType.SCOUT ? 'border-tv-amber shadow-[0_0_15px_rgba(212,160,23,0.2)]' : 'border-tv-slate/30'}`}>
               <h4 className="text-tv-amber font-mono text-xs mb-4">/// SCOUT_NARRATIVE_REPORT (SELECT ONE)</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {state.scoutSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectTopic(suggestion)}
                      className="bg-black/50 border border-tv-slate/50 p-4 rounded cursor-pointer hover:border-tv-amber hover:bg-tv-amber/10 transition-all group"
                    >
                      <h3 className="font-bold text-white mb-2 group-hover:text-tv-amber">{suggestion.title}</h3>
                      <p className="text-xs text-gray-400 mb-2">{suggestion.hook}</p>
                      <div className="text-[10px] uppercase font-bold text-tv-slate border-t border-tv-slate/20 pt-2 mt-2">
                        Narrative Lens: {suggestion.narrativeLens}
                      </div>
                    </div>
                 ))}
               </div>
            </div>
          )}

          {/* STEP 1: DECODER OUTPUT */}
          {(state.currentAgent === AgentType.DECODER || state.decoderOutput) && state.decoderOutput && (
            <div className={`bg-tv-gray/20 p-6 rounded border ${state.currentAgent === AgentType.DECODER ? 'border-tv-amber shadow-[0_0_15px_rgba(212,160,23,0.2)]' : 'border-tv-slate/30'}`}>
               <h4 className="text-tv-amber font-mono text-xs mb-2">/// DECODER_NARRATIVE_ANALYSIS</h4>
               {state.stepStatus === 'WAITING_FOR_APPROVAL' && state.currentAgent === AgentType.DECODER ? (
                 <div>
                   <textarea
                      value={editedDecoder}
                      onChange={(e) => setEditedDecoder(e.target.value)}
                      className="w-full h-48 bg-black border border-tv-amber/50 text-gray-300 font-mono text-sm p-4 focus:outline-none"
                   />
                   <div className="mt-4 flex justify-end">
                     <button onClick={handleApproveDecoder} className="bg-tv-amber text-black px-6 py-2 rounded font-bold uppercase tracking-wider text-xs hover:bg-amber-500">
                       Approve &amp; Run Researcher &rarr;
                     </button>
                   </div>
                 </div>
               ) : (
                  <RichTextDisplay content={state.decoderOutput} />
               )}
            </div>
          )}

          {/* STEP 2: RESEARCHER OUTPUT */}
          {(state.currentAgent === AgentType.RESEARCHER || state.researchDossier) && state.researchDossier && (
             <div className={`bg-tv-gray/20 p-6 rounded border ${state.currentAgent === AgentType.RESEARCHER ? 'border-tv-amber shadow-[0_0_15px_rgba(212,160,23,0.2)]' : 'border-tv-slate/30'}`}>
                <h4 className="text-blue-400 font-mono text-xs mb-2">/// RESEARCHER_DOSSIER</h4>
                {state.stepStatus === 'WAITING_FOR_APPROVAL' && state.currentAgent === AgentType.RESEARCHER ? (
                   <div>
                     <textarea
                        value={editedDossier}
                        onChange={(e) => setEditedDossier(e.target.value)}
                        className="w-full h-96 bg-black border border-blue-500/50 text-blue-100 font-mono text-sm p-4 focus:outline-none leading-relaxed"
                     />
                     <div className="mt-4 flex justify-end">
                       <button onClick={handleApproveResearcher} className="bg-tv-amber text-black px-6 py-2 rounded font-bold uppercase tracking-wider text-xs hover:bg-amber-500">
                         Approve &amp; Run Architect &rarr;
                       </button>
                     </div>
                   </div>
                ) : (
                   <RichTextDisplay content={typeof state.researchDossier === 'string' ? state.researchDossier : formatDossierToString(state.researchDossier)} />
                )}
             </div>
          )}

          {/* STEP 3: ARCHITECT OUTPUT */}
          {(state.currentAgent === AgentType.ARCHITECT || state.structureMap) && state.structureMap && (
             <div className={`bg-tv-gray/20 p-6 rounded border ${state.currentAgent === AgentType.ARCHITECT ? 'border-tv-amber shadow-[0_0_15px_rgba(212,160,23,0.2)]' : 'border-tv-slate/30'}`}>
                <h4 className="text-green-500 font-mono text-xs mb-2">/// ARCHITECT_BLUEPRINT</h4>
                {state.stepStatus === 'WAITING_FOR_APPROVAL' && state.currentAgent === AgentType.ARCHITECT ? (
                   <div>
                     <textarea
                        value={editedStructure}
                        onChange={(e) => setEditedStructure(e.target.value)}
                        className="w-full h-96 bg-black border border-green-500/50 text-green-100 font-mono text-sm p-4 focus:outline-none leading-relaxed"
                     />
                     <div className="mt-4 flex justify-end">
                       <button onClick={handleApproveArchitect} className="bg-tv-amber text-black px-6 py-2 rounded font-bold uppercase tracking-wider text-xs hover:bg-amber-500">
                         Approve &amp; Run Narrator &rarr;
                       </button>
                     </div>
                   </div>
                ) : (
                   <RichTextDisplay content={state.structureMap} />
                )}
             </div>
          )}

          {state.finalScript && <ScriptDisplay
            script={state.finalScript}
            topic={state.topic}
            decoderContent={state.decoderOutput}
            researcherContent={typeof state.researchDossier === 'string' ? state.researchDossier : (state.researchDossier ? formatDossierToString(state.researchDossier) : undefined)}
            architectContent={state.structureMap}
            onGenerateImage={handleImageGen}
          />}
        </div>
      </main>
    </div>
  );
}

export default App;
