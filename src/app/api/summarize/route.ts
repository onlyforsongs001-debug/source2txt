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

    const { text, length = 'medium' } = await request.json();
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const lengthInstructions: Record<string, string> = {
      short: 'Provide a very brief summary in 2-3 sentences covering only the key points.',
      medium: 'Provide a concise summary covering the main topics and key details, around one paragraph.',
      detailed: 'Provide a comprehensive summary with key points, supporting details, and main conclusions in multiple paragraphs with bullet points.',
    };

    const result = await chat({
      systemPrompt: `You are a summarization assistant. ${lengthInstructions[length] || lengthInstructions.medium}
Format the output as clean Markdown. Keep the original language of the text.`,
      userContent: text,
      maxTokens: length === 'short' ? 512 : length === 'medium' ? 1024 : 2048,
    });

    return NextResponse.json({
      success: true,
      summary: result.content,
      length,
      provider: result.provider,
    });
  } catch (error) {
    console.error('Summarize error:', error);
    return NextResponse.json(
      { error: 'Failed to summarize text' },
      { status: 500 }
    );
  }
}