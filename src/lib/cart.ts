/** Client-side cart (localStorage). Guests may cart; checkout requires login. */

import type { CartLine, LicenseTier } from "@/types/domain";

export const CART_STORAGE_KEY = "depthboard_cart_v1";
export const CART_EVENT = "depthboard:cart-changed";
export const ADD_CART_EVENT = "depthboard:add-cart";

export type AddCartDetail = Partial<CartLine> & {
  title: string;
  description: string;
  price: number;
  scene: { h: number; x: string; d: number };
};

function asTier(v: unknown): LicenseTier | undefined {
  const ok = [
    "sample",
    "short",
    "watermark",
    "social",
    "master",
    "commercial",
  ];
  return typeof v === "string" && ok.includes(v)
    ? (v as LicenseTier)
    : undefined;
}

export function normalizeCartLine(raw: AddCartDetail): CartLine {
  const productId =
    raw.productId?.trim() ||
    `adhoc-${(raw.title || "item").toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`;
  const sku =
    raw.sku?.trim() ||
    raw.productId?.trim() ||
    `sku-${productId}`;
  return {
    productId,
    sku,
    title: raw.title,
    description: raw.description,
    price: Number(raw.price) || 0,
    licenseTier: asTier(raw.licenseTier),
    diveId: raw.diveId,
    scene: raw.scene ?? { h: 200, x: "50%", d: 0.45 },
  };
}

export function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => normalizeCartLine(row as AddCartDetail));
  } catch {
    return [];
  }
}

export function writeCart(items: CartLine[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: items }));
}

export function addToCart(detail: AddCartDetail): CartLine[] {
  const line = normalizeCartLine(detail);
  const next = [...readCart(), line];
  writeCart(next);
  return next;
}

export function removeFromCart(index: number): CartLine[] {
  const next = readCart().filter((_, i) => i !== index);
  writeCart(next);
  return next;
}

export function clearCart(): void {
  writeCart([]);
}

export function cartTotal(items: CartLine[]): number {
  return items.reduce((s, i) => s + (Number(i.price) || 0), 0);
}

export function vatIncluded(total: number, rate = 0.23): number {
  return total - total / (1 + rate);
}
