
import React, { useState } from 'react';
import { ScriptBlock } from '../types';
import { APP_VERSION } from '../constants';

interface ScriptDisplayProps {
  script: ScriptBlock[];
  topic: string;
  decoderContent?: string;
  researcherContent?: string;
  architectContent?: string;
  onGenerateImage?: (index: number) => void;
}

// HTML-escape to prevent XSS in exported documents
const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const ScriptDisplay: React.FC<ScriptDisplayProps> = ({
  script,
  topic,
  decoderContent,
  researcherContent,
  architectContent,
  onGenerateImage
}) => {
  const [loadingImages, setLoadingImages] = useState<number[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleGenImage = async (index: number) => {
    if (!onGenerateImage) return;
    setLoadingImages(prev => [...prev, index]);
    await onGenerateImage(index);
    setLoadingImages(prev => prev.filter(i => i !== index));
  };

  const getDocStyles = () => `
    <style>
        @page Section1 {
            size: 841.9pt 595.3pt;
            mso-page-orientation: landscape;
            margin: 2.0cm;
        }
        div.Section1 {
            page: Section1;
        }

        body { font-family: 'Courier New', Courier, monospace; color: #000; }

        h1 { font-size: 24pt; font-weight: bold; text-transform: uppercase; color: #b8860b; border-bottom: 2px solid #b8860b; padding-bottom: 10px; }
        h2 { font-size: 16pt; font-weight: bold; background-color: #eee; padding: 5px; margin-top: 30px; border-left: 5px solid #b8860b; }
        h3 { font-size: 12pt; font-weight: bold; color: #444; margin-top: 15px; }
        p { font-size: 11pt; line-height: 1.4; margin-bottom: 10px; }

        .raw-content { white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 10pt; background: #f9f9f9; padding: 10px; border: 1px solid #ddd; }

        .block {
            margin-bottom: 20px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 10px;
            page-break-inside: avoid;
        }
        .time { font-weight: bold; color: #b8860b; font-size: 14pt; }
        .visual { color: #000099; font-style: italic; margin: 5px 0; font-size: 11pt; }
        .audio { margin-top: 5px; font-weight: bold; font-size: 12pt; }
        .russian { margin-top: 2px; color: #555; font-size: 11pt; }

        .img-container {
            margin-top: 15px;
            margin-bottom: 15px;
            text-align: left;
        }
        img.storyboard {
            width: 600px;
            height: auto;
            aspect-ratio: 16/9;
            border: 1px solid #666;
            display: block;
        }

        .page-break { page-break-before: always; }
      </style>
  `;

  const downloadDoc = (filename: string, content: string) => {
    const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);

    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = url;
    fileDownload.download = filename;
    fileDownload.click();
    document.body.removeChild(fileDownload);
    URL.revokeObjectURL(url);
  };

  const safeTopic = escapeHtml(topic);
  const safeFilename = topic.replace(/[^a-z0-9]/gi, '_').substring(0, 30);

  const handleExportDossierOnly = () => {
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>THE VESSEL DOSSIER</title>
      ${getDocStyles()}
      </head><body>
      <div class="Section1">

      <h1>INVESTIGATION DOSSIER: ${safeTopic}</h1>
      <p><strong>THE VESSEL.CORE V${APP_VERSION} // RESEARCH DATA ONLY</strong></p>
      <p>Generated: ${escapeHtml(new Date().toLocaleString())}</p>
      <hr/>

      <h2>AGENT DECODER: NARRATIVE ANALYSIS</h2>
      <div class="raw-content">${escapeHtml(decoderContent || 'No Decoder Data Available')}</div>

      <div class="page-break"></div>

      <h2>AGENT RESEARCHER: INTELLIGENCE DOSSIER</h2>
      <div class="raw-content">${escapeHtml(researcherContent || 'No Researcher Data Available')}</div>

      <div class="page-break"></div>

      <h2>AGENT ARCHITECT: STRUCTURE BLUEPRINT</h2>
      <div class="raw-content">${escapeHtml(architectContent || 'No Architect Data Available')}</div>

      </div></body></html>
    `;

    downloadDoc(`DOSSIER_${safeFilename}.doc`, header);
  };

  const handleExportScriptOnly = () => {
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>THE VESSEL SCRIPT</title>
      ${getDocStyles()}
      </head><body>
      <div class="Section1">

      <h1>SCRIPT: ${safeTopic}</h1>
      <p><strong>THE VESSEL.CORE V${APP_VERSION} // PRODUCTION SCRIPT</strong></p>
      <p>Generated: ${escapeHtml(new Date().toLocaleString())}</p>
      <hr/>

      <h2>AGENT NARRATOR: FINAL SCRIPT</h2>
    `;

    const scriptBody = script.map(block => `
      <div class="block">
        <div class="time">${escapeHtml(block.timecode)} [${escapeHtml(block.blockType)}]</div>
        <div class="visual">VISUAL: ${escapeHtml(block.visualCue)}</div>

        ${block.imageUrl ? `
          <div class="img-container">
            <img class="storyboard" src="${escapeHtml(block.imageUrl)}" alt="Storyboard Frame" style="width: 600px; height: auto;" />
          </div>
        ` : ''}

        <div class="audio">AUDIO (EN): ${escapeHtml(block.audioScript)}</div>
        <div class="russian">AUDIO (RU): ${escapeHtml(block.russianScript)}</div>
      </div>
    `).join('');

    const footer = "</div></body></html>";
    const sourceHTML = header + scriptBody + footer;

    downloadDoc(`SCRIPT_${safeFilename}.doc`, sourceHTML);
  };

  const handleExportExcel = () => {
    const headers = ["Timecode", "Block Type", "Visual Cue (Technical Task)", "Audio Script (EN)", "Audio Script (RU)"];

    const rows = script.map(block => {
      const safeVisual = `"${block.visualCue.replace(/"/g, '""')}"`;
      const safeAudio = `"${block.audioScript.replace(/"/g, '""')}"`;
      const safeRussian = `"${(block.russianScript || '').replace(/"/g, '""')}"`;
      return `${block.timecode},${block.blockType},${safeVisual},${safeAudio},${safeRussian}`;
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TASK_${safeFilename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Lightbox Modal for Image Viewing */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-7xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(null);
              }}
              className="absolute -top-12 right-0 sm:-right-12 p-2 text-tv-slate hover:text-tv-amber transition-colors bg-black/50 rounded-full sm:bg-transparent"
              title="Close Image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <img
              src={selectedImage}
              alt="Full Size Storyboard"
              className="max-w-full max-h-[85vh] rounded border border-tv-amber/50 shadow-[0_0_50px_rgba(212,160,23,0.3)] object-contain"
            />
            <div className="mt-4 text-white text-xs font-mono opacity-70 bg-black/50 px-3 py-1 rounded">
              CLICK ANYWHERE TO CLOSE
            </div>
          </div>
        </div>
      )}

      <div className="bg-tv-gray/20 rounded-lg overflow-hidden border border-tv-slate/30">
         <div className="bg-tv-amber/10 border-b border-tv-amber/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-tv-amber uppercase tracking-wider">
              Final Generated Script
            </h2>
            <p className="text-xs text-tv-slate mt-1 font-mono">THE VESSEL.CORE V{APP_VERSION} // EXPORT_READY</p>
          </div>

          <div className="flex gap-2">
             <button
               onClick={handleExportDossierOnly}
               className="flex items-center gap-2 px-4 py-2 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/30 text-blue-200 rounded text-xs uppercase font-bold tracking-wider transition-colors"
             >
               Dossier Only (.doc)
             </button>
             <button
               onClick={handleExportScriptOnly}
               className="flex items-center gap-2 px-4 py-2 bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 text-purple-200 rounded text-xs uppercase font-bold tracking-wider transition-colors"
             >
               Script Only (.doc)
             </button>
             <button
               onClick={handleExportExcel}
               className="flex items-center gap-2 px-4 py-2 bg-green-900/40 hover:bg-green-800/60 border border-green-500/30 text-green-200 rounded text-xs uppercase font-bold tracking-wider transition-colors"
             >
               Editor Task (.csv)
             </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-tv-black text-xs uppercase tracking-wider text-tv-slate border-b border-tv-slate/50">
                <th className="p-4 w-28">Timing</th>
                <th className="p-4 w-1/4">Visual (AI Storyboard)</th>
                <th className="p-4 w-1/3">Audio (EN)</th>
                <th className="p-4 w-1/3">Audio (RU)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tv-slate/20 font-mono text-sm">
              {script.map((block, idx) => (
                <tr key={idx} className="hover:bg-tv-slate/5 transition-colors">
                  <td className="p-4 align-top text-tv-amber font-bold whitespace-nowrap">
                    {block.timecode}
                    <div className="text-[10px] text-tv-slate mt-1 border border-tv-slate/30 rounded px-1 inline-block">
                      {block.blockType}
                    </div>
                  </td>
                  <td className="p-4 align-top text-blue-200/90 text-xs">
                    <div className="mb-2 italic">{block.visualCue}</div>

                    {block.imageUrl ? (
                      <div className="mt-2 rounded overflow-hidden border border-tv-slate/50 relative group">
                        <img
                          src={block.imageUrl}
                          alt="Storyboard"
                          className="w-full h-auto object-cover cursor-zoom-in hover:brightness-110 transition-all"
                          onClick={() => setSelectedImage(block.imageUrl || null)}
                        />
                        <button
                           onClick={() => handleGenImage(idx)}
                           className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                           Regenerate
                        </button>
                      </div>
                    ) : (
                      onGenerateImage && (
                        <button
                          onClick={() => handleGenImage(idx)}
                          disabled={loadingImages.includes(idx)}
                          className="mt-2 text-[10px] flex items-center gap-2 border border-tv-slate/30 px-2 py-1 rounded text-tv-slate hover:text-white hover:border-white transition-all w-full justify-center"
                        >
                           {loadingImages.includes(idx) ? (
                              <span className="animate-pulse">GENERATING...</span>
                           ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                GEN STORYBOARD
                              </>
                           )}
                        </button>
                      )
                    )}
                  </td>
                  <td className="p-4 align-top text-gray-300 leading-relaxed italic">
                    &ldquo;{block.audioScript}&rdquo;
                  </td>
                  <td className="p-4 align-top text-gray-400 leading-relaxed italic border-l border-tv-slate/10">
                    &ldquo;{block.russianScript}&rdquo;
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default ScriptDisplay;
