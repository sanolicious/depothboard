"use client";

import { Icon } from "@/components/Icon";
import { ADD_CART_EVENT, type AddCartDetail } from "@/lib/cart";
import type { LicenseTier } from "@/types/domain";

export function AddToCartButton({
  productId,
  sku,
  title,
  description,
  price,
  scene,
  licenseTier,
  diveId,
  label,
  ghost = false,
}: {
  productId?: string;
  sku?: string;
  title: string;
  description: string;
  price: number;
  scene: { h: number; x: string; d: number };
  licenseTier?: LicenseTier;
  diveId?: string;
  label?: string;
  ghost?: boolean;
}) {
  return (
    <button
      className={
        ghost
          ? "btn btn--sm btn--ghost"
          : "btn btn--primary btn--lg btn--block"
      }
      type="button"
      onClick={() => {
        const detail: AddCartDetail = {
          productId,
          sku,
          title,
          description,
          price,
          scene,
          licenseTier,
          diveId,
        };
        window.dispatchEvent(
          new CustomEvent(ADD_CART_EVENT, {
            detail,
          }),
        );
      }}
    >
      {!ghost && <Icon name="cart" />}
      {label ??
        (price > 0 ? `Buy clip · €${price}` : "Add free sample")}
    </button>
  );
}
