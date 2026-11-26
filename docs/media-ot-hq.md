# Media OT / HQ — Diveye ↔ Depthboard

See the project doc: store `docs/media-ot-hq.md`.

## Quick map

| Piece | Path |
|---|---|
| `FootageAsset` type | `src/types/domain.ts` |
| Catalog | `data/footage.json` |
| OT match + local storage adapter | `src/lib/footage.ts` |
| Player + marker seek | `src/components/DivePlayer.tsx` |

**Match:** `performanceDiveId` or athlete+event+discipline+`officialTop` within `otToleranceMin` of `Performance.ot`.

**Mock keys:** `local:preview/shared.mp4` → `/video/hero.mp4` (HQ same placeholder until real disk/S3).

**Later:** swap `resolveStorageUrl` for disk mount or S3 signed URLs; keep marker kinds and rights model (`diveye_owned` vs `cmas_link`).
