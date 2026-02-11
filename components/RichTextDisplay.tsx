import React from 'react';

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

const RichTextDisplay: React.FC<RichTextDisplayProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className={`space-y-1 font-mono text-sm leading-relaxed ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Handle Headers
        if (trimmed.startsWith('///') || trimmed.startsWith('===') || trimmed.startsWith('STEP')) {
          return (
            <h4 key={idx} className="text-tv-amber font-bold uppercase tracking-wider mt-4 mb-2 text-xs border-b border-tv-amber/20 pb-1">
              {trimmed.replace(/[/=]/g, '').trim()}
            </h4>
          );
        }

        // Handle List Items
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const text = trimmed.substring(2);
          return (
            <div key={idx} className="flex gap-2 pl-2">
              <span className="text-tv-amber font-bold">&rsaquo;</span>
              <span className="text-gray-300">
                {parseBold(text)}
              </span>
            </div>
          );
        }

        // Handle Numbered Lists
        if (/^\d+\./.test(trimmed)) {
           return (
             <div key={idx} className="flex gap-2 pl-2 mt-1">
               <span className="text-tv-slate font-bold">{trimmed.split('.')[0]}.</span>
               <span className="text-gray-300">{parseBold(trimmed.substring(trimmed.indexOf('.') + 1))}</span>
             </div>
           );
        }

        // Handle Key-Value
        if (trimmed.includes(':') && trimmed.length < 100 && !trimmed.endsWith(':')) {
             const parts = trimmed.split(':');
             const label = parts[0];
             const val = parts.slice(1).join(':');
             return (
                 <div key={idx} className="text-gray-400">
                     <span className="text-tv-slate uppercase text-xs font-bold mr-2">{label}:</span>
                     {parseBold(val)}
                 </div>
             )
        }

        // Empty lines
        if (!trimmed) return <div key={idx} className="h-2" />;

        // Standard Text
        return (
          <p key={idx} className="text-gray-400">
            {parseBold(line)}
          </p>
        );
      })}
    </div>
  );
};

// Simple helper to bold text between ** **
const parseBold = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export default RichTextDisplay;
