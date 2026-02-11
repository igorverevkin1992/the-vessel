
import { useEffect, useRef } from 'react';

interface AgentLogProps {
  logs: string[];
}

// Store timestamps as logs arrive, keyed by index
const timestampCache = new Map<number, string>();

const getTimestamp = (index: number): string => {
  const existing = timestampCache.get(index);
  if (existing) return existing;
  const ts = new Date().toLocaleTimeString();
  timestampCache.set(index, ts);
  return ts;
};

const AgentLog: React.FC<AgentLogProps> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      ref={containerRef}
      className="bg-black border border-tv-slate/50 p-4 h-64 overflow-y-auto font-mono text-xs sm:text-sm shadow-inner shadow-black opacity-90"
    >
      <div className="mb-2 text-tv-amber font-bold uppercase tracking-widest border-b border-tv-amber/30 pb-1">
        Investigation Log
      </div>
      <div className="flex flex-col space-y-1">
        {logs.map((log, i) => (
          <div key={i} className="text-green-500 break-words">
            <span className="text-tv-slate mr-2">[{getTimestamp(i)}]</span>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentLog;
