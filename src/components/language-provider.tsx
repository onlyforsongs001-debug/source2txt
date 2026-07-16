'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Locale = 'en' | 'vi';

interface Translations {
  [key: string]: {
    en: string;
    vi: string;
  };
}

const translations: Translations = {
  'app.title': { en: 'Source2Txt', vi: 'Source2Txt' },
  'app.subtitle': { 
    en: 'Convert video, audio, images, ZIP to optimized text for AI', 
    vi: 'Chuyển đổi video, âm thanh, ảnh, ZIP thành văn bản tối ưu cho AI' 
  },
  'upload.zipTitle': { en: 'Upload Files or ZIP', vi: 'Tải lên File hoặc ZIP' },
  'upload.supportedFormatsZip': { 
    en: 'Supported: video, audio, ZIP (source code, images, documents)', 
    vi: 'Hỗ trợ: video, âm thanh, ZIP (mã nguồn, ảnh, tài liệu)' 
  },
  'nav.dashboard': { en: 'Dashboard', vi: 'Bảng điều khiển' },
  'nav.pricing': { en: 'Pricing', vi: 'Giá cả' },
  'auth.login': { en: 'Login', vi: 'Đăng nhập' },
  'auth.logout': { en: 'Logout', vi: 'Đăng xuất' },
  'auth.loginWithGoogle': { en: 'Login with Google', vi: 'Đăng nhập bằng Google' },
  'upload.title': { en: 'Upload Video or Audio', vi: 'Tải lên Video hoặc Âm thanh' },
  'upload.dropzone': { 
    en: 'Drag & drop your file here, or click to browse', 
    vi: 'Kéo & thả file vào đây, hoặc click để chọn' 
  },
  'upload.supportedFormats': { 
    en: 'Supported formats: MP4, MOV, AVI, MP3, WAV, ZIP, PNG, JPG', 
    vi: 'Định dạng hỗ trợ: MP4, MOV, AVI, MP3, WAV, ZIP, PNG, JPG' 
  },
  'upload.converting': { en: 'Converting video to audio...', vi: 'Đang chuyển đổi video sang âm thanh...' },
  'upload.processing': { en: 'Processing...', vi: 'Đang xử lý...' },
  'upload.processingFile': { en: 'Processing: ', vi: 'Đang xử lý: ' },
  'result.title': { en: 'Transcription Result', vi: 'Kết quả chuyển văn bản' },
  'result.copy': { en: 'Copy to clipboard', vi: 'Sao chép vào clipboard' },
  'result.download': { en: 'Download as Markdown', vi: 'Tải xuống dạng Markdown' },
  'credits.insufficient': { 
    en: 'Insufficient credits. Please top up.', 
    vi: 'Không đủ credits. Vui lòng nạp thêm.' 
  },
  'credits.add': { en: 'Add Credits', vi: 'Nạp Credits' },
  'pricing.title': { en: 'Pricing', vi: 'Bảng giá' },
  'pricing.per10min': { en: '$0.20 per 10 minutes', vi: '$0.20 cho 10 phút' },
  'pricing.pro': { en: 'Pro $9/mo - 600 min video + unlimited ZIP', vi: 'Pro $9/th - 600p video + ZIP không giới hạn' },
  'pricing.freeTier': { en: 'Free: 5 min video + 50 ZIP/folder per day', vi: 'Miễn phí: 5p video + 50 ZIP/folder mỗi ngày' },
  'processing.processing': { en: 'Processing...', vi: 'Đang xử lý...' },
  'processing.completed': { en: 'Completed', vi: 'Hoàn thành' },
  'processing.failed': { en: 'Failed', vi: 'Thất bại' },
  'upload.ready': { en: 'ready', vi: 'sẵn sàng' },
  'upload.clearAll': { en: 'Clear all', vi: 'Xóa tất cả' },
  'upload.processingBatch': { en: 'Processing batch...', vi: 'Đang xử lý hàng loạt...' },
  'upload.someFilesFailed': { en: 'Some files failed to process', vi: 'Một số file xử lý thất bại' },
  'upload.readyToProcess': { en: 'Ready to process', vi: 'Sẵn sàng xử lý' },
  'upload.diarization': { en: 'Speaker Diarization', vi: 'Phân biệt người nói' },
  'upload.diarizationDesc': { en: 'Identify different speakers in the audio', vi: 'Nhận diện các người nói khác nhau' },
  'export.markdown': { en: 'Markdown', vi: 'Markdown' },
  'export.srt': { en: 'SRT (Subtitles)', vi: 'SRT (Phụ đề)' },
  'export.json': { en: 'JSON', vi: 'JSON' },
  'export.pdf': { en: 'PDF', vi: 'PDF' },
  'export.docx': { en: 'DOCX', vi: 'DOCX' },
  'summary.title': { en: 'AI Summarize', vi: 'Tóm tắt AI' },
  'summary.short': { en: 'Short', vi: 'Ngắn' },
  'summary.medium': { en: 'Medium', vi: 'Trung bình' },
  'summary.detailed': { en: 'Detailed', vi: 'Chi tiết' },
  'summary.button': { en: 'Summarize', vi: 'Tóm tắt' },
  'summary.processing': { en: 'Summarizing...', vi: 'Đang tóm tắt...' },
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved) setLocale(saved);
  }, []);

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  const t = (key: string, fallback?: string): string => {
    const translation = translations[key];
    if (!translation) return fallback || key;
    return translation[locale];
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return context;
}