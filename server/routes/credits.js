const express = require('express');
const { supabaseAdmin, getUserFromToken } = require('../lib/supabase');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const auth = await getUserFromToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { user } = auth;
    const withHistory = req.query.history === 'true';

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('credits, subscription_tier, zip_daily_count, zip_daily_date')
      .eq('id', user.id)
      .single();

    if (error || !profile) return res.status(404).json({ error: 'Profile not found' });

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
        .eq('user_id', user.id)
        .eq('file_type', 'video')
        .gte('created_at', monthStart.toISOString());
      const totalSeconds = (jobs || []).reduce((sum, j) => sum + (j.duration_seconds || 0), 0);
      monthlyMinutes = Math.round(totalSeconds / 60);
    }

    let jobs = [];
    if (withHistory) {
      const { data: historyJobs } = await supabaseAdmin
        .from('processing_jobs')
        .select('id, file_name, file_type, status, credits_used, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      jobs = historyJobs || [];
    }

    res.json({
      credits: profile.credits,
      subscription_tier: profile.subscription_tier,
      zip_daily_remaining: isPro ? -1 : Math.max(0, 50 - dailyCount),
      monthly_minutes: monthlyMinutes,
      jobs: withHistory ? jobs : undefined,
    });
  } catch (error) {
    console.error('Get credits error:', error);
    res.status(500).json({ error: 'Failed to get credits' });
  }
});

router.post('/', async (req, res) => {
  try {
    const auth = await getUserFromToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { user } = auth;
    const { amount, paymentMethod, paymentId } = req.body;

    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    let stripe = null;
    if (paymentMethod === 'stripe' && paymentId) {
      stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });

      const checkoutSession = await stripe.checkout.sessions.retrieve(paymentId);
      if (checkoutSession.payment_status !== 'paid') return res.status(402).json({ error: 'Payment not completed' });
      if (checkoutSession.metadata?.user_id !== user.id) return res.status(403).json({ error: 'Invalid session' });
    }

    const creditsToAdd = amount * 300;

    if (paymentId) {
      const { data: existing } = await supabaseAdmin
        .from('transactions').select('id').eq('payment_id', paymentId).eq('user_id', user.id).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Transaction already processed' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles').select('credits').eq('id', user.id).single();
    if (profileError || !profile) return res.status(404).json({ error: 'Profile not found' });

    const { error: transactionError } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id, amount, credits_added: creditsToAdd,
      payment_method: paymentMethod || 'stripe', payment_id: paymentId, status: 'completed',
    });
    if (transactionError) return res.status(500).json({ error: 'Failed to create transaction' });

    const { error: updateError } = await supabaseAdmin
      .from('profiles').update({ credits: profile.credits + creditsToAdd, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (updateError) return res.status(500).json({ error: 'Failed to update credits' });

    res.json({ success: true, creditsAdded: creditsToAdd, newBalance: profile.credits + creditsToAdd });
  } catch (error) {
    console.error('Add credits error:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

module.exports = router;
