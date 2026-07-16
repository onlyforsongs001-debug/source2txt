import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
// @ts-ignore - stripe package includes types but resolution differs
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder');

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

    const { credits } = await request.json();

    if (!credits || credits <= 0) {
      return NextResponse.json({ error: 'Invalid credits amount' }, { status: 400 });
    }

    // Calculate price: $0.20 per 10 credits (10 seconds each)
    // 10 credits = $0.20
    const pricePerCredit = 0.02; // $0.02 per credit
    const amount = credits * pricePerCredit;

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Source2Txt Credits - ${credits} credits (${Math.floor(credits / 6)} minutes)`,
              description: 'Video to text transcription credits',
            },
            unit_amount: Math.round(amount * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&credits=${credits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        user_id: session.user.id,
        credits: credits.toString(),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}