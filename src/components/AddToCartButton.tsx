"use client";

import { Icon } from "@/components/Icon";

export function AddToCartButton({
  title,
  description,
  price,
  scene,
  label,
  ghost = false,
}: {
  title: string;
  description: string;
  price: number;
  scene: { h: number; x: string; d: number };
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
        window.dispatchEvent(
          new CustomEvent("depthboard:add-cart", {
            detail: { title, description, price, scene },
          }),
        );
      }}
    >
      {!ghost && <Icon name="cart" />}
      {label ?? `Buy clip · €${price}`}
    </button>
  );
}
