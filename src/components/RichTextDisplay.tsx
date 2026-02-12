/**
 * Рендерер текста с поддержкой markdown-подобной разметки.
 * Аналог RichTextDisplay из mediawar.core
 *
 * Поддерживает:
 * - /// Заголовки (h3)
 * - **жирный** текст
 * - - списки
 * - ключ: значение (подсветка)
 * - Номерованные списки (1. 2. 3.)
 */

interface RichTextDisplayProps {
  text: string;
  className?: string;
}

export function RichTextDisplay({ text, className = "" }: RichTextDisplayProps) {
  if (!text) {
    return (
      <div className={`text-sb-slate text-sm italic ${className}`}>
        Нет данных
      </div>
    );
  }

  const lines = text.split("\n");

  return (
    <div className={`space-y-1 text-sm leading-relaxed ${className}`}>
      {lines.map((line, i) => {
        const trimmed = line.trim();

        // Empty line → spacer
        if (!trimmed) {
          return <div key={i} className="h-2" />;
        }

        // /// Header
        if (trimmed.startsWith("///")) {
          return (
            <h3
              key={i}
              className="text-sb-amber font-bold text-sm mt-3 mb-1 uppercase tracking-wider"
            >
              {trimmed.replace(/^\/\/\/\s*/, "")}
            </h3>
          );
        }

        // **bold** processing
        const renderBold = (str: string) => {
          const parts = str.split(/(\*\*[^*]+\*\*)/g);
          return parts.map((part, j) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={j} className="text-white font-semibold">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={j}>{part}</span>;
          });
        };

        // Numbered list (1. 2. 3.)
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-sb-amber shrink-0 w-5 text-right">
                {numMatch[1]}.
              </span>
              <span className="text-gray-300">{renderBold(numMatch[2])}</span>
            </div>
          );
        }

        // Bullet list
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-sb-amber shrink-0">•</span>
              <span className="text-gray-300">
                {renderBold(trimmed.slice(2))}
              </span>
            </div>
          );
        }

        // Key: Value pattern
        const kvMatch = trimmed.match(/^([^:]{2,30}):\s+(.+)/);
        if (kvMatch && !trimmed.startsWith("http")) {
          return (
            <div key={i} className="pl-2">
              <span className="text-sb-slate">{kvMatch[1]}:</span>{" "}
              <span className="text-gray-300">{renderBold(kvMatch[2])}</span>
            </div>
          );
        }

        // Regular text
        return (
          <div key={i} className="text-gray-300 pl-2">
            {renderBold(trimmed)}
          </div>
        );
      })}
    </div>
  );
}
