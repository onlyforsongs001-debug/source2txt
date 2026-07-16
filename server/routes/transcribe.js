const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const { supabaseAdmin, getUserFromToken } = require('../lib/supabase');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

router.post('/', upload.single('audio'), async (req, res) => {
  try {
    const auth = await getUserFromToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { user, profile } = auth;
    const fileType = req.body.fileType;
    const durationSeconds = parseInt(req.body.durationSeconds) || 0;
    const diarize = req.body.diarize === 'true';
    const audioFile = req.file;

    if (!audioFile) return res.status(400).json({ error: 'No audio file provided' });

    const FILE_SIZE_LIMIT = 10 * 1024 * 1024;
    if (profile.subscription_tier !== 'pro' && audioFile.size > FILE_SIZE_LIMIT) {
      return res.status(413).json({
        error: `Free plan: file exceeds 10MB limit (${(audioFile.size / (1024 * 1024)).toFixed(1)}MB). Upgrade to Pro for unlimited file size.`
      });
    }

    const creditsNeeded = durationSeconds / 10;

    const { data: updatedProfile, error: deductError } = await supabaseAdmin
      .from('profiles')
      .update({ credits: profile.credits - creditsNeeded, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .gte('credits', creditsNeeded)
      .select('credits')
      .single();

    if (deductError || !updatedProfile) {
      return res.status(402).json({ error: `Insufficient credits. Need ${creditsNeeded.toFixed(2)} credits.` });
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('processing_jobs')
      .insert({
        user_id: user.id,
        file_name: audioFile.originalname,
        file_type: fileType,
        duration_seconds: durationSeconds,
        credits_used: creditsNeeded,
        status: 'processing',
      })
      .select()
      .single();

    if (jobError) return res.status(500).json({ error: 'Failed to create job' });

    try {
      const audioBuffer = audioFile.buffer;
      const blob = new Blob([audioBuffer], { type: audioFile.mimetype });

      const client = new OpenAI({
        apiKey: process.env.DEEPGRAM_API_KEY || process.env.GROQ_API_KEY,
      });

      const transcriptionOptions = {
        file: blob,
        model: process.env.GROQ_API_KEY ? 'whisper-large-v3' : 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      };

      if (diarize && process.env.GROQ_API_KEY) {
        transcriptionOptions.extra_parameters = { diarize: true, num_speakers: 2 };
      }

      const transcription = await client.audio.transcriptions.create(transcriptionOptions);

      const transcribedText = transcription.text || '';
      let segments = [];
      let formattedText = transcribedText;

      if (diarize && transcription.segments) {
        segments = transcription.segments.map(seg => ({
          start: seg.start, end: seg.end, text: seg.text, speaker: seg.speaker || undefined,
        }));
        formattedText = segments.map(s => s.speaker ? `[${s.speaker}]: ${s.text}` : s.text).join('\n');
      } else if (transcription.segments) {
        segments = transcription.segments.map(seg => ({
          start: seg.start, end: seg.end, text: seg.text,
        }));
      }

      await supabaseAdmin.from('processing_jobs').update({
        status: 'completed', result_text: formattedText, completed_at: new Date().toISOString(),
      }).eq('id', job.id);

      res.json({ success: true, text: formattedText, segments, creditsRemaining: updatedProfile.credits });
    } catch (transcriptionError) {
      await supabaseAdmin.from('processing_jobs').update({
        status: 'failed',
        error_message: transcriptionError.message || 'Transcription failed',
        completed_at: new Date().toISOString(),
      }).eq('id', job.id);

      res.status(500).json({ error: 'Transcription failed' });
    }
  } catch (error) {
    console.error('Transcribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
