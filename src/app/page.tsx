'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { apiGet } from '@/lib/api-client';
import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { WorkspaceTab } from '@/components/workspace-tab';
import { UsageTab } from '@/components/usage-tab';
import { SettingsTab } from '@/components/settings-tab';
import { useRouter } from 'next/navigation';

type TabType = 'workspace' | 'usage' | 'settings';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState(0);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('workspace');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchCredits(session.user.id);
      }
      setIsLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchCredits(session.user.id);
      } else {
        setUser(null);
        setCredits(0);
        setSubscriptionTier('free');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const fetchCredits = async (userId: string) => {
    try {
      const response = await apiGet('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setCredits(data.credits);
        setSubscriptionTier(data.subscription_tier);
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} credits={credits} onLogout={handleLogout} />
      
      <div className="flex pt-16">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} credits={credits} />
        
        <main className="flex-1 ml-64">
          {user ? (
            <>
              {activeTab === 'workspace' && (
                <WorkspaceTab user={user} credits={credits} setCredits={setCredits} subscriptionTier={subscriptionTier} />
              )}
              {activeTab === 'usage' && (
                <UsageTab user={user} credits={credits} setCredits={setCredits} />
              )}
              {activeTab === 'settings' && (
                <SettingsTab user={user} credits={credits} subscriptionTier={subscriptionTier} />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="card max-w-md w-full text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Vid2Txt</h2>
                <p className="text-gray-600 mb-6">
                  Convert video, audio, images to optimized text for AI tools
                </p>
                <button
                  onClick={() => router.push('/login')}
                  className="btn-primary flex items-center justify-center mx-auto"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.85 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Login with Google
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
