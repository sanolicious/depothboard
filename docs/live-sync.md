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

## Logi

- `data/ingest/canonical/live_sync_coverage.json` — ostatni run
- `data/ingest/canonical/live_sync_history.jsonl` — historia
- `data/ingest/canonical/fr_gap_coverage.json` — FR gap-fill
- `data/ingest/fr/portal_compare.json` — overlap vs FR top50

## Powiązane

- `docs/ranking-fr-style.md` — metodologia Portal Points
- `docs/weryfikacja-aida-cmas-fr.md` — liczby zgodności
