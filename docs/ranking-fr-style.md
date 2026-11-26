# Ranking w stylu FR (Portal Points)

Data: 26 listopada 2026 (Europe/Warsaw).

## Źródła

| Priorytet | Źródło | Rola |
|---|---|---|
| 1 | AIDA (HTML/GUID) | wyniki + ranking slices |
| 1 | CMAS (API + PDF) | wyniki oficjalne / historyczne |
| 2 | FR (freediveranking.com) | **tylko uzupełnianie luk** — każdy rekord `source: FR` + `provenance` URL |

Przy konflikcie tego samego dive’u (zawodnik×dyscyplina×data×wynik) wygrywa AIDA/CMAS. Boardy AIDA-only / CMAS-only **nie** biorą wierszy FR. Portal = suma PB z 8 dyscyplin (AIDA+CMAS+FR-gap).

## Metodologia

| Element | Reguła |
|---|---|
| Punkty | Głębia 1 pkt/m; DYN/DYNB/DNF 0,5; STA 0,2 pkt/s |
| Active | 24 miesiące względem `asOf` |
| All-time | bez okna (porównanie z FR) |
| Karty | RED wykluczone; YELLOW = punkty po karach |
| Remisy | olimpijskie; tie-break %WR → #dyscyplin → wcześniejsza data PB |
| FR plausibility | twarde capy (np. CNF ≤130 m) — odrzut błędnych parsowań HTML |

Kod: `src/lib/ranking.ts`. Rebuild: `ingest/bin/rebuild_seed.py`. FR: `ingest/fr/client.py`, `ingest/bin/fr_gap_fill.py`. Live: `ingest/bin/live_sync.py` + `.github/workflows/live-sync.yml`.

## Seed (po FR gap-fill)

| Metryka | Wartość |
|---|---:|
| Zawodnicy | **3050** |
| Results | **~24,4k** (w tym ~1,5k `source: FR`) |
| asOf | 2026-11-26 |

## Zgodność vs FR top-50 (cel ≥48/50)

| Płeć | Nazwa w naszym top-50 | ±15 pkt | ±40 pkt |
|---|---:|---:|---:|
| M | **50/50** | 41 | 46 |
| K | **50/50** | 47 | 48 |

Wszystkie wcześniejsze luki (Richard, Lira, Alouach, Giankos, Kardašević, Załęcka, Paganelli, Wendland, Paris) są w top-50. Molchanov DYNB 252 m (126 pkt) domknięty z FR.

Pozostałe rozjazdy punktów (Kubiak/Colak/Bourdila nieco wyżej; Kai Xiao niżej) = inne pokrycie zawodów / karty, nie brak nazwisk.

## Live sync

Patrz `docs/live-sync.md` — cron GitHub Action co 6 h lub lokalny `live_sync.py`.

## Artefakty

- Branch: `cursor/fr-gapfill-live-sync-bf02`
- Porównanie: `data/ingest/fr/portal_compare.json`
- Weryfikacja: `docs/weryfikacja-aida-cmas-fr.md`
