'use client';

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from '@/components/providers';
import { Upload, File, X, Loader2, FileVideo, FileAudio, Trash2, CheckCircle, Archive, Folder } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const TEXT_EXTENSIONS = new Set([
  '.txt','.md','.csv','.json','.xml','.yaml','.yml','.env',
  '.js','.ts','.jsx','.tsx','.py','.rb','.go','.rs','.java','.kt','.swift',
  '.c','.cpp','.h','.hpp','.cs','.php','.pl','.sh','.bash','.zsh',
  '.css','.scss','.sass','.less','.html','.htm','.svg',
  '.sql','.graphql','.proto','.toml','.ini','.cfg','.conf',
  '.log','.vue','.svelte','.astro','.mjs','.cjs','.mts','.cts',
  '.bat','.ps','.ps1','.psm1','.psd1',
]);

const SKIP_PATTERNS = [
  'node_modules/','.git/','dist/','build/','.next/','out/','coverage/',
  '__pycache__/','.venv/','venv/','.env/',
  '.idea/','.vscode/','.DS_Store','Thumbs.db',
  'package-lock.json','yarn.lock','pnpm-lock.yaml',
];

interface FileItem {
  file: File;
  audioBlob?: Blob;
  duration?: number;
  isZip?: boolean;
  isFolder?: boolean;
  folderText?: string;
  folderFileCount?: number;
  processingMessage?: string;
  status: 'pending' | 'converting' | 'ready' | 'error';
  progress: number;
  error?: string;
}

interface VideoUploaderProps {
  onFilesSelect?: (files: FileItem[]) => void;
  subscriptionTier?: string;
}

const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

export function VideoUploader({ onFilesSelect, subscriptionTier }: VideoUploaderProps) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const setFolderInputRef = useCallback((el: HTMLInputElement | null) => {
    if (el) {
      (el as any).webkitdirectory = true;
      (el as any).directory = true;
    }
    (folderInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
  }, []);

  const loadFFmpeg = async () => {
    if (ffmpegRef.current?.loaded) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on('progress', ({ progress }) => {
      setBatchProgress(Math.round(progress * 100));
    });

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    } catch (err) {
      ffmpegRef.current = null;
      throw new Error('Failed to load FFmpeg. Please check your internet connection and try again.');
    }

    return ffmpeg;
  };

  const convertVideoToAudio = async (file: File): Promise<Blob> => {
    const ffmpeg = await loadFFmpeg();

    const inputName = `input.${file.name.split('.').pop()}`;
    const outputName = 'output.mp3';

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', outputName]);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data as BlobPart], { type: 'audio/mpeg' });

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return blob;
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const objectUrl = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(objectUrl);
        resolve(video.duration);
      };

      video.onerror = () => {
        window.URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load video metadata'));
      };

      video.src = objectUrl;
    });
  };

  const processFiles = async (newFiles: File[]) => {
    setIsBatchProcessing(true);
    setBatchProgress(0);

    const fileItems: FileItem[] = newFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
    }));

    setFiles(fileItems);

    for (let i = 0; i < fileItems.length; i++) {
      const item = fileItems[i];
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'converting', progress: 0 } : f));

      try {
        const isVideo = item.file.type.startsWith('video/');
        const isAudio = item.file.type.startsWith('audio/');

        if (!isVideo && !isAudio) {
          throw new Error('Unsupported file type');
        }

        let audioBlob: Blob;
        let duration: number;

        if (isVideo) {
          duration = await getVideoDuration(item.file);
          audioBlob = await convertVideoToAudio(item.file);
        } else {
          duration = await getAudioDuration(item.file);
          audioBlob = item.file;
        }

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'ready', progress: 100, audioBlob, duration } : f));
      } catch (err) {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: err instanceof Error ? err.message : 'Failed to process' } : f));
      }

      setBatchProgress(Math.round(((i + 1) / fileItems.length) * 100));
    }

    setIsBatchProcessing(false);
    onFilesSelect?.(fileItems.filter(f => f.status === 'ready'));
  };

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      const objectUrl = URL.createObjectURL(file);

      audio.onloadedmetadata = () => {
        window.URL.revokeObjectURL(objectUrl);
        resolve(audio.duration);
      };

      audio.onerror = () => {
        window.URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load audio metadata'));
      };

      audio.src = objectUrl;
    });
  };

  async function traverseDirectory(entry: FileSystemDirectoryEntry): Promise<File[]> {
    const results: File[] = [];
    const reader = entry.createReader();

    const readAllEntries = async (): Promise<any[]> => {
      const batch = await new Promise<any[]>((resolve) => {
        reader.readEntries((entries: any) => resolve(entries));
      });
      if (batch.length === 0) return [];
      const rest = await readAllEntries();
      return [...batch, ...rest];
    };

    const allEntries = await readAllEntries();
    for (const child of allEntries) {
      if (child.isDirectory) {
        // Skip unwanted directories early
        const dirPath = child.fullPath ? child.fullPath.replace(/^\//, '') : child.name;
        if (shouldSkipPath(dirPath + '/')) {
          continue;
        }
        const subFiles = await traverseDirectory(child as FileSystemDirectoryEntry);
        results.push(...subFiles);
      } else if (child.isFile) {
        const file = await new Promise<File>((res) => (child as FileSystemFileEntry).file(res));
        const relativePath = child.fullPath ? child.fullPath.replace(/^\//, '') : child.name;
        // Skip unwanted files
        if (shouldSkipPath(relativePath)) continue;
        (file as any).relativePath = relativePath;
        results.push(file);
      }
    }
    return results;
  }

  const shouldSkipPath = (filePath: string): boolean => {
    const lower = filePath.toLowerCase();
    for (const p of SKIP_PATTERNS) {
      if (p.endsWith('/') && (lower.startsWith(p) || lower.includes('/' + p))) return true;
      if (p.endsWith('/')) continue;
      if (lower === p) return true;
      if (lower.endsWith('/' + p)) return true;
    }
    return false;
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const entries = Array.from(e.target.files || []);
      console.log(`Folder selected: ${entries.length} files`);
      if (entries.length === 0) return;

      // Log for debugging
      console.log(`Folder selected: ${entries.length} files total`);
      console.log('First file:', (entries[0] as any).relativePath || entries[0]?.webkitRelativePath || 'no path');
      console.log('File names:', entries.slice(0, 5).map(f => f.name).join(', '));

      // Reset the input so re-selecting same folder triggers change
      if (folderInputRef.current) folderInputRef.current.value = '';

      // Get folder name from first file's path
      const firstPath = (entries[0] as any).relativePath || entries[0]?.webkitRelativePath || entries[0]?.name || 'folder';
      const folderName = firstPath.includes('/') ? firstPath.split('/')[0] : firstPath;

      // Filter text files, skip patterns
      const textFiles = entries.filter(f => {
        const path = (f as any).relativePath || f.webkitRelativePath || f.name;
        if (shouldSkipPath(path)) return false;
        const parts = f.name.split('.');
        if (parts.length < 2) return false;
        const ext = '.' + parts.pop()!.toLowerCase();
        return TEXT_EXTENSIONS.has(ext);
      });

      console.log(`Found ${textFiles.length} text files after filtering.`);

      // Show feedback even if no text files
      if (textFiles.length === 0) {
        console.warn(`No text files found in folder`);
        return;
      }

      console.log(`Found ${textFiles.length} text files out of ${entries.length} total`);

      // Create placeholder item immediately
      // @ts-ignore
      const placeHolder = new File([''], folderName, { type: 'text/plain' });
      setFiles(prev => [...prev, {
        file: placeHolder,
        isFolder: true,
        folderFileCount: textFiles.length,
        status: 'converting',
        progress: 0,
        processingMessage: `Reading 1/${textFiles.length}...`,
      }]);

      // Read all files with real-time progress
      let combined = `# Source2Txt - Folder Extraction\nSource: ${folderName}\nFiles: ${textFiles.length} text files out of ${entries.length} total\n---\n\n`;

      for (let i = 0; i < textFiles.length; i++) {
        const file = textFiles[i];
        const pct = Math.round(((i + 1) / textFiles.length) * 100);
        const displayPath = (file as any).relativePath || file.webkitRelativePath || file.name;

        setFiles(prev => prev.map((f, idx) =>
          idx === prev.length - 1 ? { ...f, progress: pct, processingMessage: `Reading ${i + 1}/${textFiles.length}: ${displayPath}` } : f
        ));

        try {
          const text = await file.text();
          combined += `\n${'='.repeat(60)}\nFile: ${displayPath}\n${'='.repeat(60)}\n${text}\n`;
        } catch (readErr) {
          console.warn(`Could not read ${displayPath}:`, readErr);
          // skip unreadable files
        }
      }

      // Mark as ready
      // @ts-ignore
      const folderFile = new File([combined], folderName, { type: 'text/plain' });

      setFiles(prev => prev.map((f, idx) =>
        idx === prev.length - 1 ? { ...f, file: folderFile, folderText: combined, status: 'ready' as const, progress: 100, processingMessage: undefined } : f
      ));

      onFilesSelect?.([{
        file: folderFile,
        folderText: combined,
        folderFileCount: textFiles.length,
        isFolder: true,
        status: 'ready' as const,
        progress: 100,
      }]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : (typeof err === 'string' ? err : String(err) || 'Failed to process folder');
      console.error('Folder processing error:', errMsg, err);
      setFiles(prev => prev.map((f, idx) =>
        idx === prev.length - 1 ? { ...f, status: 'error' as const, error: errMsg } : f
      ));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(f => 
      f.type.startsWith('video/') || f.type.startsWith('audio/') ||
      f.type === 'application/zip' || f.type === 'application/x-zip-compressed' ||
      f.name.toLowerCase().endsWith('.zip')
    );
    
    if (validFiles.length === 0) return;
    
    // File size check for free tier
    const isFree = subscriptionTier !== 'pro';
    const oversized: FileItem[] = [];
    const filtered = validFiles.filter(f => {
      if (isFree && f.size > FILE_SIZE_LIMIT) {
        oversized.push({
          file: f,
          status: 'error' as const,
          progress: 0,
          error: `Free plan: file > 10MB (${(f.size / (1024 * 1024)).toFixed(1)}MB). Upgrade to Pro.`,
        });
        return false;
      }
      return true;
    });

    if (oversized.length > 0) {
      setFiles(prev => [...prev, ...oversized]);
    }
    
    if (filtered.length === 0) return;
    
    // Separate ZIP files (no ffmpeg needed)
    const zipFiles = filtered.filter(f =>
      f.type === 'application/zip' || f.type === 'application/x-zip-compressed' ||
      f.name.toLowerCase().endsWith('.zip')
    );
    const mediaFiles = filtered.filter(f => !zipFiles.includes(f));
    
    if (zipFiles.length > 0) {
      const zipItems: FileItem[] = zipFiles.map(file => ({
        file,
        status: 'ready' as const,
        progress: 100,
        isZip: true,
      }));
      setFiles(prev => [...prev, ...zipItems]);
      const allReady = [...(mediaFiles.length > 0 ? [] : []), ...zipItems];
      // If only ZIP files, fire immediately
      if (mediaFiles.length === 0) {
        onFilesSelect?.(zipItems);
      }
    }
    
    if (mediaFiles.length > 0) {
      processFiles(mediaFiles);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    if (items.length === 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) handleFiles(droppedFiles);
      return;
    }

    const droppedDirectories: FileSystemDirectoryEntry[] = [];
    const droppedFiles: FileSystemFileEntry[] = [];

    for (const item of items) {
      const entry = item.webkitGetAsEntry();
      if (!entry) continue;
      if (entry.isDirectory) {
        droppedDirectories.push(entry as FileSystemDirectoryEntry);
      } else if (entry.isFile) {
        droppedFiles.push(entry as FileSystemFileEntry);
      }
    }

    // Process dropped directories (folder extraction + media inside)
    for (const dirEntry of droppedDirectories) {
      const allFiles = await traverseDirectory(dirEntry);
      if (allFiles.length === 0) continue;

      // Separate text files from media/zip files
      const textFiles: File[] = [];
      const mediaFiles: File[] = [];

      for (const f of allFiles) {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        const isMedia = f.type.startsWith('video/') || f.type.startsWith('audio/') ||
                        f.type === 'application/zip' || f.type === 'application/x-zip-compressed' ||
                        f.name.toLowerCase().endsWith('.zip');
        if (TEXT_EXTENSIONS.has(ext)) {
          textFiles.push(f);
        } else if (isMedia) {
          mediaFiles.push(f);
        }
        // Non-text, non-media files are silently skipped
      }

      // Process text files as folder extraction
      if (textFiles.length > 0) {
        const syntheticEvent = { target: { files: textFiles } } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFolderChange(syntheticEvent);
      }

      // Process media files normally
      if (mediaFiles.length > 0) {
        handleFiles(mediaFiles);
      }
    }

    // Process individual dropped files (not from a folder)
    if (droppedFiles.length > 0) {
      const files = await Promise.all(
        droppedFiles.map(entry => new Promise<File>((resolve) => entry.file(resolve)))
      );
      handleFiles(files);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    handleFiles(newFiles);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileIcon = (type: string, name: string) => {
    if (name.toLowerCase().endsWith('.zip') || type === 'application/zip')
      return <Archive className="w-5 h-5 text-orange-400" />;
    return type.startsWith('video/') ? <FileVideo className="w-5 h-5 text-blue-400" /> : <FileAudio className="w-5 h-5 text-green-400" />;
  };

  const readyFiles = files.filter(f => f.status === 'ready');
  const hasErrors = files.some(f => f.status === 'error');
  const isProcessing = isBatchProcessing || files.some(f => f.status === 'converting');

  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('upload.title')}</h2>
        {files.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {readyFiles.length}/{files.length} {t('upload.ready')}
            </span>
            {readyFiles.length > 0 && (
              <button
                onClick={clearAllFiles}
                disabled={isProcessing}
                className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 inline mr-1" />
                {t('upload.clearAll')}
              </button>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,.zip"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />
      <input
        ref={setFolderInputRef}
        type="file"
        onChange={handleFolderChange}
        className="hidden"
      />

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && files.length === 0 && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
          ${files.length > 0 ? 'cursor-default' : ''}
        `}
      >
        {files.length === 0 ? (
          <div className="space-y-4">
            <Upload className="w-12 h-12 mx-auto text-gray-400" />
            <div>
              <p className="text-lg font-medium mb-2 text-gray-900">{t('upload.dropzone')}</p>
              <p className="text-sm text-gray-500">{t('upload.supportedFormats')}</p>
            </div>
            <p className="text-xs text-gray-400">Drag & drop files here</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto text-left">
            {files.map((item, index) => (
              <div
                key={index}
                className={`
                  flex items-center space-x-4 p-3 rounded-lg bg-gray-50 border
                  ${item.status === 'error' ? 'border-red-300 bg-red-50' : 'border-gray-200'}
                  ${item.status === 'ready' ? 'border-green-300 bg-green-50' : ''}
                `}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                  {item.isFolder ? (
                    <Archive className="w-5 h-5 text-orange-400" />
                  ) : item.status === 'converting' ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  ) : item.status === 'ready' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : item.status === 'error' ? (
                    <X className="w-5 h-5 text-red-500" />
                  ) : (
                    getFileIcon(item.file.type, item.file.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {item.isFolder ? `📁 ${item.file.name}/` : item.file.name}
                  </p>
                  <div className="flex items-center space-x-3 text-sm text-gray-500">
                    {item.isFolder ? (
                      <span>{item.folderFileCount} files</span>
                    ) : (
                      <span>{formatFileSize(item.file.size)}</span>
                    )}
                    {item.duration && <span>{formatDuration(item.duration)}</span>}
                    {item.status === 'converting' && (
                      <span className="text-blue-600">{item.progress}%</span>
                    )}
                    {item.status === 'error' && (
                      <span className="text-red-500">{item.error}</span>
                    )}
                  </div>
                  {item.isFolder && item.status === 'converting' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-blue-700 flex items-center">
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          Extracting files...
                        </span>
                        <span className="text-blue-600 font-bold">{item.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                        <div
                          className="h-full rounded-full transition-all duration-300 ease-out relative"
                          style={{
                            width: `${item.progress}%`,
                            background: item.progress < 50
                              ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                              : item.progress < 90
                                ? 'linear-gradient(90deg, #2563eb, #3b82f6)'
                                : 'linear-gradient(90deg, #059669, #10b981)',
                          }}
                        >
                          <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
                        </div>
                      </div>
                      {item.processingMessage && (
                        <div className="flex items-center space-x-1 text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                          <span className="truncate">{item.processingMessage}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-1 text-xs text-gray-400">
                        <div className="w-1 h-1 bg-gray-400 rounded-full" />
                        <span>Processing file {Math.round(item.progress * (item.folderFileCount || 1) / 100)} of {item.folderFileCount}</span>
                      </div>
                    </div>
                  )}
                  {!item.isFolder && item.status === 'converting' && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mt-1">
                      <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  disabled={isProcessing}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-50 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isBatchProcessing && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-xl">
            <div className="text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
              <p className="text-lg font-medium text-gray-900">{t('upload.processingBatch')}</p>
              <div className="w-64 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${batchProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{batchProgress}%</p>
            </div>
          </div>
        )}
      </div>

      {/* Browse Buttons */}
      {files.length === 0 && (
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary text-sm"
          >
            Browse Files
          </button>
          <button
            onClick={async () => {
              try {
                if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
                  const dirHandle = await (window as any).showDirectoryPicker();
                  const allFiles: File[] = [];
                  const collectFiles = async (handle: any, path: string) => {
                    for await (const [name, entry] of handle.entries()) {
                      if (entry.kind === 'directory') {
                        await collectFiles(entry, `${path}/${name}`);
                      } else {
                        const file = await entry.getFile();
                        (file as any).relativePath = `${path}/${name}`;
                        allFiles.push(file);
                      }
                    }
                  };
                  await collectFiles(dirHandle, dirHandle.name);
                  if (allFiles.length > 0) {
                    const syntheticEvent = { target: { files: allFiles } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleFolderChange(syntheticEvent);
                    return;
                  }
                }
              } catch (err) {
                if ((err as any)?.name === 'AbortError' || (err as any)?.name === 'SecurityError') return;
              }
              folderInputRef.current?.click();
            }}
            className="btn-secondary text-sm"
          >
            Browse Folder
          </button>
        </div>
      )}

      {/* Error Message */}
      {hasErrors && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {t('upload.someFilesFailed')}
        </div>
      )}

      {/* Ready Files Summary */}
      {readyFiles.length > 0 && !isProcessing && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="font-medium text-gray-900 mb-2">{t('upload.readyToProcess')} ({readyFiles.length})</p>
          <div className="flex flex-wrap gap-2">
            {readyFiles.map((item, i) => (
              <span key={i} className="px-2 py-1 bg-white rounded text-xs text-gray-700 border border-blue-200">
                {item.isFolder ? `📁 ${item.file.name}/ (${item.folderFileCount} files)` :
                 item.isZip ? `📦 ${item.file.name}` :
                 `${item.file.name} (${formatDuration(item.duration || 0)})`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
