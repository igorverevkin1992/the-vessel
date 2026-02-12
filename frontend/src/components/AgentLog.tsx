import { useEffect, useRef, useMemo } from "react";

interface AgentLogProps {
  logs: string[];
  isProcessing: boolean;
}

export function AgentLog({ logs, isProcessing }: AgentLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  // Cache timestamps per log entry index to avoid re-generating on re-render
  const timestamps = useMemo(() => {
    const base = Date.now() - logs.length * 200;
    return logs.map((_, i) => {
      const t = new Date(base + i * 200);
      return t.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    });
  }, [logs.length]);

  return (
    <div className="bg-sb-black border border-sb-gray rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-sb-gray border-b border-sb-gray">
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-sb-red" />
          <div className="w-2.5 h-2.5 rounded-full bg-sb-amber" />
          <div className="w-2.5 h-2.5 rounded-full bg-sb-green" />
        </div>
        <span className="text-sb-slate text-xs ml-2">agent.log</span>
      </div>

      <div className="p-3 max-h-64 overflow-y-auto font-mono text-xs leading-relaxed">
        {logs.length === 0 ? (
          <div className="text-sb-slate">
            {">"} Ожидание запуска конвейера...
          </div>
        ) : (
          logs.map((log, i) => {
            // Color based on agent prefix
            let color = "text-gray-400";
            if (log.includes("[SCOUT]")) color = "text-cyan-400";
            else if (log.includes("[RADAR]")) color = "text-green-400";
            else if (log.includes("[ANALYST]")) color = "text-yellow-400";
            else if (log.includes("[ARCHITECT]")) color = "text-purple-400";
            else if (log.includes("[WRITER]")) color = "text-pink-400";
            else if (log.includes("[ORCHESTRATOR]")) color = "text-sb-amber";
            else if (log.includes("[ERROR]")) color = "text-sb-red";

            return (
              <div key={i} className="flex gap-2">
                <span className="text-sb-slate shrink-0">
                  {timestamps[i]}
                </span>
                <span className={color}>{log}</span>
              </div>
            );
          })
        )}

        {isProcessing && (
          <div className="flex gap-2 mt-1">
            <span className="text-sb-slate">
              {new Date().toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span className="cursor-blink text-sb-amber">Обработка</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
