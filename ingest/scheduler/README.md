# Ingest scheduler

Cyclic refresh of AIDA + CMAS (and optional FR gap-fill).

## Entry point

```bash
PYTHONPATH=. python3 ingest/bin/live_sync.py --mode incremental
```

Flags:

| Flag | Meaning |
|---|---|
| `--mode incremental` | Recent ranking windows + newest CMAS comps (default) |
| `--mode full` | Broader year windows / more pages |
| `--skip-aida` / `--skip-cmas` / `--skip-fr-gaps` | Skip stages |
| `--skip-rebuild` | Sync raw/canonical only |
| `--min-interval 1.0` | Per-host polite delay (seconds) |
| `--aida-rank-pages` / `--aida-history-top` / `--cmas-limit` | Crawl budget |

## GitHub Actions

Workflow: `.github/workflows/live-sync.yml`

- Cron: `17 */6 * * *` (every 6 hours)
- Manual: Actions → **Live sync** → Run workflow
- Caches `data/ingest/**`, uploads coverage + `data/seed.json`
- On `main` / `cursor/*` branches, commits seed refresh when dirty

Enable: merge the workflow, ensure Actions are allowed for the repo, and grant `contents: write` if auto-commit is desired (default `GITHUB_TOKEN` push).

## Local cron

```cron
17 */6 * * * cd /path/to/depothboard && PYTHONPATH=. python3 ingest/bin/live_sync.py --mode incremental >> /var/log/depthboard-sync.log 2>&1
```

## Guarantees

- **Incremental / idempotent** — merges by stable ids (AIDA GUID, CMAS ResID/hmac)
- **Backoff** — `PoliteClient` retries 429/5xx with exponential backoff
- **PII scrub** — CMAS birth dates dropped; accreditation → HMAC
- **Coverage logs** — `data/ingest/canonical/live_sync_coverage.json` (+ `.jsonl` history)

See `docs/live-sync.md` for operator notes.
