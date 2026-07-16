'use client';

import { useState } from 'react';
import { useTranslation } from '@/components/providers';
import { apiPost } from '@/lib/api-client';
import { Copy, Download, FileText, Loader2, Check, Sparkles, ChevronDown } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface Segment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface ResultDisplayProps {
  text?: string | null;
  segments?: Segment[];
  fileName?: string;
  folderFileCount?: number;
  isLoading?: boolean;
  error?: string | null;
}

export function ResultDisplay({ text, segments = [], fileName = 'transcription', folderFileCount, isLoading, error }: ResultDisplayProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryLength, setSummaryLength] = useState<'short' | 'medium' | 'detailed'>('medium');
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.[^/.]+$/, '')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSRT = () => {
    if (segments.length === 0) {
      generateSRTFromText();
      return;
    }
    const srt = segments
      .map((seg, i) => {
        const start = formatSRTTime(seg.start);
        const end = formatSRTTime(seg.end);
        const speaker = seg.speaker ? `[${seg.speaker}] ` : '';
        return `${i + 1}\n${start} --> ${end}\n${speaker}${seg.text}\n`;
      })
      .join('\n');

    downloadText(srt, `${fileName.replace(/\.[^/.]+$/, '')}.srt`, 'text/plain');
  };

  const generateSRTFromText = () => {
    if (!text) return;
    const words = text.split(/\s+/);
    const chunkSize = 10;
    const lines: string[] = [];

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      const startTime = (i / words.length) * 60;
      const endTime = ((i + chunkSize) / words.length) * 60;
      lines.push(`${lines.length + 1}\n${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n${chunk}\n`);
    }

    downloadText(lines.join('\n'), `${fileName.replace(/\.[^/.]+$/, '')}.srt`, 'text/plain');
  };

  const handleDownloadJSON = () => {
    if (!text) return;
    const json = JSON.stringify(
      { fileName, text, segments, exportedAt: new Date().toISOString() },
      null,
      2
    );
    downloadText(json, `${fileName.replace(/\.[^/.]+$/, '')}.json`, 'application/json');
  };

  const handleDownloadPDF = async () => {
    if (!text) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;

    doc.setFontSize(16);
    doc.text(fileName, margin, 20);

    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, maxWidth);
    let y = 30;

    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 5;
    }

    doc.save(`${fileName.replace(/\.[^/.]+$/, '')}.pdf`);
  };

  const handleDownloadDOCX = async () => {
    if (!text) return;
    try {
      const response = await apiPost('/api/export', { text, fileName, format: 'docx' });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/\.[^/.]+$/, '')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('DOCX export failed:', err);
    }
  };

  const handleSummarize = async () => {
    if (!text) return;
    setIsSummarizing(true);
    setSummaryExpanded(true);

    try {
      const response = await apiPost('/api/summarize', { text, length: summaryLength });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to summarize');
      setSummaryText(data.summary);
    } catch (err) {
      setSummaryText(`Error: ${err instanceof Error ? err.message : 'Failed to summarize'}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const formatSRTTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const downloadText = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold flex items-center space-x-2 text-gray-900">
          <FileText className="w-6 h-6 text-blue-600" />
          <span>{t('result.title')}</span>
        </h2>
      </div>

      <div className="flex-1 bg-white border border-gray-200 rounded-lg p-6 overflow-auto min-h-[400px]">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            <p className="text-gray-500">{t('processing.processing')}</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
              <p className="text-red-600 text-center">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && !text && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-500">
              Upload video, audio, ZIP, or folder to see the result here
            </p>
          </div>
        )}

        {text && (
          <>
            {/* File Stats */}
            {folderFileCount && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-blue-800">
                  <FileText className="w-4 h-4" />
                  <span>{folderFileCount} files extracted</span>
                  <span className="text-blue-400">|</span>
                  <span>{(text.length / 1000).toFixed(0)}K chars</span>
                </div>
                <span className="text-xs text-blue-500">Source2Txt</span>
              </div>
            )}

            {/* Summary Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setSummaryExpanded(!summaryExpanded)}
                  className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span>{t('summary.title')}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`} />
                </button>

                {summaryExpanded && (
                  <div className="flex items-center space-x-2">
                    <select
                      value={summaryLength}
                      onChange={(e) => setSummaryLength(e.target.value as any)}
                      className="bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700"
                    >
                      <option value="short">{t('summary.short')}</option>
                      <option value="medium">{t('summary.medium')}</option>
                      <option value="detailed">{t('summary.detailed')}</option>
                    </select>
                    <button
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                      className="flex items-center space-x-1 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 rounded-lg text-xs text-white transition-colors"
                    >
                      {isSummarizing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{isSummarizing ? t('summary.processing') : t('summary.button')}</span>
                    </button>
                  </div>
                )}
              </div>

              {summaryExpanded && summaryText && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700">
                    {summaryText}
                  </pre>
                </div>
              )}
            </div>

            {/* Transcript Text */}
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-900">
              {text}
            </pre>
          </>
        )}
      </div>

      {/* Action Buttons */}
      {text && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm text-gray-700"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span>{copied ? 'Copied!' : t('result.copy')}</span>
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm text-white"
          >
            <Download className="w-4 h-4" />
            <span>{t('export.markdown')}</span>
          </button>

          <button
            onClick={handleDownloadSRT}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm text-gray-700"
          >
            <Download className="w-4 h-4" />
            <span>{t('export.srt')}</span>
          </button>

          <button
            onClick={handleDownloadJSON}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm text-gray-700"
          >
            <Download className="w-4 h-4" />
            <span>{t('export.json')}</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm text-gray-700"
          >
            <Download className="w-4 h-4" />
            <span>{t('export.pdf')}</span>
          </button>

          <button
            onClick={handleDownloadDOCX}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm text-gray-700"
          >
            <Download className="w-4 h-4" />
            <span>{t('export.docx')}</span>
          </button>
        </div>
      )}
    </div>
  );
}