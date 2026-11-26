# Federation judges — training & evidence (PWF-20)

Diveye strategy **module 6** (S6.1 / S6.2): training materials, borderline card quizzes, judge panel with tags + evidence. Hybrid on-site/async — **async UI first**.

## Demo path

1. Open `/login?next=/federation`
2. Sign in (password **`demo`**):

| Email | Role |
|---|---|
| `judge.demo@example.com` | judge |
| `admin.demo@example.com` | admin (federation admin) |

3. **`/federation`** hub → Training or Evidence

## Routes

| Path | Purpose |
|---|---|
| `/federation` | Hub — materials summary + links |
| `/federation/training` | Case list (clear / borderline / hard) |
| `/federation/training/[id]` | White / yellow / red quiz + tags; scored vs seed reference |
| `/federation/evidence` | Evidence pack list |
| `/federation/evidence/[id]` | FootageAsset + markers + panel tags |

Middleware requires a session for `/federation/*`. Role gate: `judge` \| `admin`.

## Scoring

Composite **0–100** = 70% card match + 30% tag F1 against `referenceCard` / `referenceTags` in seed.

## Seed

`data/federation-judges.json` — 8 anonymized/synthetic training cases, 8 evidence packs linked to existing `FootageAsset` ids in `data/footage.json` (e.g. `fa-dive-0-preview`, `fa-dive-1-preview`, `fa-dive-4-preview`, CMAS embed pack).

## Code map

| Piece | Path |
|---|---|
| Types | `src/types/domain.ts` (`JudgeTrainingCase`, `JudgeEvidencePack`, …) |
| Catalog | `src/lib/federation.ts`, `src/lib/federation-score.ts` |
| Auth | `canAccessFederation()` in `src/lib/auth.ts` |
| UI | `src/app/federation/**`, `src/components/TrainingQuiz.tsx`, `EvidencePackPanel.tsx`, `FederationShell.tsx` |

## Out of scope

- Live on-site judge hardware sync (stub copy only)
- Persisted quiz history / federation CMS

AI coach / technique feedback is **PWF-21** — see `docs/ai-coach.md`.
