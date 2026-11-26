"use client";

import { useEffect } from "react";
import { clearCart } from "@/lib/cart";

/** Clears localStorage cart after a successful Stripe redirect to /account. */
export function ClearCartOnCheckoutSuccess({
  checkout,
}: {
  checkout?: string;
}) {
  useEffect(() => {
    if (checkout === "success") clearCart();
  }, [checkout]);
  return null;
}
