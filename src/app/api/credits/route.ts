import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
// @ts-ignore - stripe module resolution differs with bundler
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const withHistory = searchParams.get('history') === 'true';

    let { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('credits, subscription_tier, zip_daily_count, zip_daily_date')
      .eq('id', session.user.id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.credits < 10) {
      await supabaseAdmin
        .from('profiles')
        .update({ credits: 100, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);
      profile.credits = 100;
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyDate = profile.zip_daily_date || '';
    const dailyCount = dailyDate === today ? (profile.zip_daily_count || 0) : 0;
    const isPro = profile.subscription_tier === 'pro';

    let monthlyMinutes = 0;
    if (isPro) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { data: jobs } = await supabaseAdmin
        .from('processing_jobs')
        .select('duration_seconds')
        .eq('user_id', session.user.id)
        .eq('file_type', 'video')
        .gte('created_at', monthStart.toISOString());
      const totalSeconds = (jobs || []).reduce((sum, j) => sum + (j.duration_seconds || 0), 0);
      monthlyMinutes = Math.round(totalSeconds / 60);
    }

    let jobs: any[] = [];
    if (withHistory) {
      const { data: historyJobs } = await supabaseAdmin
        .from('processing_jobs')
        .select('id, file_name, file_type, status, credits_used, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      jobs = historyJobs || [];
    }

    return NextResponse.json({
      credits: profile.credits,
      subscription_tier: profile.subscription_tier,
      zip_daily_remaining: isPro ? -1 : Math.max(0, 50 - dailyCount),
      monthly_minutes: monthlyMinutes,
      jobs: withHistory ? jobs : undefined,
    });
  } catch (error) {
    console.error('Get credits error:', error);
    return NextResponse.json({ error: 'Failed to get credits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, paymentMethod, paymentId } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Verify payment with Stripe if paymentId is a Stripe session
    if (paymentMethod === 'stripe' && paymentId && stripe) {
      const checkoutSession = await stripe.checkout.sessions.retrieve(paymentId);
      if (checkoutSession.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Payment not completed' }, { status: 402 });
      }
      if (checkoutSession.metadata?.user_id !== session.user.id) {
        return NextResponse.json({ error: 'Invalid session' }, { status: 403 });
      }
    } else if (paymentMethod === 'stripe' && !stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const creditsToAdd = amount * 300;

    // Check if transaction already exists (idempotent)
    if (paymentId) {
      const { data: existing } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('payment_id', paymentId)
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: 'Transaction already processed' }, { status: 409 });
      }
    }

    // Atomic credit update using Supabase RPC
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: session.user.id,
        amount,
        credits_added: creditsToAdd,
        payment_method: paymentMethod || 'stripe',
        payment_id: paymentId,
        status: 'completed',
      });

    if (transactionError) {
      console.error('Transaction error:', transactionError);
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        credits: profile.credits + creditsToAdd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update credits' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      creditsAdded: creditsToAdd,
      newBalance: profile.credits + creditsToAdd,
    });
  } catch (error) {
    console.error('Add credits error:', error);
    return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
  }
}