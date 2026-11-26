import type { Card } from "@/types/domain";
import { cardLabel } from "@/lib/format";

export function CardBadge({
  card,
  large = false,
}: {
  card: Card;
  large?: boolean;
}) {
  const cls =
    card === "W" ? "cardb--w" : card === "Y" ? "cardb--y" : "cardb--r";
  return (
    <span
      className={`cardb ${cls}${large ? " cardb--lg" : ""}`}
      title={cardLabel(card)}
      aria-label={cardLabel(card)}
    >
      {card}
    </span>
  );
}
