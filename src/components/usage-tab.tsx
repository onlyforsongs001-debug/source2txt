'use client';

import { useState, useEffect } from 'react';
import { Wallet, CreditCard, Clock, History, Plus, Crown, FileText, Sparkles } from 'lucide-react';

interface UsageTabProps {
  user: any;
  credits: number;
  setCredits: (credits: number) => void;
}

export function UsageTab({ user, credits }: UsageTabProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [zipDailyRemaining, setZipDailyRemaining] = useState(50);
  const [monthlyMinutes, setMonthlyMinutes] = useState(0);

  useEffect(() => {
    fetch('/api/credits')
      .then(r => r.json())
      .then(d => {
        setTier(d.subscription_tier || 'free');
        setZipDailyRemaining(d.zip_daily_remaining ?? 50);
        setMonthlyMinutes(d.monthly_minutes ?? 0);
      })
      .catch((err) => console.error('Failed to load credits:', err));
  }, []);

  const handleTopUp = () => {
    setIsLoading(true);
    setError(null);
    try {
      window.location.href = '/pricing';
    } catch (err) {
      setError('Failed to initiate payment');
    } finally {
      setIsLoading(false);
    }
  };

  const minutesRemaining = (credits * 10) / 60;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Usage</h1>
          <p className="text-gray-600 mt-1">Manage your credits and plan</p>
        </div>

        {/* Plan Card */}
        <div className={`card mb-6 ${tier === 'pro' ? 'border-blue-500 bg-blue-50/50' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {tier === 'pro' ? (
                <div className="p-2 bg-blue-100 rounded-lg"><Crown className="w-6 h-6 text-blue-600" /></div>
              ) : (
                <div className="p-2 bg-gray-100 rounded-lg"><FileText className="w-6 h-6 text-gray-600" /></div>
              )}
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {tier === 'pro' ? 'Pro Plan' : 'Free Plan'}
                </h2>
                <p className="text-sm text-gray-500">
                  {tier === 'pro' ? '$9/month - 600 min video + unlimited ZIP/folder' : '5 min video trial + 50 ZIP/folder per day'}
                </p>
              </div>
            </div>
            {tier === 'free' && (
              <a href="/pricing" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Upgrade
              </a>
            )}
          </div>

          {tier === 'pro' && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-sm text-gray-500">Monthly Video</p>
                <p className="text-xl font-bold text-gray-900">{monthlyMinutes}/600 min</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <p className="text-sm text-gray-500">ZIP/Folder</p>
                <p className="text-xl font-bold text-gray-900">Unlimited</p>
              </div>
            </div>
          )}

          {tier === 'free' && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <p className="text-sm text-gray-500">ZIP/Folder Today</p>
                <p className="text-xl font-bold text-gray-900">{50 - zipDailyRemaining}/50</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <p className="text-sm text-gray-500">Video Credits</p>
                <p className="text-xl font-bold text-gray-900">{credits.toFixed(0)} left</p>
              </div>
            </div>
          )}
        </div>

        {/* Credits Card */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Available Credits</h2>
              <p className="text-sm text-gray-500">1 credit = 10 seconds of video processing</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Wallet className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-5xl font-bold text-gray-900">{credits.toFixed(2)}</span>
            <span className="text-xl text-gray-500">credits</span>
          </div>

          <div className="mt-4 flex items-center space-x-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>≈ {minutesRemaining.toFixed(2)} minutes of video</span>
          </div>

          <button
            onClick={handleTopUp}
            disabled={isLoading}
            className="mt-6 w-full btn-primary flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span>Buy more credits</span>
              </>
            )}
          </button>
        </div>

        {/* Pricing Info */}
        <div className="card bg-gray-50 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Plans</h3>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Source2Txt Pro - $9/month</p>
                <ul className="text-sm text-gray-500 mt-1 space-y-1">
                  <li>600 minutes video transcription per month</li>
                  <li>Unlimited ZIP & folder extractions</li>
                  <li>Top up additional credits anytime</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <FileText className="w-5 h-5 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Free Trial</p>
                <ul className="text-sm text-gray-500 mt-1 space-y-1">
                  <li>5 minutes video (30 credits) on signup</li>
                  <li>50 ZIP/folder extractions per day</li>
                  <li>Pay-as-you-go: $0.20 per 10 minutes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1">
              <History className="w-4 h-4" />
              <span>View all</span>
            </button>
          </div>
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No recent activity</p>
            <p className="text-gray-400 text-xs mt-1">Upload a file to see your processing history</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
