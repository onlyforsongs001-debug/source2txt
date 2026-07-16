'use client';

import { useState, useCallback } from 'react';
import { VideoUploader } from '@/components/video-uploader';
import { ResultDisplay } from '@/components/result-display';
import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface FileItem {
  file: File;
  audioBlob?: Blob;
  duration?: number;
  isZip?: boolean;
  isFolder?: boolean;
  folderText?: string;
  folderFileCount?: number;
  status: 'pending' | 'converting' | 'ready' | 'error';
  progress: number;
  error?: string;
}

interface TranscriptionResult {
  fileName: string;
  text: string;
  chunks?: string[];
  folderFileCount?: number;
  segments: { start: number; end: number; text: string; speaker?: string }[];
  creditsUsed: number;
  status: 'completed' | 'failed';
  error?: string;
}

interface WorkspaceTabProps {
  user: any;
  credits: number;
  setCredits: (credits: number) => void;
  subscriptionTier?: string;
}

export function WorkspaceTab({ user, credits, setCredits, subscriptionTier }: WorkspaceTabProps) {
  const [results, setResults] = useState<TranscriptionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [processingTotal, setProcessingTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<number>(0);
  const [diarize, setDiarize] = useState(false);
  const [compress, setCompress] = useState(false);
  const [chunkFiles, setChunkFiles] = useState(0);
  const [showZipOptions, setShowZipOptions] = useState(false);

  const handleFilesReady = useCallback(async (fileItems: FileItem[]) => {
    if (!user) return;

    setResults([]);
    setError(null);
    setIsProcessing(true);
    setProcessingIndex(0);
    setProcessingTotal(fileItems.length);

    const newResults: TranscriptionResult[] = [];

    for (let i = 0; i < fileItems.length; i++) {
      const item = fileItems[i];
      setProcessingIndex(i + 1);

      try {
        // File size check for free tier (media & ZIP files)
        const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
        if (subscriptionTier !== 'pro' && !item.isFolder && item.file.size > FILE_SIZE_LIMIT) {
          newResults.push({
            fileName: item.file.name,
            text: '',
            segments: [],
            creditsUsed: 0,
            status: 'failed',
            error: `Free plan: file exceeds 10MB limit (${(item.file.size / (1024 * 1024)).toFixed(1)}MB). Upgrade to Pro for unlimited file size.`,
          });
          setResults([...newResults]);
          continue;
        }

        // ZIP file processing
        // Folder text processing (client-side, no API)
        if (item.isFolder && item.folderText) {
          newResults.push({
            fileName: `${item.file.name}/`,
            text: item.folderText,
            segments: [],
            folderFileCount: item.folderFileCount,
            creditsUsed: 0,
            status: 'completed',
          });
          setActiveResult(i);
          setResults([...newResults]);
          // Save to DB (async)
          fetch('/api/save-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: item.file.name,
              text: item.folderText,
              fileCount: item.folderFileCount,
            }),
          }).catch((err) => console.error('Save text failed:', err));
          continue;
        }

        if (item.isZip) {
          const formData = new FormData();
          formData.append('zip', item.file);
          formData.append('compress', compress.toString());
          if (chunkFiles > 0) formData.append('chunkFiles', chunkFiles.toString());

          const response = await fetch('/api/extract-zip', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to extract ZIP');
          }

          newResults.push({
            fileName: item.file.name,
            text: data.text,
            chunks: data.chunks,
            segments: data.segments || [],
            creditsUsed: 0,
            status: 'completed',
          });

          setActiveResult(i);
          setResults([...newResults]);
          continue;
        }

        // Media file processing (existing)
        const duration = item.duration || 0;
        const creditsNeeded = duration / 10;

        if (credits < creditsNeeded) {
          newResults.push({
            fileName: item.file.name,
            text: '',
            segments: [],
            creditsUsed: 0,
            status: 'failed',
            error: `Insufficient credits. Need ${creditsNeeded.toFixed(2)} credits.`,
          });
          setResults([...newResults]);
          continue;
        }

        const formData = new FormData();
        formData.append('audio', item.audioBlob || item.file, 'audio.mp3');
        formData.append('fileType', item.file.type.startsWith('video/') ? 'video' : 'audio');
        formData.append('durationSeconds', duration.toString());
        formData.append('diarize', diarize.toString());

        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to process');
        }

        newResults.push({
          fileName: item.file.name,
          text: data.text,
          segments: data.segments || [],
          creditsUsed: creditsNeeded,
          status: 'completed',
        });

        setCredits(data.creditsRemaining);
        setActiveResult(i);
      } catch (err) {
        newResults.push({
          fileName: item.file.name,
          text: '',
          segments: [],
          creditsUsed: 0,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Failed to process file',
        });
      }

      setResults([...newResults]);
    }

    setIsProcessing(false);
  }, [user, credits, subscriptionTier, diarize, compress, chunkFiles, setCredits]);

  const completedFiles = results.filter(r => r.status === 'completed');

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workspace</h1>
          <p className="text-gray-600 mt-1">Upload video, audio, or ZIP file (source code & documents) to extract text</p>
        </div>

        {/* Diarization Toggle */}
        <div className="mb-6">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={diarize}
              onChange={(e) => setDiarize(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-11 h-6 rounded-full transition-colors ${diarize ? 'bg-blue-600' : 'bg-gray-200'}`}>
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${diarize ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">Speaker Diarization</span>
            <span className="text-xs text-gray-500">Identify different speakers in the audio</span>
          </label>
        </div>

        {/* ZIP Options */}
        <div className="mb-6">
          <button
            onClick={() => setShowZipOptions(!showZipOptions)}
            className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900 mb-2"
          >
            {showZipOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>ZIP / Source Code Options</span>
          </button>
          {showZipOptions && (
            <div className="card p-4 space-y-3 bg-gray-50">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compress}
                  onChange={(e) => setCompress(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${compress ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${compress ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Compress Tokens</span>
                <span className="text-xs text-gray-500">Strip comments & collapse whitespace to reduce token count</span>
              </label>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={chunkFiles > 0}
                  onChange={(e) => setChunkFiles(e.target.checked ? 10 : 0)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Split into chunks</span>
                {chunkFiles > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">files per chunk:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={chunkFiles}
                      onChange={(e) => setChunkFiles(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <VideoUploader onFilesSelect={handleFilesReady} subscriptionTier={subscriptionTier} />
          </div>

          <div className="space-y-4">
            {/* Processing Progress */}
            {isProcessing && (
              <div className="card bg-blue-50 border border-blue-200 overflow-hidden">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="relative">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Processing files...</span>
                    <p className="text-xs text-blue-600">
                      Step {processingIndex} of {processingTotal}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out relative"
                    style={{
                      width: `${(processingIndex / processingTotal) * 100}%`,
                      background: 'linear-gradient(90deg, #3b82f6, #2563eb, #1d4ed8)',
                    }}
                  >
                    <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-gray-500">
                    {processingIndex === processingTotal
                      ? 'Finalizing...'
                      : `Processing: ${processingIndex}/${processingTotal}`}
                  </p>
                  <span className="text-xs font-semibold text-blue-700">
                    {Math.round((processingIndex / processingTotal) * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && !isProcessing && completedFiles.length > 0 && (
              <>
                <div className="card bg-green-50 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-gray-900">
                        {completedFiles.length}/{results.length} files completed
                      </span>
                    </div>
                  </div>
                </div>

                {results.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {results.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveResult(i)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          activeResult === i
                            ? r.status === 'completed'
                              ? 'bg-blue-600 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {r.status === 'completed' ? (
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 inline mr-1" />
                        )}
                        {r.fileName.length > 15 ? r.fileName.slice(0, 15) + '...' : r.fileName}
                      </button>
                    ))}
                  </div>
                )}

                {results[activeResult] && (
                  <div className="space-y-2">
                    {results[activeResult].chunks && results[activeResult].chunks!.length > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {results[activeResult].chunks!.length} chunks
                        </span>
                      </div>
                    )}
                    <ResultDisplay
                      text={results[activeResult].text}
                      segments={results[activeResult].segments}
                      fileName={results[activeResult].fileName}
                      folderFileCount={results[activeResult].folderFileCount}
                      isLoading={false}
                      error={results[activeResult].status === 'failed' ? results[activeResult].error || null : null}
                    />
                  </div>
                )}
              </>
            )}

            {results.length > 0 && !isProcessing && completedFiles.length === 0 && (
              <div className="card bg-red-50 border border-red-200">
                <div className="flex items-center space-x-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="font-medium text-gray-900">All files failed to process</span>
                </div>
                {results.map((r, i) => r.error && (
                  <p key={i} className="text-sm text-red-500 mt-2">{r.fileName}: {r.error}</p>
                ))}
              </div>
            )}

            {!isProcessing && results.length === 0 && (
              <ResultDisplay
                text={null}
                segments={[]}
                isLoading={false}
                error={null}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
