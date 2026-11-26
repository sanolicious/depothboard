# Recording rights, consents & licences

See the project doc for the full PL summary: store `docs/prawa-i-zgody.md`.

## Rules (enforced in UI)

1. **AIDA / Diveye-owned** → downloadable products when athlete consents (recording + publication; commercial tier needs commercial consent).
2. **CMAS / `cmas_link`** → embed or link only; shop sale blocked.
3. **Minors** → restricted profile + guardian consent flag required.
4. **Claim** → signed-in `/claim` wizard → `POST /api/claims` logs to `data/claim-requests.json` and opens `mailto:claims@depthboard.com`.
5. **Auth** → demo cookie session; consent edits only for the profile owner. See `docs/auth-claim.md`.

## Seed

`data/rights-overlay.json` merges into `seed.json` at repository load (consents, recordingRights, demo showcase/products, provenance sources, licence tiers). Demo users: `data/users.json`.
