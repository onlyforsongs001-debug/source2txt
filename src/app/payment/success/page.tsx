'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { apiPost } from '@/lib/api-client';
import { CheckCircle, Loader2 } from 'lucide-react';

function PaymentContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const credits = searchParams.get('credits');
  const [isVerifying, setIsVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setError('No session ID provided');
        setIsVerifying(false);
        return;
      }

      try {
        // Call API to add credits
        const response = await apiPost('/api/credits', {
          amount: parseFloat(credits || '0') * 0.02,
          paymentMethod: 'stripe',
          paymentId: sessionId,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add credits');
        }

        setSuccess(true);
        setNewBalance(data.newBalance);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Payment verification failed');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [sessionId, credits, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full text-center">
        {isVerifying ? (
          <>
            <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary animate-spin" />
            <h1 className="text-2xl font-bold mb-2">Processing Payment</h1>
            <p className="text-gray-400">Please wait while we verify your payment...</p>
          </>
        ) : success ? (
          <>
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
            <h1 className="text-2xl font-bold mb-2 text-green-400">Payment Successful!</h1>
            <p className="text-gray-300 mb-4">
              {credits} credits have been added to your account
            </p>
            {newBalance !== null && (
              <p className="text-sm text-gray-400 mb-6">
                New balance: {newBalance.toFixed(2)} credits ({newBalance / 60} minutes)
              </p>
            )}
            <button
              onClick={() => window.location.href = '/'}
              className="btn-primary"
            >
              Start Converting
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <span className="text-red-400 text-3xl">!</span>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-400">Payment Failed</h1>
            <p className="text-gray-300 mb-6">{error}</p>
            <button
              onClick={() => window.location.href = '/pricing'}
              className="btn-primary"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <Loader2 className="w-16 h-16 mx-auto mb-4 text-primary animate-spin" />
          <h1 className="text-2xl font-bold mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  );
}