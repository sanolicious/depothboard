# Weryfikacja AIDA + CMAS vs FR (Portal)

Data: 26 listopada 2026 (Europe/Warsaw).  
FR = tylko weryfikacja; ranking Portal budowany z AIDA + CMAS (API + PDF).

## Metryki top-50 (all-time)

| | M | K |
|---|---:|---:|
| Nazwa w naszym top-50 | **46/50** | **45/50** |
| Obecni w DB (dowolny rank) | 50/50 | 50/50 |
| Punkty ±15 | 36 | 37 |
| Punkty ±40 | 38 | 40 |

Cel Piotr (≥45/50 M i K): **spełniony**.

## Seed

| | |
|---|---:|
| Athletes | 3050 |
| Events | 4032 |
| Results | ~22 925 |
| asOf | 2026-11-26 |

## Źródła CMAS PDF (skrót)

Indoor: Belgrade WC 2024, Lignano WC 2018/2016, Istanbul EC 2019, Kuwait WC 2023, Novi Sad 2026, Barranquilla, nOxy.  
Depth: Kalamata 2024, Roatan 2023, outdoor WC 2018–2022, Authentic Big Blue 2024, VB 2021.

## Braki vs FR top-50

**M:** Vivien Richard (#20 FR / #163), Sebastian Lira (#33/#99), Abdelatif Alouach (#41/#180), Emmanouil Giankos (#44/#167).  
**K:** Mirela Kardašević (#11/#86), Agata Załęcka (#28/#60), Linda Paganelli (#31/#106), Jennifer Wendland (#40/#54), Claire Beatrix Paris (#49/#59).

Główne przyczyny: brak GUID AIDA, brak PDF z kluczowych startów, warianty nazw, niepełna historia CMAS depth dla Kardašević.

## Kluczowe PB po PDF

| Zawodnik | Rank | Punkty | Notatka |
|---|---:|---:|---|
| Alessia Zecchini | 3 | 820 | DYN/DYNB z EC Istanbul 2019 |
| Alexey Molchanov | 4 | 851 | bez DYNB 252 (w PDF tylko DQ/monofin) |
| Guillaume Bourdila | 10 | 801 | Kuwait DYN/DNF |
| Boris Milosic | 46 | 688 | basen CMAS |
| Vincent Mathieu | 45 | 691 | DYNB z PDF |
| Ioannis Kothonidis | 49 | 687 | CWTB z depth PDF |

Szczegóły rankingu: `docs/ranking-fr-style.md`.  
PR: https://github.com/sanolicious/depothboard/pull/3
