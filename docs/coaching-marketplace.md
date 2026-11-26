# Coaching marketplace bookings MVP (PWF-23)

Diveye strategy **module 5** (S5.3): book remote coaching packages in EUR against seeded availability. Simulated pay (same idea as the shop fallback). **Not** a schools map (S1.8 stays out).

## Commission (Diveye %)

Platform take rate is the config constant:

```ts
// src/lib/coaching-marketplace.ts
export const DIVYE_COACHING_COMMISSION_PERCENT = 15;
```

At booking time each `CoachingBooking` stores `commissionPercent`, `diveyeFeeEur`, and `coachPayoutEur` (gross − Diveye fee). Change the constant to adjust the MVP rate; docs and checkout UI read the same export.

## Demo booking path

1. Open `/coaching` (catalog of 4 coaches).
2. Open `/coaching/demo-coach` (or ana-depth / marek-pool / sofia-protocol).
3. Sign in as athlete: `/login?next=/coaching/demo-coach` → `vitomir.demo@example.com` / `demo`.
4. Pick a package + open UTC slot → **Pay (simulated)**.
5. Booking written to `data/coaching-bookings.json`; slot marked `booked` in `data/coaching-marketplace.json`.
6. Athlete: `/account?booking=CB-…` → **Upcoming coaching bookings**.
7. Coach: `/login` → `coach.demo@example.com` / `demo` → `/account/coach` **Incoming bookings** (also on `/account`).

| Email | Role | Marketplace |
|---|---|---|
| `vitomir.demo@example.com` | athlete | books sessions |
| `coach.demo@example.com` | coach | `/coaching/demo-coach` |
| `ana.coach@example.com` | coach | `/coaching/ana-depth` |
| `marek.coach@example.com` | coach | `/coaching/marek-pool` |
| `sofia.coach@example.com` | coach | `/coaching/sofia-protocol` |

## API

`POST /api/coaching/book` with JSON:

```json
{ "coachSlug": "demo-coach", "packageId": "pkg-demo-live", "slotId": "slot-demo-1" }
```

- Session required (401 + `loginRequired` otherwise).
- Simulated payment only in this MVP (`status: "paid_simulated"`). Stripe Checkout reuse for coaching is deferred — shop Stripe path stays separate.
- Persists booking + marks slot `booked`.

## Model

| Entity | File |
|---|---|
| `CoachProfile`, `CoachPackage`, `CoachAvailabilitySlot` | `data/coaching-marketplace.json` |
| `CoachingBooking` | `data/coaching-bookings.json` |
| Demo coach users | `data/users.json` |

## Code map

| Piece | Path |
|---|---|
| Types | `src/types/domain.ts` |
| Logic + commission | `src/lib/coaching-marketplace.ts` |
| Book API | `src/app/api/coaching/book/route.ts` |
| Catalog / profile | `/coaching`, `/coaching/[slug]` |
| Book UI | `src/components/BookSessionForm.tsx` |
| Athlete / coach lists | `/account`, `/account/coach` |

## Out of scope

- Schools / clubs map & venue bookings (S1.8)
- Stripe Checkout for coaching (optional later; shop already has Stripe)
- Calendar sync, cancellations, refunds, coach payout settlement
- Live video CV
