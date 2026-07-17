import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const today = new Date().toISOString().split('T')[0];

      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, credits')
        .eq('id', data.user.id)
        .single();

      if (!existingProfile) {
        await supabaseAdmin.from('profiles').insert({
          id: data.user.id,
          email: data.user.email!,
          full_name: data.user.user_metadata?.full_name,
          avatar_url: data.user.user_metadata?.avatar_url,
          credits: 100,
          subscription_tier: 'free',
          zip_daily_count: 0,
          zip_daily_date: today,
          updated_at: new Date().toISOString(),
        });
      } else if (existingProfile.credits < 10) {
        await supabaseAdmin.from('profiles').update({
          credits: 100,
          updated_at: new Date().toISOString(),
        }).eq('id', data.user.id);
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}