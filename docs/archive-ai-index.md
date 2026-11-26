# AI archive indexing MVP (PWF-22)

Diveye strategy **module 2** (S2.2 / S2.3): searchable VOD moments from Diveye OT markers + dive metadata. Heuristics always; optional OpenAI polish when `OPENAI_API_KEY` is set. **Not** a coaching marketplace (S5.3 stays out of scope).

## Demo path

1. Build (or refresh) the index:

```bash
npm run archive:index
# optional LLM polish on a sample of summaries:
OPENAI_API_KEY=sk-… npm run archive:index
```

   Or `POST /api/archive/index` with optional JSON `{ "enrich": true }`.

2. Open `/archive` — filter by athlete / discipline / marker, or free-text search.
3. Click a moment → `/dives/{id}?t={seconds}` — player seeks to that OT marker.

Example: `/archive?marker=penalty` → open the penalty moment → player lands near the penalty cue.

## Index shape

Persisted at `data/archive-index.json`:

| Field | Meaning |
|---|---|
| `moments[]` | One row per FootageAsset marker (preview assets preferred) |
| `atSec` / `seekUrl` | Absolute seconds + `/dives/{id}?t=` deep-link |
| `tags` | marker kind/label, discipline, athlete, card |
| `engine` | `heuristics` (default) or `llm` when OpenAI polished a sample |

CMAS `cmas_link` assets and marker-less rows are skipped.

## API

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/archive/index` | Metadata: `asOf`, `engine`, `momentCount` |
| `POST` | `/api/archive/index` | Rebuild from `data/footage.json` + `data/seed.json` |

Env: `OPENAI_API_KEY` (optional), `OPENAI_ARCHIVE_MODEL` (default `gpt-4o-mini`).

## Code map

| Piece | Path |
|---|---|
| Types | `src/types/domain.ts` (`ArchiveMoment`, `ArchiveIndexFile`) |
| Build / search | `src/lib/archive-index.ts` |
| CLI | `scripts/build-archive-index.ts` → `npm run archive:index` |
| API | `src/app/api/archive/index/route.ts` |
| UI | `/archive` filters + moment rows |
| Seek | `DivePlayer` `initialSeekSec` from `?t=` on `/dives/[id]` |
| Seed index | `data/archive-index.json` |

## Out of scope

- Live CV / pose estimation
- Interactive watching paths / edu interstitial (S2.4 / S2.5)
- Coaching bookings / marketplace (S5.3)
