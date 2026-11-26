# Field app MVP — dive assignment (PWF-19)

Mobile-first **web** field UI for operators (not native) at `/field`. Uses ecosystem hooks from PWF-16: `Device`, `FieldSession`, `DiveAssignment`.

## Demo path

1. Open `/login?next=/field`
2. Sign in (password **`demo`**):

| Email | Role |
|---|---|
| `operator.demo@example.com` | operator |
| `admin.demo@example.com` | admin |

3. **`/field`** → pick device → Open session → select athlete (list or QR text) → Assign → **Sync**

## Behaviour

- Offline buffer: `localStorage` key `depthboard:field:buffer`
- Sync: `POST /api/field/sync` → `data/field-runtime.json` (merged over `ecosystem.json`)
- Creates/links `DiveAssignment` + optional provisional `Performance` stub
- Rejects assign without granted recording consent (guardian for minors)

## Code

| Piece | Path |
|---|---|
| UI | `src/app/field/page.tsx`, `src/components/FieldApp.tsx` |
| Buffer | `src/lib/field-buffer.ts` |
| Sync | `src/lib/field-sync.ts`, `src/app/api/field/sync/route.ts` |
| Runtime | `src/lib/field-runtime.ts` |

## Out of scope

Federation, AI, native apps, real QR camera, hardware product UI.
