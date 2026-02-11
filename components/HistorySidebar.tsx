import React from 'react';
import { HistoryItem } from '../types';

interface HistorySidebarProps {
  history: HistoryItem[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, isOpen, onClose, onSelect, onDelete }) => {
  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sliding sidebar */}
      <div
        className={`fixed inset-y-0 right-0 w-80 bg-tv-black border-l border-tv-slate/30 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-4 border-b border-tv-slate/30 flex justify-between items-center bg-tv-gray/10">
          <h3 className="font-bold text-tv-amber tracking-widest uppercase text-sm">Investigation Archive</h3>
          <button onClick={onClose} className="text-tv-slate hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center text-tv-slate text-xs mt-10">
              NO PRIOR INVESTIGATIONS RECORDED
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelect(item)}
                className="bg-tv-gray/20 border border-tv-slate/20 p-3 rounded cursor-pointer hover:border-tv-amber/50 hover:bg-tv-gray/30 transition-all group relative"
              >
                <div className="text-xs text-tv-slate font-mono mb-1 flex justify-between items-start">
                  <span>{new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>

                  <button
                    onClick={(e) => onDelete(item.id, e)}
                    className="text-tv-slate hover:text-tv-amber p-1 rounded hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Entry"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                </div>
                <div className="font-bold text-white text-sm line-clamp-2 group-hover:text-tv-amber transition-colors pr-2">
                  {item.topic}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] bg-tv-slate/20 px-1 rounded text-tv-slate border border-tv-slate/20">
                    {item.model.split('-')[1] || 'MODEL'}
                  </span>
                  <span className="text-[10px] text-tv-slate">
                    {item.script.length} Blocks
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default HistorySidebar;
