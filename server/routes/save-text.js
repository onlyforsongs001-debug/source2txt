const express = require('express');
const { supabaseAdmin, getUserFromToken } = require('../lib/supabase');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const auth = await getUserFromToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { user } = auth;
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('subscription_tier, zip_daily_count, zip_daily_date').eq('id', user.id).single();

    const isPro = profile?.subscription_tier === 'pro';
    const today = new Date().toISOString().split('T')[0];

    if (!isPro) {
      const dailyDate = profile?.zip_daily_date || '';
      const dailyCount = dailyDate === today ? (profile?.zip_daily_count || 0) : 0;
      if (dailyCount >= 50) return res.status(429).json({ error: 'Daily limit reached (50 extractions). Upgrade to Pro for unlimited.' });
    }

    const { fileName, text, fileCount } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });
    if (typeof text !== 'string' || text.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Text too large (max 10MB)' });

    if (!isPro) {
      const { data: currentProfile } = await supabaseAdmin
        .from('profiles').select('zip_daily_count, zip_daily_date').eq('id', user.id).single();
      if (currentProfile) {
        const currentDate = currentProfile.zip_daily_date || '';
        const nextCount = (currentDate === today ? (currentProfile.zip_daily_count || 0) : 0) + 1;
        await supabaseAdmin.from('profiles').update({ zip_daily_count: nextCount, zip_daily_date: today })
          .eq('id', user.id).eq('zip_daily_date', currentDate).eq('zip_daily_count', currentProfile.zip_daily_count);
      }
    }

    const { data: job } = await supabaseAdmin.from('processing_jobs').insert({
      user_id: user.id, file_name: fileName || 'folder', file_type: 'folder',
      credits_used: 0, status: 'completed', result_text: text, completed_at: new Date().toISOString(),
    }).select().single();

    res.json({ success: true, job });
  } catch (error) {
    console.error('Save text error:', error);
    res.status(500).json({ error: 'Failed to save text' });
  }
});

module.exports = router;
