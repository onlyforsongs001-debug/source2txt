import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
// @ts-ignore
import Stripe from 'stripe';

export async function GET(request: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder');
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
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Source2Txt Pro',
              description: '600 min video transcription + unlimited ZIP/folder per month',
            },
            unit_amount: 900, // $9.00
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: {
        user_id: session.user.id,
        type: 'subscription',
      },
    });

    return NextResponse.redirect(checkoutSession.url!);
  } catch (error) {
    console.error('Stripe subscription error:', error);
    return NextResponse.redirect(new URL('/pricing?error=checkout_failed', request.url));
  }
}
