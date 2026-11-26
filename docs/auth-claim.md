# Auth + athlete profile claim (PWF-14)

Demo credentials cookie session and four-step claim wizard.

## Sign in

1. Open `/login`
2. Use a seed account (password for all: `demo`):

| Email | Role | Athlete after login |
|---|---|---|
| `vitomir.demo@example.com` | athlete | Vitomir Maričić (approved) |
| `guardian.demo@example.com` | guardian | Demo Junior |
| `pending.demo@example.com` | visitor | none — claim **pending** on Petar Klovar |
| `fan.demo@example.com` | visitor | none — seed claim **rejected**; re-submit via `/claim` |

Session cookie: `depthboard_session` (HMAC-signed, httpOnly). Optional env: `AUTH_SECRET`.

Protected: `/account` (middleware → `/login?next=/account`).

## Claim path

1. Sign in (step 1) → `/login?next=/claim`
2. Find profile (step 2) → search / `This is me` (or `/claim?slug=…` from athlete page)
3. Verify (step 3) → email match / event proof / coach / ID
4. Done (step 4) → `POST /api/claims` writes `data/claim-requests.json` + opens `mailto:claims@depthboard.com`

Statuses: `pending` · `needs_info` · `approved` · `rejected`.  
Account shows claims for the signed-in email/userId. After **approved**, athlete (and appearances / consents) appear on `/account`.

## Consents gate

Consent toggles on `/account` only when the session owns that athlete (`athleteSlug` on user **or** approved claim).

## Out of scope

Stripe / real checkout (PWF-15), production email magic-link delivery, OAuth providers.
