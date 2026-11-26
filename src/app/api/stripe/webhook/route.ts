import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fulfillStripeOrder } from "@/lib/orders";
import { resolveStorageUrl } from "@/lib/footage";
import { getRepository } from "@/lib/repository";
import {
  getStripe,
  isStripeConfigured,
  stripeWebhookSecret,
} from "@/lib/stripe";

export const runtime = "nodejs";

/** Disable Next body parsing — Stripe needs the raw payload for signatures. */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const secret = stripeWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "STRIPE_WEBHOOK_SECRET is not set" },
      { status: 503 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid webhook signature";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId =
      session.metadata?.orderId || session.client_reference_id || undefined;
    if (!orderId) {
      return NextResponse.json(
        { ok: false, error: "Missing orderId on Checkout Session" },
        { status: 400 },
      );
    }

    const repo = getRepository();
    const products = repo.listProducts();
    const productsById = new Map(products.map((p) => [p.id, p]));
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    const result = fulfillStripeOrder({
      orderId,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntent,
      productsById,
      previewUrlForDive: (diveId) => {
        if (!diveId) return resolveStorageUrl("local:preview/shared.mp4");
        const footage = repo.getPrimaryFootage(diveId);
        return (
          resolveStorageUrl(footage?.storageKey) ||
          resolveStorageUrl("local:preview/shared.mp4")
        );
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      orderId: result.order.id,
      alreadyPaid: result.alreadyPaid,
    });
  }

  return NextResponse.json({ ok: true, ignored: event.type });
}
