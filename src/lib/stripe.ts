import Stripe from "stripe";

/** True when server has a Stripe secret key (test or live). */
export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return Boolean(key && key.startsWith("sk_"));
}

export function stripePublishableKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key || undefined;
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!client) {
    client = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return client;
}

export function stripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined;
}

/** Public origin for Checkout success/cancel URLs. */
export function appOrigin(req: Request): string {
  const env =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "localhost:3000";
  return `${proto}://${host}`;
}
