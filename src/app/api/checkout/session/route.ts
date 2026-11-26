import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prepareCheckout } from "@/lib/checkout";
import {
  attachStripeSession,
  buildPendingStripeOrder,
  createOrder,
} from "@/lib/orders";
import {
  appOrigin,
  getStripe,
  isStripeConfigured,
} from "@/lib/stripe";
import type { AddCartDetail } from "@/lib/cart";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    stripeConfigured: isStripeConfigured(),
  });
}

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe is not configured — use simulated checkout",
        stripeConfigured: false,
      },
      { status: 503 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: "Sign in required to checkout",
        loginRequired: true,
      },
      { status: 401 },
    );
  }

  let body: { items?: AddCartDetail[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const prep = prepareCheckout(session, rawItems);
  if (!prep.ok) {
    return NextResponse.json(
      { ok: false, error: prep.error },
      { status: prep.status },
    );
  }

  const order = buildPendingStripeOrder({
    user: prep.user,
    lines: prep.lines,
    productsById: prep.productsById,
    previewUrlForDive: prep.previewUrlForDive,
  });

  const created = createOrder(order);
  if (!created.ok) {
    return NextResponse.json(
      { ok: false, error: created.error },
      { status: 500 },
    );
  }

  const origin = appOrigin(req);
  const stripe = getStripe();

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: session.email,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        userId: session.id,
      },
      line_items: order.items.map((item) => ({
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: Math.max(0, Math.round(item.priceEur * 100)),
          product_data: {
            name: item.title,
            description: item.licenseTier
              ? `Licence: ${item.licenseTier}`
              : undefined,
            metadata: {
              sku: item.sku,
              orderId: order.id,
            },
          },
        },
      })),
      payment_method_collection: order.totalEur > 0 ? "always" : "if_required",
      success_url: `${origin}/account?order=${encodeURIComponent(order.id)}&checkout=success`,
      cancel_url: `${origin}/account?order=${encodeURIComponent(order.id)}&checkout=cancelled`,
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe did not return a Checkout URL" },
        { status: 502 },
      );
    }

    attachStripeSession(order.id, checkoutSession.id);

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Stripe Checkout Session failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
