import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  buildOrderFromCart,
  createOrder,
  listOrdersForUser,
} from "@/lib/orders";
import { resolveStorageUrl } from "@/lib/footage";
import { getRepository } from "@/lib/repository";
import { evaluateProduct } from "@/lib/rights";
import type { CartLine } from "@/types/domain";
import { normalizeCartLine, type AddCartDetail } from "@/lib/cart";

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
  if (!rawItems.length) {
    return NextResponse.json(
      { ok: false, error: "Cart is empty" },
      { status: 400 },
    );
  }

  const lines: CartLine[] = rawItems.map((row) => normalizeCartLine(row));
  const repo = getRepository();
  const db = repo.getDb();
  const products = repo.listProducts();
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const line of lines) {
    const product = byId.get(line.productId);
    if (product) {
      const decision = evaluateProduct(db, {
        ...product,
        licenseTier: line.licenseTier ?? product.licenseTier,
      });
      if (!decision.allowed) {
        return NextResponse.json(
          {
            ok: false,
            error: `“${line.title}” is not sellable: ${decision.message}`,
          },
          { status: 403 },
        );
      }
    }
  }

  const order = buildOrderFromCart({
    user: session,
    lines,
    productsById: byId,
    previewUrlForDive: (diveId) => {
      if (!diveId) return resolveStorageUrl("local:preview/shared.mp4");
      const footage = repo.getPrimaryFootage(diveId);
      return (
        resolveStorageUrl(footage?.storageKey) ||
        resolveStorageUrl("local:preview/shared.mp4")
      );
    },
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
