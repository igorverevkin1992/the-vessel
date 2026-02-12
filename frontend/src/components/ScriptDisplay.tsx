/**
 * Отображение двухколоночного A/V сценария.
 * Аналог ScriptDisplay из mediawar.core, адаптированный под Smart Blockbuster.
 *
 * Поддерживает:
 * - Таблица A/V строк (таймкод, аудио, визуал, тип, SFX, музыка)
 * - Экспорт в .doc (досье / сценарий) и .csv (монтаж)
 */

import type { AVLine, WriterOutput } from "../types";

interface ScriptDisplayProps {
  writerOutput: WriterOutput;
  fullText: string;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportDossierDoc(text: string) {
  const html = `<html><head><meta charset="utf-8"><style>
    body { font-family: 'Georgia', serif; font-size: 12pt; line-height: 1.8; margin: 40px; }
    h1 { color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 8px; }
    h3 { color: #f59e0b; margin-top: 20px; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 4px; white-space: pre-wrap; }
  </style></head><body>
    <h1>Smart Blockbuster — Досье</h1>
    <pre>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
  </body></html>`;
  downloadFile("smart_blockbuster_dossier.doc", html, "application/msword");
}

function exportScriptDoc(lines: AVLine[], title: string) {
  let tableRows = lines
    .map(
      (l) =>
        `<tr>
        <td style="padding:4px 8px;border:1px solid #ccc;font-size:10pt;">${l.timecode}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;font-size:10pt;">${l.audio_text}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;font-size:10pt;color:#666;">${l.visual_description}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;font-size:9pt;color:#999;">${l.sfx || "—"}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;font-size:9pt;color:#999;">${l.music_mood || "—"}</td>
      </tr>`
    )
    .join("\n");

  const html = `<html><head><meta charset="utf-8"><style>
    body { font-family: 'Courier New', monospace; font-size: 11pt; margin: 30px; }
    h1 { color: #dc2626; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th { background: #1f2937; color: white; padding: 6px 8px; border: 1px solid #ccc; text-align: left; font-size: 10pt; }
  </style></head><body>
    <h1>${title} — A/V Сценарий</h1>
    <table>
      <tr><th>Таймкод</th><th>Аудио</th><th>Визуал</th><th>SFX</th><th>Музыка</th></tr>
      ${tableRows}
    </table>
  </body></html>`;
  downloadFile("smart_blockbuster_script.doc", html, "application/msword");
}

function exportEditorCsv(lines: AVLine[]) {
  const header = "Таймкод;Аудио;Визуал;Тип визуала;SFX;Музыка";
  const rows = lines
    .map(
      (l) =>
        `"${l.timecode}";"${l.audio_text}";"${l.visual_description}";"${l.visual_type}";"${l.sfx}";"${l.music_mood}"`
    )
    .join("\n");
  downloadFile("smart_blockbuster_editor.csv", header + "\n" + rows, "text/csv");
}

export function ScriptDisplay({ writerOutput, fullText }: ScriptDisplayProps) {
  const { script } = writerOutput;
  const lines = script.av_lines ?? [];
  const duration = script.total_duration_sec ?? 0;
  const dMin = Math.floor(duration / 60);
  const dSec = duration % 60;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 text-xs text-sb-slate">
        <span>
          Блоков: <span className="text-white">{writerOutput.block_count}</span>
        </span>
        <span>
          Слов: <span className="text-white">{writerOutput.word_count}</span>
        </span>
        <span>
          Длительность:{" "}
          <span className="text-white">
            {dMin}:{String(dSec).padStart(2, "0")}
          </span>
        </span>
      </div>

      {/* Export buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => exportDossierDoc(fullText)}
          className="px-3 py-1.5 text-xs bg-sb-gray border border-sb-slate rounded hover:border-sb-amber hover:text-sb-amber transition-colors"
        >
          Досье .doc
        </button>
        <button
          onClick={() => exportScriptDoc(lines, script.title)}
          className="px-3 py-1.5 text-xs bg-sb-gray border border-sb-slate rounded hover:border-sb-amber hover:text-sb-amber transition-colors"
        >
          Сценарий .doc
        </button>
        <button
          onClick={() => exportEditorCsv(lines)}
          className="px-3 py-1.5 text-xs bg-sb-gray border border-sb-slate rounded hover:border-sb-amber hover:text-sb-amber transition-colors"
        >
          Монтаж .csv
        </button>
      </div>

      {/* A/V Table */}
      {lines.length > 0 && (
        <div className="overflow-x-auto border border-sb-gray rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-sb-gray text-sb-slate">
                <th className="px-2 py-2 text-left w-16">Таймкод</th>
                <th className="px-2 py-2 text-left">Аудио</th>
                <th className="px-2 py-2 text-left">Визуал</th>
                <th className="px-2 py-2 text-left w-20">Тип</th>
                <th className="px-2 py-2 text-left w-24">SFX</th>
                <th className="px-2 py-2 text-left w-28">Музыка</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr
                  key={i}
                  className={`border-t border-sb-gray/50 ${
                    i % 2 === 0 ? "bg-sb-black" : "bg-sb-dark"
                  } hover:bg-sb-gray/30 transition-colors`}
                >
                  <td className="px-2 py-1.5 text-sb-amber font-mono">
                    {line.timecode}
                  </td>
                  <td className="px-2 py-1.5 text-gray-300">
                    {line.audio_text}
                  </td>
                  <td className="px-2 py-1.5 text-sb-slate">
                    {line.visual_description}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className="px-1.5 py-0.5 bg-sb-gray rounded text-[10px] text-gray-400">
                      {line.visual_type}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-purple-400 text-[11px]">
                    {line.sfx || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-cyan-400 text-[11px]">
                    {line.music_mood || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
