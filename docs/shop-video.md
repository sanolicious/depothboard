# Video shop funnel (PWF-15)

Simulated checkout for Diveye AIDA footage licences. Stacked on auth (PWF-14).

## Funnel (orientative EUR)

| Tier | Price | After “pay” |
|---|---|---|
| Free sample | €0 | Downloadable placeholder + watermarked stream |
| Short access | €9 | Watermarked stream (48 h stub) |
| Long / watermark | €19 | Watermarked stream + placeholder file |
| Social licence | €29 | Downloadable placeholder |
| HQ / master | €79 | **Processing** — email when montage ready |
| Commercial / media pack | €129+ quote | Quote form → `quotes@depthboard.com` |

**AIDA** (`diveye_owned`) + consents → sellable. **CMAS** (`cmas_link`) → embed/link only, never in cart.

SKUs are generated from `FootageAsset` in `data/footage.json` via `productsFromFootage`.

## Buy a demo clip end-to-end

1. Sign in: `/login` → `vitomir.demo@example.com` / `demo`
2. Open `/shop` (or `/dives/dive-0` → **Buy clip**)
3. Add e.g. social (€29) or free sample
4. `/cart` → **Pay (simulated)**
5. Order written to `data/orders.json` with `status: "paid_simulated"`
6. Delivery links / processing notes on `/account` (orders + library)

Guests may add to cart; checkout returns **401** and redirects to login.

## API

- `POST /api/orders` `{ items: CartLine[] }` → requires session → creates order
- `GET /api/orders` → current user’s orders

Cart lives in `localStorage` key `depthboard_cart_v1` (drawer + `/cart` share it).

## Stripe hook (later — no secrets required now)

Optional test-mode wiring when keys exist:

1. Add `stripe` dependency; set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in the host (never commit).
2. Replace `payment.provider: "simulated"` with a PaymentIntent create in `POST /api/orders` (or new `/api/checkout/session`).
3. On `checkout.session.completed` webhook → set `status: "paid"` and run the same `deliveryForTier` mapping.
4. Keep `paid_simulated` path behind `CHECKOUT_MODE=simulated` for demos without Stripe.

P24 / BLIK can sit behind Stripe’s payment method types later.

## Related

- `docs/auth-claim.md` — session required for checkout
- `docs/media-ot-hq.md` — FootageAsset / storage
- `docs/prawa-i-zgody.md` — rights gates
