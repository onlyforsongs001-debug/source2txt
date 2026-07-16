import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore - stripe module resolution differs with bundler
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function hasProcessedEvent(eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('payment_id', eventId)
    .maybeSingle();
  return !!data;
}

async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.user_id;
  const credits = parseInt(session.metadata?.credits || '0');
  const type = session.metadata?.type;

  if (!userId) {
    console.error('Missing user_id in metadata');
    return;
  }

  // Idempotency check
  if (await hasProcessedEvent(session.id)) {
    console.log(`Event ${session.id} already processed, skipping`);
    return;
  }

  if (type === 'subscription') {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (!profile) return;

    await supabaseAdmin
      .from('profiles')
      .update({
        credits: (profile.credits || 0) + 3600,
        subscription_tier: 'pro',
        subscription_stripe_id: session.subscription?.toString(),
        subscription_status: 'active',
        subscription_period_end: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      amount: 9.0,
      credits_added: 3600,
      payment_method: 'stripe',
      payment_id: session.id,
      status: 'completed',
    });

    console.log(`Pro subscription activated for user ${userId}`);
    return;
  }

  if (credits > 0) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (!profile) return;

    await supabaseAdmin
      .from('profiles')
      .update({
        credits: (profile.credits || 0) + credits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      amount: credits * 0.02,
      credits_added: credits,
      payment_method: 'stripe',
      payment_id: session.id,
      status: 'completed',
    });

    console.log(`Added ${credits} credits to user ${userId}`);
  }
}

async function handleInvoicePaid(invoice: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  // Idempotency check
  if (await hasProcessedEvent(invoice.id)) {
    console.log(`Invoice ${invoice.id} already processed, skipping`);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
  const userId = subscription.metadata?.user_id;

  if (!userId) return;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  if (!profile) return;

  await supabaseAdmin
    .from('profiles')
    .update({
      credits: (profile.credits || 0) + 3600,
      subscription_period_end: new Date(
        ((subscription as any).current_period_end || 0) * 1000
      ).toISOString(),
      subscription_status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  await supabaseAdmin.from('transactions').insert({
    user_id: userId,
    amount: 9.0,
    credits_added: 3600,
    payment_method: 'stripe',
    payment_id: invoice.id,
    status: 'completed',
  });

  console.log(`Monthly credits added for user ${userId}`);
}

async function handleInvoicePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
  const userId = subscription.metadata?.user_id;

  if (!userId) return;

  await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  console.log(`Payment failed for user ${userId}`);
}

async function handleSubscriptionDeleted(subscription: any) {
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('subscription_stripe_id', subscription.id);

  if (!profiles || profiles.length === 0) return;

  await supabaseAdmin
    .from('profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', profiles[0].id);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') as string;

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
