# Depthboard (Diveye)

English-language freediving results, rankings and Diveye footage portal — Next.js App Router + TypeScript MVP.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build && npm start
```

## Data layer

- Seed JSON: `data/seed.json` (AIDA/CMAS ingest + partial real data; fictional fallback where needed).
- Access via `getRepository()` in `src/lib/repository.ts` (`JsonRepository`).
- Swap for `PostgresRepository` later without changing page code.

## Ingest

See [`ingest/README.md`](ingest/README.md).

```bash
PYTHONPATH=. python3 ingest/bin/run_ingest.py --out data/ingest
```

- Sources: AIDA HTML/AJAX, CMAS Microplus JSON API (PII scrubbed).
- **freediveranking.com is verification-only** — never imported into the database.
- Output: `data/ingest/canonical/`, `data/seed.json` (JsonRepository shape).

## Postgres / scrapers plan

1. **Schema**: athletes, events, performances, dive_assets, markers, products, orders, claims; provenance columns (`source`, `fetched_at`, `raw_ref`).
2. **Ingest**: AIDA HTML parsers + CMAS API/PDF workers (no scraping of competitors). Mark results `unofficial` until jury confirmation.
3. **Ranking**: recompute Portal / AIDA / CMAS boards from performances + versioned rule set.
4. **Media**: Diveye OT markers linked to performances; sample preview → licence checkout.
5. **Auth**: claim email queue + guardian flow for minors (`noindex` by default).

## MVP routes

`/`, `/rankings`, `/athletes`, `/athletes/[slug]`, `/events/[slug]`, `/dives/[id]`, `/archive`, `/calendar`, `/records`, `/shop`, `/cart`, `/claim`, `/account`, `/privacy`, `/terms`, `/cookies`, `/embed/events/[slug]`, `sitemap.xml`, `robots.txt`, 404.

## Note

Working product name: **Depthboard**. Endorsement: platform by the team behind Diveye.
