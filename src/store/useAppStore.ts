import { create } from 'zustand';

interface ProcessingState {
  selectedFile: File | null;
  audioBlob: Blob | null;
  isProcessing: boolean;
  resultText: string | null;
  error: string | null;
  progress: number;
}

interface AppStore extends ProcessingState {
  setSelectedFile: (file: File | null) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setIsProcessing: (processing: boolean) => void;
  setResultText: (text: string | null) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: number) => void;
  reset: () => void;
}

const initialState: ProcessingState = {
  selectedFile: null,
  audioBlob: null,
  isProcessing: false,
  resultText: null,
  error: null,
  progress: 0,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setSelectedFile: (file) => set({ selectedFile: file }),
  setAudioBlob: (blob) => set({ audioBlob: blob }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setResultText: (text) => set({ resultText: text }),
  setError: (error) => set({ error }),
  setProgress: (progress) => set({ progress }),
  reset: () => set(initialState),
}));