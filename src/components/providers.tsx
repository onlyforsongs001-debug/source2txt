'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useState, createContext, useContext, useEffect, ReactNode, useCallback } from 'react';
import { LanguageProvider } from '@/components/language-provider';

interface ProvidersProps {
  children: React.ReactNode;
}

const SupabaseContext = createContext<any>(null);
const ThemeContext = createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>({ theme: 'light', toggleTheme: () => {} });

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) throw new Error('useSupabase must be used within Providers');
  return context;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function Providers({ children }: ProvidersProps) {
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ));

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle('dark', saved === 'dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  const [debugErrors, setDebugErrors] = useState<string[]>([]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const msg = `${event.message} at ${event.filename}:${event.lineno}`;
      setDebugErrors(prev => [...prev.slice(-4), `Error: ${msg}`]);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);
      setDebugErrors(prev => [...prev.slice(-4), `Unhandled Promise Rejection: ${msg}`]);
    };

    // Also override console.error to show in the UI
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      setDebugErrors(prev => [...prev.slice(-4), `Console Error: ${msg}`]);
      originalConsoleError.apply(console, args);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.error = originalConsoleError;
    };
  }, []);

  return (
    <SupabaseContext.Provider value={supabase}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <LanguageProvider>
          {children}
          {debugErrors.length > 0 && (
            <div className="fixed bottom-4 right-4 z-[9999] max-w-md bg-red-900/90 text-white border border-red-500 rounded-xl p-4 shadow-2xl space-y-2 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-red-700 pb-1.5">
                <span className="font-bold text-xs uppercase tracking-wider text-red-300">HỆ THỐNG DEBUG BÁO LỖI</span>
                <button onClick={() => setDebugErrors([])} className="text-xs hover:text-red-300 font-bold bg-red-800 px-1.5 py-0.5 rounded">Xoá</button>
              </div>
              <div className="text-xs font-mono max-h-48 overflow-y-auto space-y-1 select-all">
                {debugErrors.map((err, i) => (
                  <div key={i} className="p-1.5 bg-black/40 rounded border-l-2 border-red-500 break-words">{err}</div>
                ))}
              </div>
            </div>
          )}
        </LanguageProvider>
      </ThemeContext.Provider>
    </SupabaseContext.Provider>
  );
}

export { useTranslation } from './language-provider';
