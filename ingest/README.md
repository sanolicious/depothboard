# Ingest pipeline (AIDA + CMAS)

Polite public-source ingest for Depthboard. **FR (freediveranking.com) is used only for verification**, never as a data source.

## Layout

```
ingest/
  common/     # HTTP client, normalize, entity resolution, seed export
  aida/       # AIDA HTML/AJAX client
  cmas/       # CMAS Microplus JSON API (PII scrubbed)
  fr/         # Rate-limited comparison helpers
  bin/run_ingest.py
data/ingest/  # raw (hashed) + canonical JSON + seed.json
```

## Run

```bash
cd /path/to/depothboard
PYTHONPATH=. python3 ingest/bin/run_ingest.py --out data/ingest
```

Useful flags:

- `--aida-rank-pages 25` — pages per ranking slice (~10 athletes/page)
- `--aida-history-top 120` — athletes with full `fetch_results_html` history
- `--skip-fr` / `--skip-aida` / `--skip-cmas`
- `--min-interval 0.9` — seconds between requests per host

## Privacy

CMAS API returns birth dates and accreditation codes. Before storage we:

- drop birth-date fields from scrubbed JSON
- replace `ParAccreditationCode` with HMAC (`ParAccreditationHmac`)

## Coverage note

A full AIDA overall ranking is ~1200 pages per gender. Default run takes top pages across overall + 8 disciplines × M/F (all-time) plus year filters 2025/2026, then full history for top-N athletes, and **all** freediving competitions from the CMAS Microplus API.
