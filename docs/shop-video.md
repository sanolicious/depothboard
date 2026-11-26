# Video shop funnel (PWF-15 + PWF-18)

Diveye AIDA footage licences. Simulated checkout always available; Stripe Checkout (test mode) when env keys are set.

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

## Buy a demo clip end-to-end (simulated)

1. Sign in: `/login` → `vitomir.demo@example.com` / `demo`
2. Open `/shop` (or `/dives/dive-0` → **Buy clip**)
3. Add e.g. social (€29) or free sample
4. `/cart` → **Pay (simulated)** when Stripe keys are unset (banner explains fallback)
5. Order written to `data/orders.json` with `status: "paid_simulated"`
6. Delivery links / processing notes on `/account` (orders + library)

Guests may add to cart; checkout returns **401** and redirects to login.

## Stripe Checkout (test mode)

Requires env (see `.env.example` — **never commit secrets**):

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` — enables Checkout Session create |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` — verifies `checkout.session.completed` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` — documented for Dashboard / future Elements |
| `NEXT_PUBLIC_APP_URL` | Optional origin for success/cancel URLs |

### Local test steps

1. Copy `.env.example` → `.env.local` and paste **test** keys from [Stripe Dashboard → Developers](https://dashboard.stripe.com/test/apikeys).
2. Start the app: `npm run dev` (default `http://localhost:3000`).
3. Forward webhooks (separate terminal):

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   Put the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET` and restart `next dev`.
4. Sign in, add a paid tier to the cart, open `/cart` → **Pay with Stripe**.
5. Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC.
6. Success → `/account?order=ORD-…&checkout=success`. Webhook sets `status: "paid"` and runs the same `deliveryForTier` entitlements as simulated pay.
7. Cancel → `/account?order=ORD-…&checkout=cancelled` (cart kept).

Without `STRIPE_SECRET_KEY`, the cart shows a banner and the simulated button only.

### API

- `GET /api/checkout/session` → `{ stripeConfigured }`
- `POST /api/checkout/session` `{ items }` → pending order + Stripe Session `{ url }`
- `POST /api/stripe/webhook` → `checkout.session.completed` → fulfill order
- `POST /api/orders` `{ items }` → simulated paid order (local demo)
- `GET /api/orders` → current user’s orders

Cart lives in `localStorage` key `depthboard_cart_v1` (drawer + `/cart` share it).

P24 / BLIK can sit behind Stripe’s payment method types later.

## Related

- `docs/auth-claim.md` — session required for checkout
- `docs/media-ot-hq.md` — FootageAsset / storage
- `docs/prawa-i-zgody.md` — rights gates
