import { normalizeCartLine, type AddCartDetail } from "@/lib/cart";
import { resolveStorageUrl } from "@/lib/footage";
import { getRepository } from "@/lib/repository";
import { evaluateProduct } from "@/lib/rights";
import type { CartLine, Product, SessionUser } from "@/types/domain";

export type CheckoutPrep =
  | {
      ok: true;
      lines: CartLine[];
      productsById: Map<string, Product>;
      previewUrlForDive: (diveId: string | undefined) => string | undefined;
      user: SessionUser;
    }
  | { ok: false; status: number; error: string };

/** Shared cart validation for simulated orders and Stripe Checkout. */
export function prepareCheckout(
  user: SessionUser,
  rawItems: AddCartDetail[],
): CheckoutPrep {
  if (!rawItems.length) {
    return { ok: false, status: 400, error: "Cart is empty" };
  }

  const lines: CartLine[] = rawItems.map((row) => normalizeCartLine(row));
  const repo = getRepository();
  const db = repo.getDb();
  const products = repo.listProducts();
  const productsById = new Map(products.map((p) => [p.id, p]));

  for (const line of lines) {
    const product = productsById.get(line.productId);
    if (product) {
      const decision = evaluateProduct(db, {
        ...product,
        licenseTier: line.licenseTier ?? product.licenseTier,
      });
      if (!decision.allowed) {
        return {
          ok: false,
          status: 403,
          error: `“${line.title}” is not sellable: ${decision.message}`,
        };
      }
    }
  }

  return {
    ok: true,
    lines,
    productsById,
    user,
    previewUrlForDive: (diveId) => {
      if (!diveId) return resolveStorageUrl("local:preview/shared.mp4");
      const footage = repo.getPrimaryFootage(diveId);
      return (
        resolveStorageUrl(footage?.storageKey) ||
        resolveStorageUrl("local:preview/shared.mp4")
      );
    },
  };
}
