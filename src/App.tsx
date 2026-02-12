/**
 * Главный компонент «Умного блокбастера».
 *
 * Адаптация App.tsx из mediawar.core v3.3:
 * - useReducer state machine для конвейера агентов
 * - Левая колонка: управление, цепочка агентов, лог
 * - Правая колонка: вкладки с выходом каждого агента
 */

import { useReducer, useCallback, useState, useRef } from "react";
import { GoogleGenAI } from "@google/genai";
import {
  type SystemState,
  type HistoryItem,
  INITIAL_STATE,
  AgentType,
  StepStatus,
  AGENT_PIPELINE_ORDER,
  AGENT_DESCRIPTIONS,
} from "./types";
import {
  APP_VERSION,
  AGENT_MODELS,
  SCOUT_PROMPT,
  RADAR_PROMPT,
  ANALYST_PROMPT,
  ARCHITECT_PROMPT,
  WRITER_PROMPT,
} from "./constants";
import { AgentLog } from "./components/AgentLog";
import { RichTextDisplay } from "./components/RichTextDisplay";
import { ScriptDisplay } from "./components/ScriptDisplay";

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: "SET_PROCESSING"; agent: AgentType }
  | { type: "ADD_LOG"; message: string }
  | { type: "SET_SCOUT_TEXT"; text: string }
  | { type: "SET_RADAR_TEXT"; text: string }
  | { type: "SET_ANALYST_TEXT"; text: string }
  | { type: "SET_ARCHITECT_TEXT"; text: string }
  | { type: "SET_WRITER_TEXT"; text: string; writerOutput: SystemState["writerOutput"] }
  | { type: "SET_TOPIC"; topic: string }
  | { type: "SET_STEP_STATUS"; status: StepStatus }
  | { type: "SET_STEPPABLE"; value: boolean }
  | { type: "COMPLETE" }
  | { type: "ERROR"; message: string }
  | { type: "RESET" };

function reducer(state: SystemState, action: Action): SystemState {
  switch (action.type) {
    case "SET_PROCESSING":
      return { ...state, currentAgent: action.agent, isProcessing: true, error: null };
    case "ADD_LOG":
      return { ...state, logs: [...state.logs, action.message] };
    case "SET_SCOUT_TEXT":
      return { ...state, scoutText: action.text };
    case "SET_RADAR_TEXT":
      return { ...state, radarText: action.text };
    case "SET_ANALYST_TEXT":
      return { ...state, analystText: action.text };
    case "SET_ARCHITECT_TEXT":
      return { ...state, architectText: action.text };
    case "SET_WRITER_TEXT":
      return { ...state, writerText: action.text, writerOutput: action.writerOutput };
    case "SET_TOPIC":
      return { ...state, topic: action.topic };
    case "SET_STEP_STATUS":
      return { ...state, stepStatus: action.status };
    case "SET_STEPPABLE":
      return { ...state, isSteppable: action.value };
    case "COMPLETE":
      return { ...state, currentAgent: AgentType.COMPLETED, isProcessing: false };
    case "ERROR":
      return { ...state, isProcessing: false, error: action.message };
    case "RESET":
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// AI Client
// ---------------------------------------------------------------------------

function getAI(): GoogleGenAI | null {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string;
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

async function callAgent(
  ai: GoogleGenAI,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const response = await ai.models.generateContent({
    model,
    contents: userMessage,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.8,
      maxOutputTokens: 8192,
    },
  });
  return response.text ?? "";
}

// ---------------------------------------------------------------------------
// Parse Writer output to extract AV lines
// ---------------------------------------------------------------------------

function parseWriterOutput(text: string) {
  // Try to parse table rows from the writer's output
  const lines = text.split("\n");
  const avLines: Array<{
    timecode: string;
    audio_text: string;
    visual_description: string;
    visual_type: string;
    sfx: string;
    music_mood: string;
  }> = [];

  for (const line of lines) {
    // Match table rows: | timecode | audio | visual | type | sfx | music |
    const match = line.match(
      /\|\s*(\d{2}:\d{2})\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/
    );
    if (match) {
      avLines.push({
        timecode: match[1],
        audio_text: match[2].trim(),
        visual_description: match[3].trim(),
        visual_type: match[4].trim().toLowerCase(),
        sfx: match[5].trim(),
        music_mood: match[6].trim(),
      });
    }
  }

  const wordCount = text.split(/\s+/).length;

  return {
    script: {
      title: "",
      promise: "",
      hook: {
        archetype: "investigator",
        step1_anchor: { name: "", goal: "", text: "", visual: "" },
        step2_interjection: { name: "", goal: "", text: "", visual: "" },
        step3_snapback: { name: "", goal: "", text: "", visual: "" },
      },
      blocks: [],
      av_lines: avLines,
      total_duration_sec: avLines.length * 4,
    },
    word_count: wordCount,
    block_count: avLines.length,
  };
}

// ---------------------------------------------------------------------------
// App Component
// ---------------------------------------------------------------------------

export default function App() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<string>("scout");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [apiKey, setApiKey] = useState(
    () => (import.meta.env.VITE_GEMINI_API_KEY as string) || ""
  );
  const [editableText, setEditableText] = useState("");
  const abortRef = useRef(false);

  // ── Resolve step (steppable mode) ──
  const stepResolveRef = useRef<(() => void) | null>(null);

  const waitForApproval = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      dispatch({ type: "SET_STEP_STATUS", status: StepStatus.WAITING_FOR_APPROVAL });
      stepResolveRef.current = resolve;
    });
  }, []);

  const approveStep = useCallback(() => {
    dispatch({ type: "SET_STEP_STATUS", status: StepStatus.PROCESSING });
    stepResolveRef.current?.();
    stepResolveRef.current = null;
  }, []);

  // ── Execute pipeline ──
  const executePipeline = useCallback(async () => {
    abortRef.current = false;

    const ai = apiKey ? new GoogleGenAI({ apiKey }) : getAI();
    if (!ai) {
      dispatch({
        type: "ERROR",
        message: "API ключ Gemini не указан. Установите VITE_GEMINI_API_KEY или введите ключ.",
      });
      return;
    }

    dispatch({ type: "RESET" });
    dispatch({ type: "SET_STEPPABLE", value: state.isSteppable });

    // ── SCOUT ──
    dispatch({ type: "SET_PROCESSING", agent: AgentType.SCOUT });
    dispatch({ type: "ADD_LOG", message: "[ORCHESTRATOR] Запуск конвейера «Умный блокбастер»..." });
    dispatch({ type: "ADD_LOG", message: "[SCOUT] Запуск агента Скаут..." });
    dispatch({ type: "ADD_LOG", message: "[SCOUT] Сканирование информационного поля..." });

    try {
      const scoutResult = await callAgent(
        ai,
        AGENT_MODELS[AgentType.SCOUT],
        SCOUT_PROMPT,
        "Предложи 4 актуальные темы для YouTube-видео в формате «Умный блокбастер»."
      );

      if (abortRef.current) return;
      dispatch({ type: "SET_SCOUT_TEXT", text: scoutResult });
      dispatch({ type: "ADD_LOG", message: "[SCOUT] 4 темы предложены." });
      setActiveTab("scout");

      // Extract topic from first suggestion
      const topicMatch = scoutResult.match(/1\.\s*\*?\*?(?:Заголовок)?:?\s*\*?\*?\s*[«"]?(.+?)[»"]?\s*$/m);
      const topic = topicMatch?.[1]?.replace(/\*+/g, "").trim() || "Тема из Scout";
      dispatch({ type: "SET_TOPIC", topic });

      if (state.isSteppable) {
        setEditableText(scoutResult);
        await waitForApproval();
        if (abortRef.current) return;
      }

      // ── RADAR ──
      dispatch({ type: "SET_PROCESSING", agent: AgentType.RADAR });
      dispatch({ type: "ADD_LOG", message: `[RADAR] Запуск агента Радар для: «${topic}»...` });
      dispatch({ type: "ADD_LOG", message: "[RADAR] Анализ вирусных триггеров..." });

      const radarInput = state.isSteppable ? editableText : scoutResult;
      const radarResult = await callAgent(
        ai,
        AGENT_MODELS[AgentType.RADAR],
        RADAR_PROMPT,
        `Тема от Скаута:\n${radarInput}\n\nОпредели вирусные углы для этой темы.`
      );

      if (abortRef.current) return;
      dispatch({ type: "SET_RADAR_TEXT", text: radarResult });
      dispatch({ type: "ADD_LOG", message: "[RADAR] Вирусные углы определены." });
      setActiveTab("radar");

      if (state.isSteppable) {
        setEditableText(radarResult);
        await waitForApproval();
        if (abortRef.current) return;
      }

      // ── ANALYST ──
      dispatch({ type: "SET_PROCESSING", agent: AgentType.ANALYST });
      dispatch({ type: "ADD_LOG", message: "[ANALYST] Запуск агента Аналитик..." });
      dispatch({ type: "ADD_LOG", message: "[ANALYST] Двухвекторный поиск источников..." });

      const analystInput = state.isSteppable ? editableText : radarResult;
      const analystResult = await callAgent(
        ai,
        AGENT_MODELS[AgentType.ANALYST],
        ANALYST_PROMPT,
        `Тема: «${topic}»\n\nВирусные углы от Радара:\n${analystInput}\n\nСформируй исследовательское досье.`
      );

      if (abortRef.current) return;
      dispatch({ type: "SET_ANALYST_TEXT", text: analystResult });
      dispatch({
        type: "ADD_LOG",
        message: "[ANALYST] Исследовательское досье сформировано.",
      });
      setActiveTab("analyst");

      if (state.isSteppable) {
        setEditableText(analystResult);
        await waitForApproval();
        if (abortRef.current) return;
      }

      // ── ARCHITECT ──
      dispatch({ type: "SET_PROCESSING", agent: AgentType.ARCHITECT });
      dispatch({ type: "ADD_LOG", message: "[ARCHITECT] Запуск агента Архитектор..." });
      dispatch({ type: "ADD_LOG", message: "[ARCHITECT] Проектирование структуры..." });

      const architectInput = state.isSteppable ? editableText : analystResult;
      const architectResult = await callAgent(
        ai,
        AGENT_MODELS[AgentType.ARCHITECT],
        ARCHITECT_PROMPT,
        `Досье Аналитика:\n${architectInput}\n\nСпроектируй структуру видео.`
      );

      if (abortRef.current) return;
      dispatch({ type: "SET_ARCHITECT_TEXT", text: architectResult });
      dispatch({ type: "ADD_LOG", message: "[ARCHITECT] Структура спроектирована." });
      setActiveTab("architect");

      if (state.isSteppable) {
        setEditableText(architectResult);
        await waitForApproval();
        if (abortRef.current) return;
      }

      // ── WRITER ──
      dispatch({ type: "SET_PROCESSING", agent: AgentType.WRITER });
      dispatch({ type: "ADD_LOG", message: "[WRITER] Запуск агента Сценарист..." });
      dispatch({ type: "ADD_LOG", message: "[WRITER] Генерация A/V сценария в стиле Стаккато..." });

      const writerArchInput = state.isSteppable ? editableText : architectResult;
      const writerResult = await callAgent(
        ai,
        AGENT_MODELS[AgentType.WRITER],
        WRITER_PROMPT,
        `Структура от Архитектора:\n${writerArchInput}\n\nДосье Аналитика:\n${analystResult}\n\nСоздай полный двухколоночный A/V сценарий. Минимум 60 строк.`
      );

      if (abortRef.current) return;
      const writerOutput = parseWriterOutput(writerResult) as SystemState["writerOutput"];
      dispatch({
        type: "SET_WRITER_TEXT",
        text: writerResult,
        writerOutput,
      });
      dispatch({
        type: "ADD_LOG",
        message: `[WRITER] Сценарий готов: ${writerOutput?.block_count ?? 0} блоков, ${writerOutput?.word_count ?? 0} слов.`,
      });
      setActiveTab("writer");

      // ── COMPLETE ──
      dispatch({ type: "COMPLETE" });
      dispatch({ type: "ADD_LOG", message: "[ORCHESTRATOR] Конвейер завершён." });

      // Save to history
      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString("ru-RU"),
        topic,
        state: {
          ...state,
          scoutText: scoutResult,
          radarText: radarResult,
          analystText: analystResult,
          architectText: architectResult,
          writerText: writerResult,
          writerOutput,
          topic,
          currentAgent: AgentType.COMPLETED,
          isProcessing: false,
          logs: [],
        },
      };
      setHistory((prev) => [historyItem, ...prev].slice(0, 20));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Неизвестная ошибка";
      dispatch({ type: "ERROR", message });
      dispatch({ type: "ADD_LOG", message: `[ERROR] ${message}` });
    }
  }, [apiKey, state.isSteppable, editableText, waitForApproval]);

  const stopPipeline = useCallback(() => {
    abortRef.current = true;
    dispatch({ type: "ADD_LOG", message: "[ORCHESTRATOR] Конвейер остановлен пользователем." });
    dispatch({ type: "COMPLETE" });
  }, []);

  const loadHistory = useCallback((item: HistoryItem) => {
    dispatch({ type: "RESET" });
    dispatch({ type: "SET_SCOUT_TEXT", text: item.state.scoutText });
    dispatch({ type: "SET_RADAR_TEXT", text: item.state.radarText });
    dispatch({ type: "SET_ANALYST_TEXT", text: item.state.analystText });
    dispatch({ type: "SET_ARCHITECT_TEXT", text: item.state.architectText });
    if (item.state.writerOutput) {
      dispatch({
        type: "SET_WRITER_TEXT",
        text: item.state.writerText,
        writerOutput: item.state.writerOutput,
      });
    }
    dispatch({ type: "SET_TOPIC", topic: item.topic });
    dispatch({ type: "COMPLETE" });
    setActiveTab("scout");
    setShowHistory(false);
  }, []);

  // ── Agent status helpers ──
  const getAgentStatus = (agent: AgentType) => {
    const order = AGENT_PIPELINE_ORDER;
    const currentIdx = order.indexOf(state.currentAgent as AgentType);
    const agentIdx = order.indexOf(agent);

    if (state.currentAgent === AgentType.COMPLETED) return "completed";
    if (state.currentAgent === agent && state.isProcessing) return "active";
    if (currentIdx > agentIdx) return "completed";
    return "pending";
  };

  const getAgentText = (agent: string) => {
    switch (agent) {
      case "scout": return state.scoutText;
      case "radar": return state.radarText;
      case "analyst": return state.analystText;
      case "architect": return state.architectText;
      case "writer": return state.writerText;
      default: return "";
    }
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-sb-black flex">
      {/* ═══ LEFT COLUMN ═══ */}
      <div className="w-80 shrink-0 border-r border-sb-gray flex flex-col h-screen overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-sb-gray">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🎬</span>
            <div>
              <h1 className="text-white font-bold text-sm tracking-wide">
                SMART BLOCKBUSTER
              </h1>
              <div className="text-sb-slate text-[10px]">
                v{APP_VERSION} / Синтез Кэллоуэя + Харриса
              </div>
            </div>
          </div>
        </div>

        {/* API Key */}
        <div className="p-4 border-b border-sb-gray">
          <label className="block text-sb-slate text-[10px] uppercase tracking-wider mb-1">
            Gemini API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full bg-sb-black border border-sb-gray rounded px-2 py-1.5 text-xs text-gray-300 placeholder-sb-slate focus:border-sb-amber focus:outline-none transition-colors"
          />
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-sb-gray space-y-2">
          {/* Steppable toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.isSteppable}
              onChange={(e) =>
                dispatch({ type: "SET_STEPPABLE", value: e.target.checked })
              }
              disabled={state.isProcessing}
              className="accent-sb-amber"
            />
            <span className="text-xs text-gray-400">Пошаговый режим</span>
          </label>

          {/* Start / Stop */}
          <div className="flex gap-2">
            <button
              onClick={executePipeline}
              disabled={state.isProcessing || !apiKey}
              className="flex-1 px-3 py-2 bg-sb-amber text-sb-black font-bold text-xs rounded hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {state.isProcessing ? "РАБОТАЕТ..." : "ЗАПУСК"}
            </button>
            {state.isProcessing && (
              <button
                onClick={stopPipeline}
                className="px-3 py-2 bg-sb-red text-white text-xs rounded hover:bg-red-700 transition-colors"
              >
                СТОП
              </button>
            )}
          </div>

          {/* Steppable approval */}
          {state.stepStatus === StepStatus.WAITING_FOR_APPROVAL && (
            <div className="bg-sb-gray/50 border border-sb-amber rounded p-2">
              <div className="text-sb-amber text-[10px] uppercase mb-1">
                Ожидание одобрения
              </div>
              <textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                className="w-full bg-sb-black border border-sb-gray rounded px-2 py-1 text-xs text-gray-300 h-32 resize-y focus:border-sb-amber focus:outline-none mb-2"
              />
              <button
                onClick={approveStep}
                className="w-full px-3 py-1.5 bg-sb-green text-sb-black font-bold text-xs rounded hover:bg-green-400 transition-colors"
              >
                ОДОБРИТЬ И ПРОДОЛЖИТЬ
              </button>
            </div>
          )}

          {/* History button */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-3 py-1.5 bg-sb-gray border border-sb-slate text-xs text-gray-400 rounded hover:border-sb-amber hover:text-sb-amber transition-colors"
          >
            История ({history.length})
          </button>
        </div>

        {/* Agent Chain */}
        <div className="p-4 border-b border-sb-gray">
          <div className="text-sb-slate text-[10px] uppercase tracking-wider mb-3">
            Цепочка агентов
          </div>
          <div className="space-y-1">
            {AGENT_PIPELINE_ORDER.map((agent, i) => {
              const meta = AGENT_DESCRIPTIONS[agent];
              const status = getAgentStatus(agent);

              let statusColor = "border-sb-gray text-sb-slate";
              let iconBg = "bg-sb-gray";
              if (status === "active") {
                statusColor = "border-sb-amber text-sb-amber";
                iconBg = "bg-sb-amber/20";
              } else if (status === "completed") {
                statusColor = "border-sb-green text-sb-green";
                iconBg = "bg-sb-green/20";
              }

              return (
                <div key={agent}>
                  <button
                    onClick={() => setActiveTab(agent)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border ${statusColor} transition-all hover:bg-sb-gray/30 ${
                      status === "active" ? "agent-active" : ""
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded flex items-center justify-center text-sm ${iconBg}`}
                    >
                      {meta.icon}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-[11px] font-medium truncate">
                        {meta.nameRu}
                      </div>
                      <div className="text-[9px] opacity-60">{meta.role}</div>
                    </div>
                    {status === "completed" && (
                      <span className="text-sb-green text-[10px]">✓</span>
                    )}
                    {status === "active" && (
                      <span className="text-sb-amber text-[10px] animate-pulse">
                        ●
                      </span>
                    )}
                  </button>
                  {i < AGENT_PIPELINE_ORDER.length - 1 && (
                    <div
                      className={`agent-chain-line ${
                        status === "completed" ? "bg-sb-green" : "bg-sb-gray"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Topic */}
        {state.topic && (
          <div className="p-4 border-b border-sb-gray">
            <div className="text-sb-slate text-[10px] uppercase tracking-wider mb-1">
              Тема
            </div>
            <div className="text-xs text-gray-300 line-clamp-3">
              {state.topic}
            </div>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="p-4 border-b border-sb-gray">
            <div className="bg-sb-red/10 border border-sb-red rounded p-2">
              <div className="text-sb-red text-[10px] uppercase mb-1">
                Ошибка
              </div>
              <div className="text-xs text-red-300">{state.error}</div>
            </div>
          </div>
        )}

        {/* Agent Log */}
        <div className="flex-1 p-4 min-h-0">
          <div className="text-sb-slate text-[10px] uppercase tracking-wider mb-2">
            Лог системы
          </div>
          <AgentLog logs={state.logs} isProcessing={state.isProcessing} />
        </div>
      </div>

      {/* ═══ RIGHT COLUMN ═══ */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-sb-gray shrink-0">
          {AGENT_PIPELINE_ORDER.map((agent) => {
            const meta = AGENT_DESCRIPTIONS[agent];
            const hasContent = !!getAgentText(agent);
            return (
              <button
                key={agent}
                onClick={() => setActiveTab(agent)}
                className={`px-4 py-2.5 text-xs transition-colors ${
                  activeTab === agent ? "tab-active" : "tab-inactive"
                } ${!hasContent ? "opacity-40" : ""}`}
              >
                <span className="mr-1">{meta.icon}</span>
                {meta.nameRu.split(" ")[0]}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* No content state */}
          {!getAgentText(activeTab) && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-4 opacity-20">
                  {AGENT_DESCRIPTIONS[activeTab as AgentType]?.icon ?? "🎬"}
                </div>
                <div className="text-sb-slate text-sm">
                  {state.isProcessing && state.currentAgent === activeTab
                    ? "Агент работает..."
                    : "Запустите конвейер для получения результатов"}
                </div>
              </div>
            </div>
          )}

          {/* Agent output */}
          {activeTab !== "writer" && getAgentText(activeTab) && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">
                  {AGENT_DESCRIPTIONS[activeTab as AgentType]?.icon}
                </span>
                <h2 className="text-white font-bold text-sm">
                  {AGENT_DESCRIPTIONS[activeTab as AgentType]?.nameRu}
                </h2>
                <span className="text-sb-slate text-[10px]">
                  {AGENT_DESCRIPTIONS[activeTab as AgentType]?.role}
                </span>
              </div>
              <div className="bg-sb-dark border border-sb-gray rounded-lg p-4">
                <RichTextDisplay text={getAgentText(activeTab)} />
              </div>
            </div>
          )}

          {/* Writer tab with ScriptDisplay */}
          {activeTab === "writer" && state.writerText && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">✍️</span>
                <h2 className="text-white font-bold text-sm">
                  Сценарист (Writer)
                </h2>
                <span className="text-sb-slate text-[10px]">
                  Полный A/V сценарий
                </span>
              </div>

              {state.writerOutput && (
                <div className="mb-4">
                  <ScriptDisplay
                    writerOutput={state.writerOutput}
                    fullText={`${state.analystText}\n\n${state.architectText}\n\n${state.writerText}`}
                  />
                </div>
              )}

              <div className="bg-sb-dark border border-sb-gray rounded-lg p-4 mt-4">
                <div className="text-sb-slate text-[10px] uppercase tracking-wider mb-2">
                  Полный текст сценария
                </div>
                <RichTextDisplay text={state.writerText} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ HISTORY SIDEBAR ═══ */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setShowHistory(false)}
          />
          <div className="w-80 bg-sb-dark border-l border-sb-gray h-full overflow-y-auto">
            <div className="p-4 border-b border-sb-gray flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">История</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-sb-slate hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            {history.length === 0 ? (
              <div className="p-4 text-sb-slate text-xs text-center">
                Нет сохранённых сессий
              </div>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadHistory(item)}
                  className="w-full p-3 border-b border-sb-gray text-left hover:bg-sb-gray/30 transition-colors"
                >
                  <div className="text-xs text-gray-300 truncate">
                    {item.topic}
                  </div>
                  <div className="text-[10px] text-sb-slate mt-0.5">
                    {item.timestamp}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
