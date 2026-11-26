# AI coach analysis MVP (PWF-21)

Diveye strategy **module 5** (S5.1 / S5.2): private coaching feedback from dive footage for athlete + linked trainer. Rule/heuristic (and optional LLM polish) over OT markers + mock depth/time — **not medical advice**.

## Disclaimer

Training aid only — not medical advice and not a substitute for in-water safety, a qualified coach, or federation rules. Blackout / BO markers are observational cues from footage, not a clinical diagnosis.

## Demo path

1. Open `/login?next=/dives/dive-0`
2. Sign in as athlete (password **`demo`**):

| Email | Role |
|---|---|
| `vitomir.demo@example.com` | athlete (owns Vitomir dives) |
| `coach.demo@example.com` | coach (assigned to Vitomir) |
| `admin.demo@example.com` | admin (can analyze / view) |

3. On `/dives/dive-0` tap **Analyze with AI coach** (athlete/admin).
4. Open `/account/coach` for the report list; coach account sees assigned athletes.

## API

`POST /api/coach/analyze` with JSON `{ "diveId": "dive-0" }`.

- Auth session required; only athlete owner or admin may generate.
- Builds deterministic findings from `FootageAsset` markers + performance AP/RP/card + mock telemetry (dive time from start→surface, depth from RP on depth disciplines).
- If `OPENAI_API_KEY` is set, optionally polishes the summary via OpenAI (`OPENAI_COACH_MODEL`, default `gpt-4o-mini`); otherwise engine is `template`.
- Persists `CoachReport` to `data/coach-reports.json` (`visibility: private`).

## Visibility

| Who | Can generate | Can view |
|---|---|---|
| Athlete owner (`athleteSlug` match) | yes | own reports |
| Linked coach (`data/coach-links.json`) | no | assigned athletes’ reports |
| Admin | yes | all |

## Model

- `CoachReport` — diveId, optional performanceId / footageAssetId, findings (`strength` \| `issue` \| `drill`), telemetrySnapshot, disclaimer, engine
- `CoachAthleteLink` — coachUserId ↔ athleteSlug (S5.2 stub)

## Code map

| Piece | Path |
|---|---|
| Types | `src/types/domain.ts` |
| Logic | `src/lib/coach.ts` |
| API | `src/app/api/coach/analyze/route.ts` |
| Dive UI | `src/components/CoachAnalyzePanel.tsx` on dive page |
| Account | `/account/coach`, `/account/coach/[id]` |
| Seed | `data/users.json` (`coach.demo@…`), `data/coach-links.json`, `data/coach-reports.json` |

## Out of scope

- Live video CV / pose estimation
- Coaching bookings / payments (S5.3)
- Medical or safety clearance tooling
