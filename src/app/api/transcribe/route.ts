import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import OpenAI from 'openai';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const fileType = formData.get('fileType') as string;
    const durationSeconds = parseInt(formData.get('durationSeconds') as string) || 0;
    const diarize = formData.get('diarize') === 'true';

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // File size check for free tier
    const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB
    if (profile.subscription_tier !== 'pro' && audioFile.size > FILE_SIZE_LIMIT) {
      return NextResponse.json(
        { error: `Free plan: file exceeds 10MB limit (${(audioFile.size / (1024 * 1024)).toFixed(1)}MB). Upgrade to Pro for unlimited file size.` },
        { status: 413 }
      );
    }

    const creditsNeeded = durationSeconds / 10;

    // Atomic credit deduction - prevents race condition
    const { data: updatedProfile, error: deductError } = await supabaseAdmin
      .from('profiles')
      .update({
        credits: profile.credits - creditsNeeded,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id)
      .gte('credits', creditsNeeded) // Only deduct if enough credits
      .select('credits')
      .single();

    if (deductError || !updatedProfile) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${creditsNeeded.toFixed(2)} credits.` },
        { status: 402 }
      );
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from('processing_jobs')
      .insert({
        user_id: session.user.id,
        file_name: audioFile.name,
        file_type: fileType as any,
        duration_seconds: durationSeconds,
        credits_used: creditsNeeded,
        status: 'processing',
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    try {
      const client = new OpenAI({
        apiKey: process.env.DEEPGRAM_API_KEY || process.env.GROQ_API_KEY,
      });

      const transcriptionOptions: any = {
        file: audioFile,
        model: process.env.GROQ_API_KEY ? 'whisper-large-v3' : 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      };

      if (diarize && process.env.GROQ_API_KEY) {
        transcriptionOptions.extra_parameters = {
          diarize: true,
          num_speakers: 2,
        };
      }

      const transcription = await client.audio.transcriptions.create(transcriptionOptions);

      const transcribedText = transcription.text || '';

      let segments: { start: number; end: number; text: string; speaker?: string }[] = [];
      let formattedText = transcribedText;

      if (diarize && (transcription as any).segments) {
        segments = (transcription as any).segments.map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
          speaker: seg.speaker || undefined,
        }));

        formattedText = segments
          .map(s => s.speaker ? `[${s.speaker}]: ${s.text}` : s.text)
          .join('\n');
      } else if ((transcription as any).segments) {
        segments = (transcription as any).segments.map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
        }));
      }

      await supabaseAdmin
        .from('processing_jobs')
        .update({
          status: 'completed',
          result_text: formattedText,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return NextResponse.json({
        success: true,
        text: formattedText,
        segments,
        creditsRemaining: updatedProfile.credits,
      });
    } catch (transcriptionError) {
      await supabaseAdmin
        .from('processing_jobs')
        .update({
          status: 'failed',
          error_message: transcriptionError instanceof Error ? transcriptionError.message : 'Transcription failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return NextResponse.json(
        { error: 'Transcription failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}