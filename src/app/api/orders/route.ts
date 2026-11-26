import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prepareCheckout } from "@/lib/checkout";
import {
  buildOrderFromCart,
  createOrder,
  listOrdersForUser,
} from "@/lib/orders";
import type { AddCartDetail } from "@/lib/cart";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    orders: listOrdersForUser(session.id),
  });
}

/** Simulated checkout (local demo without Stripe keys). */
export async function POST(req: Request) {
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

  const order = buildOrderFromCart({
    user: prep.user,
    lines: prep.lines,
    productsById: prep.productsById,
    previewUrlForDive: prep.previewUrlForDive,
  });

  const result = createOrder(order);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    order: result.order,
    redirect: `/account?order=${result.order.id}`,
  });
}
