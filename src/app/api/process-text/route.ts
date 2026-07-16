import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { chat } from '@/lib/ai/client';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createBrowserClient(
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

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { text } = await request.json();
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const result = await chat({
      systemPrompt: `You are a text processing assistant. Your job is to:
1. Fix spelling and grammar errors
2. Improve paragraph structure and readability
3. Add appropriate headers and formatting
4. Remove filler words and repetitions
5. Format the output as clean Markdown

Keep the original meaning intact. Be concise and clear.`,
      userContent: text,
      maxTokens: 4096,
    });

    return NextResponse.json({
      success: true,
      text: result.content,
      provider: result.provider,
    });
  } catch (error) {
    console.error('Process text error:', error);
    return NextResponse.json(
      { error: 'Failed to process text' },
      { status: 500 }
    );
  }
}