# Live sync (AIDA + CMAS)

Data: 26 listopada 2026 (Europe/Warsaw).

## Cel

Cykliczne odświeżanie wyników:

1. AIDA — ranking slices + historie top / thin
2. CMAS Microplus — nowe / live zawody (PII scrub)
3. Opcjonalnie FR gap-fill (rate-limit, `source: FR`)
4. `rebuild_seed.py` → rankingi + `data/seed.json`
5. Log pokrycia

## Jak włączyć

### GitHub Actions (zalecane)

Workflow: `.github/workflows/live-sync.yml`

- Cron: `17 */6 * * *` (co 6 h)
- Manual: **Actions → Live sync → Run workflow**
- Inputy: `mode` (`incremental`|`full`), `skip_fr_gaps`
- Cache `data/ingest/**`, artifact z coverage + seed
- Na `main` / `cursor/*` commituje odświeżony seed gdy są zmiany

Wymagania: Actions włączone w repo; push seeda używa `GITHUB_TOKEN` (contents write).

### Lokalnie / cron

```bash
cd /path/to/depothboard
PYTHONPATH=. python3 ingest/bin/live_sync.py --mode incremental --min-interval 1.0
```

```cron
17 */6 * * * cd /path/to/depothboard && PYTHONPATH=. python3 ingest/bin/live_sync.py --mode incremental >> /var/log/depthboard-sync.log 2>&1
```

Pakiet: `ingest/scheduler/` (stałe + README).

## Gwarancje

| | |
|---|---|
| Incremental | merge po GUID AIDA / ResID+hmac CMAS |
| Idempotent | ponowny run nie duplikuje |
| Backoff | `PoliteClient` 429/5xx + min-interval |
| PII | CMAS DOB drop; accreditation → HMAC |
| FR | tylko luki; `source: FR` + provenance; preferencja AIDA/CMAS przy tym samym dive |

## Provisional → official (PWF-17)

`live_sync` / rebuild stampują status wyniku w cyklu:

| Status | Kiedy | UI | Ranking |
|---|---|---|---|
| `provisional` | Zawody `status=live`; świeży feed (brak jury) | badge **live** / provisional | poza rankingiem |
| `unofficial` | Dzień zamknięty / jury pending | badge unofficial | poza rankingiem |
| `official` | Potwierdzenie federacji / steward / timeout | badge official | Portal Points |

Hook w kodzie:

1. Event w toku → `events[].status = "live"` (+ opcjonalnie `liveUrl`, `day`, `ofDays`).
2. Attempt bez `result_status` przy live evencie → `export_seed` ustawia `performances[].status = "provisional"` (`ingest/common/export_seed.py`).
3. Federacja / steward może nadpisać `result_status` / `status` na `unofficial` lub `official`.
4. `export_seed` buduje `seed.liveResults` z provisional/unofficial pierwszego live eventu (home LiveBar board).
5. Portal: `GET /api/events/[id]/results` + client poll ~30 s; ranking filtruje tylko `official`.

Demo bez pełnego rebuildu: `data/live-demo.json` (merge w `src/lib/live-demo.ts`).

## Logi

- `data/ingest/canonical/live_sync_coverage.json` — ostatni run
- `data/ingest/canonical/live_sync_history.jsonl` — historia
- `data/ingest/canonical/fr_gap_coverage.json` — FR gap-fill
- `data/ingest/fr/portal_compare.json` — overlap vs FR top50

## Powiązane

- `docs/ranking-fr-style.md` — metodologia Portal Points
- `docs/weryfikacja-aida-cmas-fr.md` — liczby zgodności
- Project store `docs/live-provisional.md` — ścieżka UI live/provisional
