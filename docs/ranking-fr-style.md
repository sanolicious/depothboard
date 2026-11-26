# Ranking w stylu FR (Portal Points)

Data: 26 listopada 2026 (Europe/Warsaw).  
Źródła rankingowe: **AIDA + CMAS (API + PDF)** — FR tylko do weryfikacji.

## Metodologia (jak FR / AIDA)

| Element | Reguła |
|---|---|
| Punkty | Głębia (CWT/CWTB/CNF/FIM): **1 m = 1 pkt**; dynamika (DYN/DYNB/DNF): **0,5 pkt/m**; STA: **0,2 pkt/s** |
| OVERALL / Portal | Suma **personal bestów** z 8 dyscyplin |
| Federacje w Portal | PB z wyników **AIDA i CMAS** (API Microplus + historyczne PDF-y CMAS) |
| AIDA-only / CMAS-only | Osobne boardy |
| Karty | **RED/DQ** → nie PB; **YELLOW** → wynik po karach; **WHITE** → pełne |
| Active | Okno **24 miesiące** względem `asOf` |
| All-time | Bez okna — porównywalne z FR |
| Remisy | Pozycja olimpijska; tie-break %WR → liczba dyscyplin → wcześniejsza data PB |

Kod: `src/lib/ranking.ts`. Rebuild: `ingest/bin/rebuild_seed.py`. PDF: `ingest/cmas/pdf_parse.py`, `ingest/bin/ingest_cmas_pdfs.py`.

## Co weszło do seeda

| Metryka | Wartość |
|---|---:|
| Zawodnicy | **3050** |
| Performances (seed) | **~22,9k** |
| AIDA historia | ~13,2k |
| CMAS API | 1948 |
| CMAS PDF (po dedupie) | ~3,2k+ wierszy z WC/EC/World Cup indoor+depth |
| Slice AIDA PB | ~5400 |

UI (`data/seed.json` / store `site/data/seed.json`) na tych danych.

### CMAS PDF

- Źródło: `cmas.org` edocman (`task=document.download&id=…`) — bez logowania; część archiwów to ZIP.
- Indoor m.in.: Belgrade 2024, Lignano 2018/2016, EC Istanbul 2019, Kuwait 2023 (ZIP), Novi Sad 2026, Barranquilla/pool cups, nOxy.
- Depth m.in.: Kalamata 2024, Roatan 2023, outdoor WC 2018–2022, Authentic Big Blue 2024, Vertical Blue 2021.
- Parser obsługuje layouty Microplus / organizer / dive-log (per-row discipline).

## Zgodność vs FR top-50 (all-time Portal)

Cel: **≥45/50** nazwisk w naszym top-50.

| Płeć | Nazwa w naszym top-50 | Obecni w DB | Punkty ±15 | Punkty ±40 |
|---|---:|---:|---:|---:|
| M | **46/50** | 50/50 | 36 | 38 |
| K | **45/50** | 50/50 | 37 | 40 |

### Nadal poza naszym top-50

**M (4):** Vivien Richard, Sebastian Lira, Abdelatif Alouach, Emmanouil Giankos (brak GUID AIDA).  
**K (5):** Mirela Kardašević (głównie brak głębokości CMAS w PB), Agata Załęcka, Linda Paganelli, Jennifer Wendland, Claire Beatrix Paris.

### Po PDF — przykłady domknięć

- **Alessia Zecchini** → #3 / **820** (DYN 253, DYNB 228,15 z EC 2019; było ~601).
- **Guillaume Bourdila** → #10 / **801** (Kuwait DYN 306,6 + DNF 236).
- **Boris Milosic**, **Vincent Mathieu**, **Ioannis Kothonidis** weszli do top-50 M po basenie/głębi z PDF.
- **Molchanov** nadal bez DYNB 252 m (w dostępnych PDF tylko DQ / monofin) — Δ vs FR ~−130.

## Wniosek

Cel **≥45/50 M i K osiągnięty** dzięki CMAS PDF (szczególnie basen). Pozostałe luki = zawody poza pobranym zestawem PDF / warianty nazw / brak historii AIDA. Dalsze PDF (mini-cups, krajowe) + ręczne aliasy domkną resztę.

## Artefakty

- PR: https://github.com/sanolicious/depothboard/pull/3 (`cursor/ranking-fr-style-bf02`)
- Porównanie: `data/ingest/fr/portal_compare.json` / store `internal/ingest/fr/`
- Ten dokument + `docs/weryfikacja-aida-cmas-fr.md`
