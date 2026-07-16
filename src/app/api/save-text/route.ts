import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
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

    // Check daily limit for free tier
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, zip_daily_count, zip_daily_date')
      .eq('id', session.user.id)
      .single();

    const isPro = profile?.subscription_tier === 'pro';
    const today = new Date().toISOString().split('T')[0];

    if (!isPro) {
      const dailyDate = profile?.zip_daily_date || '';
      const dailyCount = dailyDate === today ? (profile?.zip_daily_count || 0) : 0;
      if (dailyCount >= 50) {
        return NextResponse.json(
          { error: 'Daily limit reached (50 extractions). Upgrade to Pro for unlimited.' },
          { status: 429 }
        );
      }
    }

    const { fileName, text, fileCount } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    if (typeof text !== 'string' || text.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Text too large (max 10MB)' }, { status: 400 });
    }

    // Increment daily counter (free tier) - atomic update
    if (!isPro) {
      const { data: currentProfile } = await supabaseAdmin
        .from('profiles')
        .select('zip_daily_count, zip_daily_date')
        .eq('id', session.user.id)
        .single();

      if (currentProfile) {
        const currentDate = currentProfile.zip_daily_date || '';
        const nextCount = (currentDate === today ? (currentProfile.zip_daily_count || 0) : 0) + 1;
        await supabaseAdmin
          .from('profiles')
          .update({
            zip_daily_count: nextCount,
            zip_daily_date: today,
          })
          .eq('id', session.user.id)
          .eq('zip_daily_date', currentDate)
          .eq('zip_daily_count', currentProfile.zip_daily_count);
      }
    }

    const { data: job } = await supabaseAdmin
      .from('processing_jobs')
      .insert({
        user_id: session.user.id,
        file_name: fileName || 'folder',
        file_type: 'folder',
        credits_used: 0,
        status: 'completed',
        result_text: text,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('Save text error:', error);
    return NextResponse.json({ error: 'Failed to save text' }, { status: 500 });
  }
}
