'use client';

import { useState, useEffect } from 'react';
import { useSupabase, useTheme } from '@/components/providers';
import { useTranslation } from '@/components/providers';
import { apiGet, apiPost } from '@/lib/api-client';
import { Settings, User, Bell, Shield, HelpCircle, ChevronRight, ChevronDown, Check, Loader2, Mail, ExternalLink, Globe, Moon, Sun, Clock, FileText, History } from 'lucide-react';

interface SettingsTabProps {
  user: any;
  credits?: number;
  subscriptionTier?: string;
}

type ActiveSection = 'none' | 'account' | 'language' | 'appearance' | 'notifications' | 'privacy' | 'history' | 'support';

export function SettingsTab({ user, credits = 0, subscriptionTier }: SettingsTabProps) {
  const supabase = useSupabase();
  const { t, locale, setLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<ActiveSection>('none');

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [notifCompletion, setNotifCompletion] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(false);
  const [notifPromos, setNotifPromos] = useState(true);
  const [isSavingNotif, setIsSavingNotif] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);

  const [storeHistory, setStoreHistory] = useState(true);
  const [optOutTraining, setOptOutTraining] = useState(true);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [privacySuccess, setPrivacySuccess] = useState(false);

  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSavingSupport] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  const [jobHistory, setJobHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedNotifCompletion = localStorage.getItem('notif_completion');
      const savedNotifWeekly = localStorage.getItem('notif_weekly');
      const savedNotifPromos = localStorage.getItem('notif_promos');
      const savedStoreHistory = localStorage.getItem('privacy_store_history');
      const savedOptOutTraining = localStorage.getItem('privacy_opt_out');

      if (savedNotifCompletion !== null) setNotifCompletion(savedNotifCompletion === 'true');
      if (savedNotifWeekly !== null) setNotifWeekly(savedNotifWeekly === 'true');
      if (savedNotifPromos !== null) setNotifPromos(savedNotifPromos === 'true');
      if (savedStoreHistory !== null) setStoreHistory(savedStoreHistory === 'true');
      if (savedOptOutTraining !== null) setOptOutTraining(savedOptOutTraining === 'true');
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'history') {
      fetchJobHistory();
    }
  }, [activeSection]);

  const fetchJobHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await apiGet('/api/credits', { history: 'true' });
      if (res.ok) {
        const data = await res.json();
        setJobHistory(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch job history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingAccount(true);
    setAccountSuccess(false);
    setAccountError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });

      if (error) throw error;
      setAccountSuccess(true);
      setTimeout(() => setAccountSuccess(false), 3000);
    } catch (err: any) {
      setAccountError(err.message || 'Failed to update account settings');
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingNotif(true);
    setNotifSuccess(false);

    setTimeout(() => {
      localStorage.setItem('notif_completion', notifCompletion.toString());
      localStorage.setItem('notif_weekly', notifWeekly.toString());
      localStorage.setItem('notif_promos', notifPromos.toString());
      setIsSavingNotif(false);
      setNotifSuccess(true);
      setTimeout(() => setNotifSuccess(false), 3000);
    }, 600);
  };

  const handleSavePrivacy = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrivacy(true);
    setPrivacySuccess(false);

    setTimeout(() => {
      localStorage.setItem('privacy_store_history', storeHistory.toString());
      localStorage.setItem('privacy_opt_out', optOutTraining.toString());
      setIsSavingPrivacy(false);
      setPrivacySuccess(true);
      setTimeout(() => setPrivacySuccess(false), 3000);
    }, 600);
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSupport(true);
    setSupportSuccess(false);
    setSupportError(null);

    try {
      const res = await apiPost('/api/support', { subject: supportSubject, message: supportMessage });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send');
      }
      setSupportSuccess(true);
      setSupportSubject('');
      setSupportMessage('');
      setTimeout(() => setSupportSuccess(false), 4000);
    } catch (err: any) {
      setSupportError(err.message || 'Failed to send support ticket');
    } finally {
      setIsSavingSupport(false);
    }
  };

  const toggleSection = (section: ActiveSection) => {
    setActiveSection(activeSection === section ? 'none' : section);
  };

  const realTier = subscriptionTier || 'free';

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings className="w-8 h-8 text-blue-600" />
            <span>Settings</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure your account and preferences</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Profile</h2>
          <div className="flex items-center space-x-4">
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center border-2 border-blue-200 dark:border-blue-700">
                <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div>
              <p className="font-bold text-xl text-gray-900 dark:text-gray-100">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{user?.email}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  realTier === 'pro' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {realTier === 'pro' ? 'Pro Account' : 'Free Account'}
                </span>
                <span className="text-xs text-gray-400">({credits.toFixed(0)} credits)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* 1. Account Settings */}
          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('account')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 text-base">Account Settings</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Update your name and profile information</p>
                </div>
              </div>
              {activeSection === 'account' ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>

            {activeSection === 'account' && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                <form onSubmit={handleUpdateAccount} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email (ReadOnly)</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    {accountSuccess && (
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Account updated!
                      </p>
                    )}
                    {accountError && (
                      <p className="text-sm font-semibold text-red-600">{accountError}</p>
                    )}
                    {!accountSuccess && !accountError && <div />}
                    <button
                      type="submit"
                      disabled={isUpdatingAccount}
                      className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {isUpdatingAccount && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* 2. Language */}
          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('language')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 text-base">Language</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Choose your preferred language</p>
                </div>
              </div>
              {activeSection === 'language' ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>

            {activeSection === 'language' && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                <div className="space-y-3">
                  <button
                    onClick={() => setLocale('en')}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      locale === 'en'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-600'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🇬🇧</span>
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-gray-100">English</p>
                        <p className="text-xs text-gray-500">English interface</p>
                      </div>
                    </div>
                    {locale === 'en' && <Check className="w-5 h-5 text-blue-600" />}
                  </button>

                  <button
                    onClick={() => setLocale('vi')}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      locale === 'vi'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-600'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🇻🇳</span>
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-gray-100">Tiếng Việt</p>
                        <p className="text-xs text-gray-500">Giao diện tiếng Việt</p>
                      </div>
                    </div>
                    {locale === 'vi' && <Check className="w-5 h-5 text-blue-600" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Appearance */}
          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('appearance')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                  {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 text-base">Appearance</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Toggle dark/light mode</p>
                </div>
              </div>
              {activeSection === 'appearance' ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>

            {activeSection === 'appearance' && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                <div className="space-y-3">
                  <button
                    onClick={() => { if (theme !== 'light') toggleTheme(); }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-600'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Sun className="w-5 h-5 text-yellow-500" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-gray-100">Light Mode</p>
                        <p className="text-xs text-gray-500">Light background, dark text</p>
                      </div>
                    </div>
                    {theme === 'light' && <Check className="w-5 h-5 text-blue-600" />}
                  </button>

                  <button
                    onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-600'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Moon className="w-5 h-5 text-indigo-400" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-gray-100">Dark Mode</p>
                        <p className="text-xs text-gray-500">Dark background, light text</p>
                      </div>
                    </div>
                    {theme === 'dark' && <Check className="w-5 h-5 text-blue-600" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Notifications */}
          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('notifications')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 text-base">Notifications</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Configure email and report preferences</p>
                </div>
              </div>
              {activeSection === 'notifications' ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>

            {activeSection === 'notifications' && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                <form onSubmit={handleSaveNotifications} className="space-y-4">
                  <div className="space-y-3">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifCompletion}
                        onChange={(e) => setNotifCompletion(e.target.checked)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Job Completion Emails</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Get notified when your video/audio transcriptions are ready</p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifWeekly}
                        onChange={(e) => setNotifWeekly(e.target.checked)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Weekly Usage Report</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Receive a weekly summary of credits spent and minutes transcribed</p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifPromos}
                        onChange={(e) => setNotifPromos(e.target.checked)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">News & Promotions</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Stay updated on new features, models, and exclusive trial credits</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {notifSuccess && (
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Preferences saved!
                      </p>
                    )}
                    {!notifSuccess && <div />}
                    <button
                      type="submit"
                      disabled={isSavingNotif}
                      className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {isSavingNotif && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Save Preferences</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* 5. Privacy & Security */}
          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('privacy')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 text-base">Privacy & Security</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Manage data retention and AI model privacy settings</p>
                </div>
              </div>
              {activeSection === 'privacy' ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>

            {activeSection === 'privacy' && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                <form onSubmit={handleSavePrivacy} className="space-y-4">
                  <div className="space-y-3">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={storeHistory}
                        onChange={(e) => setStoreHistory(e.target.checked)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Store Extraction History</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Keep a record of your parsed files & folders on our secure database</p>
                      </div>
                    </label>

                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={optOutTraining}
                        onChange={(e) => setOptOutTraining(e.target.checked)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Opt-out of AI Training Data</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Ensure your uploaded documents, files, and audio are never used for training future AI models</p>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {privacySuccess && (
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Privacy settings saved!
                      </p>
                    )}
                    {!privacySuccess && <div />}
                    <button
                      type="submit"
                      disabled={isSavingPrivacy}
                      className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {isSavingPrivacy && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Save Privacy Settings</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* 6. Processing History */}
          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('history')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 text-base">Processing History</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">View your recent file processing activity</p>
                </div>
              </div>
              {activeSection === 'history' ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>

            {activeSection === 'history' && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : jobHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No processing history yet</p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Upload a file to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {jobHistory.map((job: any) => (
                      <div key={job.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-3 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{job.file_name}</p>
                            <p className="text-xs text-gray-500">{formatDate(job.created_at)}</p>
                          </div>
                        </div>
                        <span className={`flex-shrink-0 ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                          job.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          job.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. Help & Support */}
          <div className="card p-0 overflow-hidden border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('support')}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 text-base">Help & Support</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Open a ticket or contact support</p>
                </div>
              </div>
              {activeSection === 'support' ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>

            {activeSection === 'support' && (
              <div className="p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300 flex items-start space-x-2">
                  <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Contact Email:</span> support@source2txt.com
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Average response time: &lt; 24 hours</p>
                  </div>
                </div>

                <form onSubmit={handleSendSupport} className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                    <input
                      type="text"
                      value={supportSubject}
                      onChange={(e) => setSupportSubject(e.target.value)}
                      placeholder="How can we help?"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Message</label>
                    <textarea
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Please describe your issue or feedback in detail..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-gray-200"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {supportSuccess && (
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Message sent successfully!
                      </p>
                    )}
                    {supportError && (
                      <p className="text-sm font-semibold text-red-600">{supportError}</p>
                    )}
                    {!supportSuccess && !supportError && <div />}
                    <button
                      type="submit"
                      disabled={isSendingSupport}
                      className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {isSendingSupport && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Send Ticket</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
