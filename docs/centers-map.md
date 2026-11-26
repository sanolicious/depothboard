# Schools & centers map catalog (PWF-24)

Diveye strategy **module 1** light slice: **S1.7** (map of schools / clubs / partners) and **S1.8** profile pages without venue booking.

## Demo path

1. Open `/centers` — schematic map + list of 12 seeded venues.
2. Filter by **country**, **Diveye Connected**, or **course type** (chip query params).
3. Open a profile, e.g. `/centers/adriatic-depth-school`.
4. From `/calendar` or the home “Recent competitions” header, follow **Schools & centers**.

Connected pins use the accent `map-dot--diveye` style (same schematic projection as the events calendar).

## Filters

| Query | Values | Effect |
|---|---|---|
| `country` | ISO-2 (`HR`, `ES`, …) | Match `DiveCenter.country` |
| `diveye` | `1` | Only `diveyeConnected: true` |
| `course` | `aida` \| `cmas` \| `fun` \| `competition` \| `safety` \| `instructor` | Match `courseTypes` |

Example: `/centers?country=HR&diveye=1&course=aida`

## Model

| Entity | File |
|---|---|
| `DiveCenter`, `CenterCourseType` | `src/types/domain.ts` |
| Seed (12 centers) | `data/centers.json` |
| Load + filters | `src/lib/centers.ts` |

Each center carries `lat` / `lng`, `country`, `courses` + `courseTypes`, `diveyeConnected`, and orientative `priceFromEur` / `priceToEur`.

## Code map

| Piece | Path |
|---|---|
| Catalog + map | `/centers` |
| Profile | `/centers/[slug]` |
| Nav / footer | `SiteChrome` |
| Calendar / home links | `/calendar`, `/` |

## Out of scope

- Venue course booking / payments (full S1.8 marketplace)
- Leaflet / real basemap tiles (schematic panel reused from calendar)
- Live inventory of Diveye kits per week
