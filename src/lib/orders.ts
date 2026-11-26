import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type {
  CartLine,
  DeliveryKind,
  LicenseTier,
  Order,
  OrderDelivery,
  OrderItem,
  Product,
  SessionUser,
} from "@/types/domain";
import { resolveStorageUrl } from "@/lib/footage";

const ORDERS_FILE = "orders.json";
const LEGACY_FILE = "orders-stub.json";

let cached: Order[] | null = null;

function ordersPath() {
  return path.join(process.cwd(), "data", ORDERS_FILE);
}

function legacyPath() {
  return path.join(process.cwd(), "data", LEGACY_FILE);
}

function readAllOrders(): Order[] {
  if (cached) return cached;
  const primary = ordersPath();
  const legacy = legacyPath();
  const file = existsSync(primary)
    ? primary
    : existsSync(legacy)
      ? legacy
      : null;
  if (!file) {
    cached = [];
    return cached;
  }
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Order[];
    cached = Array.isArray(parsed) ? parsed : [];
  } catch {
    cached = [];
  }
  return cached;
}

function persistOrders(orders: Order[]): boolean {
  try {
    writeFileSync(ordersPath(), JSON.stringify(orders, null, 2) + "\n", "utf8");
    cached = orders;
    return true;
  } catch {
    return false;
  }
}

export function invalidateOrdersCache(): void {
  cached = null;
}

export function listOrdersForUser(userId: string): Order[] {
  return readAllOrders()
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOrderById(id: string): Order | undefined {
  return readAllOrders().find((o) => o.id === id);
}

/** Map licence tier → delivery artefact after pay (simulated or Stripe). */
export function deliveryForTier(
  tier: LicenseTier | undefined,
  opts: {
    diveId?: string;
    previewUrl?: string;
    productKind?: Product["kind"];
  } = {},
): OrderDelivery {
  const stream =
    opts.previewUrl ||
    resolveStorageUrl("local:preview/shared.mp4") ||
    "/video/hero.mp4";
  const download = "/video/hero.mp4";

  if (opts.productKind === "media" || tier === "commercial") {
    return {
      kind: "quote",
      status: "quote_pending",
      note: "Commercial / media-pack quote — Diveye will email within 2 business days.",
    };
  }

  switch (tier) {
    case "sample":
      return {
        kind: "download",
        status: "ready",
        downloadUrl: download,
        streamUrl: `${stream}?wm=sample`,
        note: "Free watermarked sample — placeholder download ready.",
      };
    case "short":
      return {
        kind: "stream",
        status: "ready",
        streamUrl: `${stream}?wm=short&access=48h`,
        downloadUrl: download,
        note: "Short access · watermarked stream link (48 h stub).",
      };
    case "watermark":
      return {
        kind: "stream",
        status: "ready",
        streamUrl: `${stream}?wm=long`,
        downloadUrl: download,
        note: "Long watermarked stream · placeholder file attached.",
      };
    case "social":
      return {
        kind: "download",
        status: "ready",
        downloadUrl: download,
        streamUrl: `${stream}?licence=social`,
        note: "Social licence · downloadable placeholder (vertical + horizontal stub).",
      };
    case "master":
      return {
        kind: "processing",
        status: "processing",
        note: "HQ / master — Diveye montage after purchase. We email when the file is ready (≈72 h stub).",
      };
    default:
      return {
        kind: "processing",
        status: "processing",
        note: "Fulfilment pending.",
      };
  }
}

export function deliveryKindLabel(kind: DeliveryKind | undefined): string {
  switch (kind) {
    case "download":
      return "Download ready";
    case "stream":
      return "Stream link";
    case "processing":
      return "Processing";
    case "quote":
      return "Quote pending";
    default:
      return "—";
  }
}

export function isPaidStatus(status: Order["status"]): boolean {
  return (
    status === "paid" ||
    status === "paid_simulated" ||
    status === "paid_stub"
  );
}

type CheckoutInput = {
  user: SessionUser;
  lines: CartLine[];
  productsById: Map<string, Product>;
  previewUrlForDive: (diveId: string | undefined) => string | undefined;
};

function nextOrderId(): string {
  return `ORD-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
}

function buildItems(
  input: CheckoutInput,
  withDelivery: boolean,
): OrderItem[] {
  return input.lines.map((line) => {
    const product = input.productsById.get(line.productId);
    const tier = line.licenseTier ?? product?.licenseTier;
    const diveId = line.diveId ?? product?.diveId;
    const item: OrderItem = {
      sku: line.sku || product?.slug || line.productId,
      productId: line.productId,
      title: line.title,
      priceEur: line.price,
      licenseTier: tier,
      diveId,
    };
    if (withDelivery) {
      item.delivery = deliveryForTier(tier, {
        diveId,
        previewUrl: input.previewUrlForDive(diveId),
        productKind: product?.kind,
      });
    }
    return item;
  });
}

/** Simulated checkout — immediately paid with entitlements. */
export function buildOrderFromCart(input: CheckoutInput): Order {
  const items = buildItems(input, true);
  const totalEur = items.reduce((s, i) => s + i.priceEur, 0);
  return {
    id: nextOrderId(),
    userId: input.user.id,
    email: input.user.email,
    status: "paid_simulated",
    createdAt: new Date().toISOString(),
    totalEur,
    items,
    payment: { provider: "simulated", simulated: true },
    notes: "Simulated checkout (PWF-15) — local demo without Stripe keys.",
  };
}

/**
 * Pending Stripe order — entitlements applied on
 * `checkout.session.completed` via {@link fulfillStripeOrder}.
 */
export function buildPendingStripeOrder(input: CheckoutInput): Order {
  const items = buildItems(input, false);
  const totalEur = items.reduce((s, i) => s + i.priceEur, 0);
  return {
    id: nextOrderId(),
    userId: input.user.id,
    email: input.user.email,
    status: "pending",
    createdAt: new Date().toISOString(),
    totalEur,
    items,
    payment: { provider: "stripe_test", simulated: false },
    notes: "Awaiting Stripe Checkout (test mode).",
  };
}

export function createOrder(
  order: Order,
): { ok: true; order: Order } | { ok: false; error: string } {
  const all = readAllOrders();
  all.push(order);
  if (!persistOrders(all)) {
    return { ok: false, error: "Could not persist order JSON" };
  }
  return { ok: true, order };
}

export function attachStripeSession(
  orderId: string,
  stripeSessionId: string,
): { ok: true; order: Order } | { ok: false; error: string } {
  const all = readAllOrders();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return { ok: false, error: "Order not found" };
  const prev = all[idx]!;
  const next: Order = {
    ...prev,
    payment: {
      provider: "stripe_test",
      simulated: false,
      stripeSessionId,
      stripePaymentIntentId: prev.payment?.stripePaymentIntentId ?? null,
    },
  };
  all[idx] = next;
  if (!persistOrders(all)) {
    return { ok: false, error: "Could not persist order JSON" };
  }
  return { ok: true, order: next };
}

/**
 * Mark a pending order paid and attach the same entitlements as simulated pay.
 * Idempotent if already paid.
 */
export function fulfillStripeOrder(opts: {
  orderId: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
  productsById: Map<string, Product>;
  previewUrlForDive: (diveId: string | undefined) => string | undefined;
}): { ok: true; order: Order; alreadyPaid: boolean } | { ok: false; error: string } {
  const all = readAllOrders();
  const idx = all.findIndex((o) => o.id === opts.orderId);
  if (idx < 0) return { ok: false, error: "Order not found" };
  const prev = all[idx]!;

  if (isPaidStatus(prev.status)) {
    return { ok: true, order: prev, alreadyPaid: true };
  }

  const items: OrderItem[] = prev.items.map((item) => {
    if (item.delivery) return item;
    const product = item.productId
      ? opts.productsById.get(item.productId)
      : undefined;
    return {
      ...item,
      delivery: deliveryForTier(item.licenseTier ?? product?.licenseTier, {
        diveId: item.diveId ?? product?.diveId,
        previewUrl: opts.previewUrlForDive(item.diveId ?? product?.diveId),
        productKind: product?.kind,
      }),
    };
  });

  const next: Order = {
    ...prev,
    status: "paid",
    items,
    payment: {
      provider: "stripe_test",
      simulated: false,
      stripeSessionId: opts.stripeSessionId,
      stripePaymentIntentId: opts.stripePaymentIntentId ?? null,
    },
    notes: "Paid via Stripe Checkout (test mode) — entitlements delivered.",
  };
  all[idx] = next;
  if (!persistOrders(all)) {
    return { ok: false, error: "Could not persist order JSON" };
  }
  return { ok: true, order: next, alreadyPaid: false };
}

export function findOrderByStripeSession(
  stripeSessionId: string,
): Order | undefined {
  return readAllOrders().find(
    (o) => o.payment?.stripeSessionId === stripeSessionId,
  );
}
