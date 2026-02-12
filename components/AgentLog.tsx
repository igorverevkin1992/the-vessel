
import { useEffect, useRef } from 'react';

interface AgentLogProps {
  logs: string[];
}

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
      className="bg-black border border-cn-slate/50 p-4 h-64 overflow-y-auto font-mono text-xs sm:text-sm shadow-inner shadow-black opacity-90"
    >
      <div className="mb-2 text-cn-cyan font-bold uppercase tracking-widest border-b border-cn-cyan/30 pb-1">
        System Kernel Log
      </div>
      <div className="flex flex-col space-y-1">
        {logs.map((log, i) => (
          <div key={i} className="text-emerald-400 break-words">
            <span className="text-cn-slate mr-2">[{getTimestamp(i)}]</span>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentLog;
