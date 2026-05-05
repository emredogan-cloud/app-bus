import { NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * Stripe webhook for direct subscriptions purchased on the web (no IAP fee).
 *
 * Phase 9 stub: validates the signature with the configured webhook secret
 * and forwards the event to the API for tier flips. The API exposes a
 * second internal endpoint (Phase 9.5) `/v1/billing/stripe-event` that
 * RevenueCat-style applies the change.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'unconfigured' }, { status: 503 });

  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing_signature' }, { status: 401 });

  const body = await req.text();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  // Phase 9 stub — TODO Phase 9.5: forward to /v1/billing/stripe-event with the
  // shared webhook secret (same pattern as RevenueCat).
  console.log('stripe event received:', event.type, event.id);

  return NextResponse.json({ received: true }, { status: 200 });
}

// Stripe wants the raw body — disable Next's automatic JSON parsing.
export const dynamic = 'force-dynamic';
