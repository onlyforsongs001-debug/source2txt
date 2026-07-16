import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const HF_SPACE_URL = 'https://kkouadn-dual-orchtractor.hf.space';

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
    const language = formData.get('language') as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const creditsNeeded = durationSeconds / 10;

    const { data: updatedProfile, error: deductError } = await supabaseAdmin
      .from('profiles')
      .update({
        credits: profile.credits - creditsNeeded,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id)
      .gte('credits', creditsNeeded)
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
      const hfToken = process.env.HF_TOKEN;
      if (!hfToken) {
        throw new Error('HF_TOKEN not configured');
      }

      const hfFormData = new FormData();
      hfFormData.append('file', audioFile);
      if (language) {
        hfFormData.append('language', language);
      }

      const response = await fetch(`${HF_SPACE_URL}/transcribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
        },
        body: hfFormData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HF Space error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Transcription failed on HF Space');
      }

      let formattedText = result.text || '';
      const segments = (result.segments || []).map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
        speaker: seg.speaker || undefined,
      }));

      if (segments.length > 0) {
        formattedText = segments.map((s: any) => s.text).join('\n');
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
          error_message: transcriptionError instanceof Error ? transcriptionError.message : 'HF Transcription failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      return NextResponse.json(
        { error: 'Transcription failed on HF Space' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('HF API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
