const express = require('express');
const { supabaseAdmin, getUserFromToken } = require('../lib/supabase');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const auth = await getUserFromToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { user } = auth;
    const { subject, message } = req.body;

    if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required' });

    await supabaseAdmin.from('transactions').insert({
      user_id: user.id, amount: 0, credits_added: 0,
      payment_method: 'support_ticket', status: 'completed',
    });

    console.log(`Support ticket from ${user.email}: ${subject} - ${message}`);
    res.json({ success: true, message: 'Support ticket submitted' });
  } catch (error) {
    console.error('Support API error:', error);
    res.status(500).json({ error: 'Failed to submit support ticket' });
  }
});

module.exports = router;
