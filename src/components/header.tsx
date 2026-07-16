'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from '@/components/providers';
import { Menu, X, Globe, User, Wallet, LogOut } from 'lucide-react';

interface HeaderProps {
  user?: {
    email?: string;
    user_metadata?: {
      avatar_url?: string;
      full_name?: string;
    };
  } | null;
  credits?: number;
  onLogout?: () => Promise<void>;
}

export function Header({ user, credits = 0, onLogout }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t, locale, setLocale } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'vi' : 'en');
  };

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    } else {
      router.push('/');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div
            className="flex items-center cursor-pointer"
            onClick={() => router.push('/')}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-2">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Source2Txt</span>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Switch Language"
            >
              <Globe className="w-5 h-5" />
            </button>

            {user ? (
              <>
                {/* Credits Display */}
                <div className="hidden md:flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg">
                  <Wallet className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">{credits.toFixed(2)} credits</span>
                </div>

                {/* User Menu */}
                <div className="flex items-center space-x-2">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full cursor-pointer"
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                    />
                  ) : (
                    <button
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"
                    >
                      <User className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>

                {/* Mobile Credits */}
                <div className="md:hidden flex items-center space-x-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                  <Wallet className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">{credits.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <a
                href="/login"
                className="btn-primary text-sm"
              >
                {t('auth.login')}
              </a>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-700"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden absolute top-16 right-4 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-4">
              <nav className="flex flex-col space-y-3 px-4">
                {user && (
                  <>
                    <div className="flex items-center space-x-2 text-sm border-b border-gray-200 pb-3 mb-3">
                      <Wallet className="w-4 h-4 text-blue-600" />
                      <span>{credits.toFixed(2)} credits</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 text-sm text-gray-600 hover:text-red-500 w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t('auth.logout')}</span>
                    </button>
                  </>
                )}

                {/* Mobile Language Toggle */}
                <button
                  onClick={toggleLanguage}
                  className="flex items-center space-x-2 text-sm text-gray-600 border-t border-gray-200 pt-3 mt-3"
                >
                  <Globe className="w-4 h-4" />
                  <span>{locale === 'en' ? 'Tiếng Việt' : 'English'}</span>
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
