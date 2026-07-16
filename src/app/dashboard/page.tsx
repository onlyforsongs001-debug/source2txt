'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { UsageTab } from '@/components/usage-tab';
import { History, CreditCard, FileText, Clock } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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
      } else {
        router.push('/');
      }
      setIsLoading(false);
    };

    getUser();
  }, [supabase, router]);

  const fetchCredits = async (userId: string) => {
    try {
      const response = await fetch('/api/credits');
      if (response.ok) {
        const data = await response.json();
        setCredits(data.credits);
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
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
        <Sidebar activeTab="usage" onTabChange={(tab) => {
          if (tab === 'workspace') router.push('/');
          if (tab === 'usage') router.push('/dashboard');
        }} credits={credits} />
        <main className="flex-1 ml-64">
          <UsageTab user={user} credits={credits} setCredits={setCredits} />
        </main>
      </div>
    </div>
  );
}