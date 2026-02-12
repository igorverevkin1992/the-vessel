
import React, { useState, useCallback, useEffect, useReducer, useRef } from 'react';
import { AgentType, SystemState, INITIAL_STATE, ResearchDossier, HistoryItem, TopicSuggestion } from './types';
import { runRadarAgent, runAnalystAgent, runArchitectAgent, runWriterAgent, generateImageForBlock, runScoutAgent } from './services/geminiService';
import { saveRunToHistory, fetchHistory, deleteHistoryItem } from './services/supabaseClient';
import { APP_VERSION, MAX_LOG_ENTRIES, AGENT_MODELS } from './constants';
import { logger } from './services/logger';
import AgentLog from './components/AgentLog';
import ScriptDisplay from './components/ScriptDisplay';
import HistorySidebar from './components/HistorySidebar';
import RichTextDisplay from './components/RichTextDisplay';

// Icons
const ScoutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>;
const RadarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2"/><path d="M12 22v-2"/><path d="m17 20.66-1-1.73"/><path d="M11 10.27a2 2 0 0 0 2.73 0"/><path d="m20.66 17-1.73-1"/><path d="m3.34 17 1.73-1"/><path d="m14 12 2.55-2.55"/><path d="M8.51 12.28 6 15"/></svg>;
const AnalystIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const ArchitectIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>;
const WriterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>;

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

// Helper to formatting Dossier Object to String
const formatDossierToString = (d: ResearchDossier): string => {
  let output = `TOPIC: ${d.topic}\n\n`;

  output += `/// WESTERN MEDIA NARRATIVES\n`;
  d.claims.forEach(c => output += `- ${c}\n`);
  output += `\n`;

  output += `/// GLOBAL SOUTH / BRICS REALITY\n`;
  d.counterClaims.forEach(c => output += `- ${c}\n`);
  output += `\n`;

  output += `/// HARD DATA POINTS\n`;
  d.dataPoints.forEach(dp => output += `- **${dp.label}**: ${dp.value}\n`);
  output += `\n`;

  output += `/// VISUAL ANCHORS (PHYSICAL PROOF)\n`;
  d.visualAnchors.forEach(a => output += `- ${a}\n`);

  return output;
};

function App() {
  const [state, dispatch] = useReducer(stateReducer, INITIAL_STATE);
  const [editedRadar, setEditedRadar] = useState('');
  const [editedDossier, setEditedDossier] = useState('');
  const [editedStructure, setEditedStructure] = useState('');

  // Ref for the latest state to avoid stale closures in async chains
  const stateRef = useRef(state);
  stateRef.current = state;

  // AbortController ref for cancelling in-flight agent operations
  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((msg: string) => {
    dispatch({ type: 'ADD_LOG', message: msg });
  }, []);

  // Load History on Mount with error handling
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
    addLog(`>>> ACTIVATING AGENT S: THE SCOUT (Google Search)...`);

    try {
      const suggestions = await runScoutAgent();
      if (controller.signal.aborted) return;

      addLog(`>>> SCOUT REPORT: ${suggestions.length} TARGETS IDENTIFIED.`);
      dispatch({ type: 'MERGE', partial: { scoutSuggestions: suggestions, isProcessing: false, stepStatus: 'IDLE' } });
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      addLog(`ERROR: ${message}`);
      dispatch({ type: 'MERGE', partial: { isProcessing: false, stepStatus: 'IDLE' } });
    }
  };

  const handleSelectTopic = (suggestion: TopicSuggestion) => {
    addLog(`>>> TARGET CONFIRMED: ${suggestion.title}`);
    dispatch({ type: 'MERGE', partial: { topic: suggestion.title, currentAgent: 'IDLE' } });
    executeRadar(suggestion.title);
  };

  const executeRadar = async (overrideTopic?: string) => {
    const activeTopic = overrideTopic || stateRef.current.topic;

    if (!activeTopic.trim()) {
      addLog("ERROR: No Target Vector.");
      return;
    }

    cancelCurrentOperation();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'MERGE', partial: { topic: activeTopic, isProcessing: true, stepStatus: 'PROCESSING', currentAgent: AgentType.RADAR } });
    addLog(`>>> ACTIVATING AGENT A: THE RADAR...`);

    try {
      const radarOutput = await runRadarAgent(activeTopic);
      if (controller.signal.aborted) return;

      addLog(">>> RADAR SCAN COMPLETE.");

      const isSteppable = stateRef.current.isSteppable;
      dispatch({ type: 'MERGE', partial: {
        radarOutput,
        isProcessing: !isSteppable,
        stepStatus: isSteppable ? 'WAITING_FOR_APPROVAL' : 'PROCESSING'
      }});
      setEditedRadar(radarOutput);

      if (!isSteppable) executeAnalyst(radarOutput);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      addLog(`ERROR: ${message}`);
      dispatch({ type: 'MERGE', partial: { isProcessing: false, stepStatus: 'IDLE' } });
    }
  };

  const executeAnalyst = async (inputRadar: string) => {
    cancelCurrentOperation();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'MERGE', partial: {
      radarOutput: inputRadar,
      currentAgent: AgentType.ANALYST,
      isProcessing: true,
      stepStatus: 'PROCESSING'
    }});
    addLog(">>> ACTIVATING AGENT B: THE ANALYST (Google Grounding)...");

    try {
      const dossier = await runAnalystAgent(stateRef.current.topic, inputRadar);
      if (controller.signal.aborted) return;

      addLog(">>> DOSSIER COMPILED.");
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
    addLog(">>> ACTIVATING AGENT C: THE ARCHITECT...");

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

      if (!isSteppable) executeWriter(structure, inputDossier);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      addLog(`ERROR: ${message}`);
      dispatch({ type: 'MERGE', partial: { isProcessing: false, stepStatus: 'IDLE' } });
    }
  };

  const executeWriter = async (inputStructure: string, inputDossier: ResearchDossier | string) => {
    cancelCurrentOperation();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'MERGE', partial: {
      structureMap: inputStructure,
      currentAgent: AgentType.WRITER,
      isProcessing: true,
      stepStatus: 'PROCESSING'
    }});
    addLog(">>> ACTIVATING AGENT D: THE WRITER...");

    try {
      const script = await runWriterAgent(inputStructure, inputDossier);
      if (controller.signal.aborted) return;

      addLog(">>> SCRIPT GENERATED.");

      const savedEntry = await saveRunToHistory(stateRef.current.topic, AGENT_MODELS.WRITER, script);
      if (controller.signal.aborted) return;

      const newHistory = savedEntry ? [savedEntry, ...stateRef.current.history] : stateRef.current.history;

      dispatch({ type: 'MERGE', partial: {
        currentAgent: AgentType.COMPLETED,
        finalScript: script,
        isProcessing: false,
        stepStatus: 'IDLE',
        history: newHistory
      }});
      addLog(">>> SYSTEM STANDBY.");
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      addLog(`ERROR: ${message}`);
      dispatch({ type: 'MERGE', partial: { isProcessing: false, stepStatus: 'IDLE' } });
    }
  };

  // --- HANDLERS FOR STEPPABLE UI ---

  const handleApproveRadar = () => {
    executeAnalyst(editedRadar);
  };

  const handleApproveAnalyst = () => {
    executeArchitect(editedDossier);
  };

  const handleApproveArchitect = () => {
    if (state.researchDossier) {
      executeWriter(editedStructure, state.researchDossier);
    }
  };

  const handleImageGen = async (index: number) => {
    if (!state.finalScript) return;

    const blockPrompt = state.finalScript[index].visualCue;
    addLog(`>>> GENERATING IMAGE FOR BLOCK ${index}...`);

    const imageUrl = await generateImageForBlock(blockPrompt);

    if (imageUrl) {
      dispatch({ type: 'UPDATE_SCRIPT_IMAGE', index, imageUrl });
      addLog(`>>> IMAGE GENERATED FOR BLOCK ${index}.`);
    } else {
      addLog(`>>> FAILED TO GENERATE IMAGE FOR BLOCK ${index}.`);
    }
  };

  // --- HISTORY & UI HELPERS ---

  const loadFromHistory = (item: HistoryItem) => {
    dispatch({ type: 'MERGE', partial: {
      topic: item.topic,
      finalScript: item.script,
      currentAgent: AgentType.COMPLETED,
      researchDossier: undefined,
      radarOutput: undefined,
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
    { id: AgentType.SCOUT, label: "The Scout", icon: ScoutIcon, desc: "Global Intel Scan" },
    { id: AgentType.RADAR, label: "The Radar", icon: RadarIcon, desc: "Trend Identification" },
    { id: AgentType.ANALYST, label: "The Analyst", icon: AnalystIcon, desc: "Google Grounding" },
    { id: AgentType.ARCHITECT, label: "The Architect", icon: ArchitectIcon, desc: "Structure Mapping" },
    { id: AgentType.WRITER, label: "The Writer", icon: WriterIcon, desc: "Visual Scripting" },
  ];

  return (
    <div className="min-h-screen bg-cn-black text-slate-300 font-sans selection:bg-cn-cyan selection:text-black">
      {/* Header */}
      <header className="border-b border-cn-slate/30 bg-black/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-cn-cyan rounded-full animate-pulse shadow-[0_0_10px_#00e5ff]" />
            <h1 className="text-xl font-bold tracking-widest text-white">
              SMART<span className="text-cn-cyan">.BLOCKBUSTER</span> <span className="text-xs text-cn-slate ml-2 font-mono border border-cn-slate/50 px-1 rounded">V{APP_VERSION}</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
             <button
              onClick={() => dispatch({ type: 'SET_FIELD', field: 'showHistory', value: true })}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cn-slate hover:text-cn-cyan transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>
              Archives ({state.history.length})
            </button>
            <div className="font-mono text-xs text-cn-slate hidden sm:block border-l border-cn-slate/30 pl-4">
              STATUS: {state.isProcessing ? 'BUSY' : state.stepStatus === 'WAITING_FOR_APPROVAL' ? 'WAITING' : 'IDLE'}
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

        {/* Left Column: Controls & Status - Made Sticky */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 h-fit">

          <div className="bg-cn-gray/30 p-6 rounded-lg border border-cn-slate/30 backdrop-blur-sm">
            <div className="mb-4">
              <label className="block text-xs font-bold text-cn-slate uppercase mb-2 tracking-wider">Agent Models</label>
              <div className="bg-black border border-cn-slate/50 rounded p-3 font-mono text-[11px] space-y-1">
                <div className="flex justify-between"><span className="text-cn-slate">Scout / Radar / Architect</span><span className="text-green-400">Flash</span></div>
                <div className="flex justify-between"><span className="text-cn-slate">Analyst / Writer</span><span className="text-purple-400">Pro</span></div>
              </div>
            </div>

            <label className="block text-xs font-bold text-cn-cyan uppercase mb-2 tracking-wider">Target Vector (Topic)</label>
            <div className="flex gap-2">
                <input
                  type="text"
                  value={state.topic}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'topic', value: e.target.value })}
                  placeholder="Manual topic..."
                  className="w-full bg-black border border-cn-slate/50 rounded p-3 text-white focus:border-cn-cyan focus:ring-1 focus:ring-cn-cyan outline-none transition-all placeholder:text-cn-slate/50 font-mono"
                  disabled={state.isProcessing || state.stepStatus !== 'IDLE'}
                />
            </div>

            <div className="mt-4 flex flex-col gap-2">
               {/* SCOUT BUTTON */}
               <button
                  onClick={executeScout}
                  disabled={state.isProcessing || (state.currentAgent !== 'IDLE' && state.currentAgent !== AgentType.COMPLETED)}
                  className={`w-full py-3 px-4 rounded font-bold uppercase tracking-widest transition-all border border-cn-cyan/50 text-cn-cyan hover:bg-cn-cyan hover:text-black flex items-center justify-center gap-2 ${
                    state.isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
               >
                  <ScoutIcon />
                  SCAN GLOBAL INTEL (IDEAS)
               </button>

               {/* MANUAL START BUTTON */}
               <button
                  onClick={() => executeRadar()}
                  disabled={state.isProcessing || !state.topic || (state.currentAgent !== 'IDLE' && state.currentAgent !== AgentType.COMPLETED)}
                  className={`w-full py-3 px-4 rounded font-bold uppercase tracking-widest transition-all ${
                    state.isProcessing || (state.currentAgent !== 'IDLE' && state.currentAgent !== AgentType.COMPLETED)
                      ? 'bg-cn-slate/20 text-cn-slate cursor-not-allowed'
                      : 'bg-cn-cyan hover:bg-cyan-300 text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]'
                  }`}
                >
                  {state.isProcessing ? 'Executing...' : 'Run Sequence (Manual Topic)'}
                </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
               <div
                 onClick={() => !state.isProcessing && dispatch({ type: 'SET_FIELD', field: 'isSteppable', value: !state.isSteppable })}
                 className={`cursor-pointer flex items-center gap-2 px-3 py-2 rounded border transition-all ${state.isSteppable ? 'border-cn-cyan bg-cn-cyan/10 text-white' : 'border-cn-slate/50 text-cn-slate'}`}
               >
                 <div className={`w-3 h-3 rounded-full ${state.isSteppable ? 'bg-cn-cyan' : 'bg-cn-slate'}`} />
                 <span className="text-xs font-bold uppercase tracking-wider">Steppable Mode</span>
               </div>
            </div>

          </div>

          <div className="space-y-2">
             <h3 className="text-xs font-bold text-cn-slate uppercase tracking-wider pl-1">Chain of Agents</h3>
             {Steps.map((step) => {
               const isActive = state.currentAgent === step.id;
               const agentOrder = [AgentType.SCOUT, AgentType.RADAR, AgentType.ANALYST, AgentType.ARCHITECT, AgentType.WRITER, AgentType.COMPLETED];
               const currentIdx = state.currentAgent === 'IDLE' ? -1 : agentOrder.indexOf(state.currentAgent);
               const thisIdx = agentOrder.indexOf(step.id);
               const isPast = currentIdx > thisIdx;

               return (
                 <div key={step.id} className={`flex items-center gap-4 p-4 rounded border transition-all ${isActive ? 'bg-cn-cyan/10 border-cn-cyan text-white' : isPast ? 'bg-cn-gray/20 border-cn-slate/30 text-green-500' : 'bg-transparent border-transparent text-cn-slate opacity-50'}`}>
                   <step.icon />
                   <div>
                     <div className="font-bold text-sm uppercase">{step.label}</div>
                     <div className="text-xs font-mono opacity-70">{step.desc}</div>
                   </div>
                   {isActive && <div className="ml-auto w-2 h-2 bg-cn-cyan rounded-full animate-ping" />}
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
          {state.currentAgent === 'IDLE' && !state.finalScript && !state.scoutSuggestions && (
             <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-cn-slate/20 rounded-lg p-12 text-center opacity-50">
               <div className="text-6xl mb-4">&#x1F310;</div>
               <h2 className="text-2xl font-bold mb-2">Awaiting Directive</h2>
               <p className="max-w-md mx-auto">Click "SCAN GLOBAL INTEL" to brainstorm topics with the Scout Agent, or enter a target manually.</p>
             </div>
          )}

          {/* SCOUT OUTPUT */}
          {(state.currentAgent === AgentType.SCOUT || state.scoutSuggestions) && state.scoutSuggestions && (
            <div className={`bg-cn-gray/20 p-6 rounded border ${state.currentAgent === AgentType.SCOUT ? 'border-cn-cyan shadow-[0_0_15px_rgba(0,229,255,0.2)]' : 'border-cn-slate/30'}`}>
               <h4 className="text-cn-cyan font-mono text-xs mb-4">/// SCOUT_INTEL_REPORT (SELECT ONE)</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {state.scoutSuggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectTopic(suggestion)}
                      className="bg-black/50 border border-cn-slate/50 p-4 rounded cursor-pointer hover:border-cn-cyan hover:bg-cn-cyan/10 transition-all group"
                    >
                      <h3 className="font-bold text-white mb-2 group-hover:text-cn-cyan">{suggestion.title}</h3>
                      <p className="text-xs text-gray-400 mb-2">{suggestion.hook}</p>
                      <div className="text-[10px] uppercase font-bold text-cn-slate border-t border-cn-slate/20 pt-2 mt-2">
                        Viral Factor: {suggestion.viralFactor}
                      </div>
                    </div>
                 ))}
               </div>
            </div>
          )}

          {/* STEP 1: RADAR OUTPUT */}
          {(state.currentAgent === AgentType.RADAR || state.radarOutput) && state.radarOutput && (
            <div className={`bg-cn-gray/20 p-6 rounded border ${state.currentAgent === AgentType.RADAR ? 'border-cn-cyan shadow-[0_0_15px_rgba(0,229,255,0.2)]' : 'border-cn-slate/30'}`}>
               <h4 className="text-cn-cyan font-mono text-xs mb-2">/// RADAR_INTERCEPT_DATA</h4>
               {state.stepStatus === 'WAITING_FOR_APPROVAL' && state.currentAgent === AgentType.RADAR ? (
                 <div>
                   <textarea
                      value={editedRadar}
                      onChange={(e) => setEditedRadar(e.target.value)}
                      className="w-full h-48 bg-black border border-cn-cyan/50 text-gray-300 font-mono text-sm p-4 focus:outline-none"
                   />
                   <div className="mt-4 flex justify-end">
                     <button onClick={handleApproveRadar} className="bg-cn-cyan text-black px-6 py-2 rounded font-bold uppercase tracking-wider text-xs hover:bg-cyan-300">
                       Approve &amp; Run Analyst &rarr;
                     </button>
                   </div>
                 </div>
               ) : (
                  <RichTextDisplay content={state.radarOutput} />
               )}
            </div>
          )}

          {/* STEP 2: ANALYST OUTPUT */}
          {(state.currentAgent === AgentType.ANALYST || state.researchDossier) && state.researchDossier && (
             <div className={`bg-cn-gray/20 p-6 rounded border ${state.currentAgent === AgentType.ANALYST ? 'border-cn-cyan shadow-[0_0_15px_rgba(0,229,255,0.2)]' : 'border-cn-slate/30'}`}>
                <h4 className="text-blue-400 font-mono text-xs mb-2">/// ANALYST_DOSSIER (TEXT)</h4>
                {state.stepStatus === 'WAITING_FOR_APPROVAL' && state.currentAgent === AgentType.ANALYST ? (
                   <div>
                     <textarea
                        value={editedDossier}
                        onChange={(e) => setEditedDossier(e.target.value)}
                        className="w-full h-96 bg-black border border-blue-500/50 text-blue-100 font-mono text-sm p-4 focus:outline-none leading-relaxed"
                     />
                     <div className="mt-4 flex justify-end">
                       <button onClick={handleApproveAnalyst} className="bg-cn-cyan text-black px-6 py-2 rounded font-bold uppercase tracking-wider text-xs hover:bg-cyan-300">
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
             <div className={`bg-cn-gray/20 p-6 rounded border ${state.currentAgent === AgentType.ARCHITECT ? 'border-cn-cyan shadow-[0_0_15px_rgba(0,229,255,0.2)]' : 'border-cn-slate/30'}`}>
                <h4 className="text-green-500 font-mono text-xs mb-2">/// ARCHITECT_BLUEPRINT</h4>
                {state.stepStatus === 'WAITING_FOR_APPROVAL' && state.currentAgent === AgentType.ARCHITECT ? (
                   <div>
                     <textarea
                        value={editedStructure}
                        onChange={(e) => setEditedStructure(e.target.value)}
                        className="w-full h-96 bg-black border border-green-500/50 text-green-100 font-mono text-sm p-4 focus:outline-none leading-relaxed"
                     />
                     <div className="mt-4 flex justify-end">
                       <button onClick={handleApproveArchitect} className="bg-cn-cyan text-black px-6 py-2 rounded font-bold uppercase tracking-wider text-xs hover:bg-cyan-300">
                         Approve &amp; Run Writer &rarr;
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
            radarContent={state.radarOutput}
            analystContent={typeof state.researchDossier === 'string' ? state.researchDossier : (state.researchDossier ? formatDossierToString(state.researchDossier) : undefined)}
            architectContent={state.structureMap}
            onGenerateImage={handleImageGen}
          />}
        </div>
      </main>
    </div>
  );
}

export default App;
