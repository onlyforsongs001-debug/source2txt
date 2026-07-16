import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

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

    const { subject, message } = await request.json();

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    await supabaseAdmin.from('transactions').insert({
      user_id: session.user.id,
      amount: 0,
      credits_added: 0,
      payment_method: 'support_ticket',
      status: 'completed',
    });

    console.log(`Support ticket from ${session.user.email}: ${subject} - ${message}`);

    return NextResponse.json({ success: true, message: 'Support ticket submitted' });
  } catch (error) {
    console.error('Support API error:', error);
    return NextResponse.json({ error: 'Failed to submit support ticket' }, { status: 500 });
  }
}
