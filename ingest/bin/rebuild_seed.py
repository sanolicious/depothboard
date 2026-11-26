#!/usr/bin/env python3
"""Rebuild persons/performances/seed from cached AIDA+CMAS without re-crawling.

Adds:
- AIDA ranking-slice PB enrichment (official AIDA discipline bests)
- Display-name / alias fixes for FR verification
- Forced AIDA↔CMAS and AIDA↔AIDA merges for known split identities
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from ingest.common.export_seed import (  # noqa: E402
    build_seed,
    compute_overall_ranking,
    write_seed,
)
from ingest.common.normalize import (  # noqa: E402
    DISCIPLINE_FACTOR,
    country_to_iso3,
    name_tokens_sorted,
    normalize_name,
)
from ingest.common.resolve import EntityResolver  # noqa: E402
from ingest.fr.client import plausible_pb  # noqa: E402

DISPLAY_FIXES = {
    "763fc9ba-a337-43aa-961e-edaa22c6da9f": {
        "name": "Sofía Gómez Uribe",
        "aliases": ["Sofia Gomez", "Sofia Gómez"],
        "country": "COL",
        "country_iso3": "COL",
        "sex": "F",
    },
}

# CMAS hmac → prefer AIDA person
FORCE_CMAS_TO_AIDA = [
    {
        "aida": "24fe8083-d326-4e8b-aa51-eed1e4bedbd8",
        "cmas_hmac": "359ed8d57a0c028831e56946d28cad16cc697aa34d8c65ea2a7a06e844731959",
        "name": "Isabel Sanchez Aran",
        "aliases": ["Isabel Sanchez", "Isabel Aran"],
    },
]

# AIDA duplicate profiles (same athlete, two GUIDs) — keep first as canonical
FORCE_AIDA_DUPES = [
    {
        "canonical": "4828b926-902d-46b5-81f8-7badb5842bb4",
        "aliases_guids": ["00000000-0000-0000-0000-000000001917"],
        "name": "Sebastian Lira",
        "sex": "M",
    },
]


def match_name(a: str, b: str) -> bool:
    if name_tokens_sorted(a) == name_tokens_sorted(b) or normalize_name(a) == normalize_name(
        b
    ):
        return True
    ta, tb = set(normalize_name(a).split()), set(normalize_name(b).split())
    return len(ta) >= 2 and len(tb) >= 2 and (ta <= tb or tb <= ta)


def main() -> int:
    canonical = ROOT / "data" / "ingest" / "canonical"
    out = ROOT / "data" / "ingest"

    aida_athletes = {
        a["id"]: a for a in json.loads((canonical / "aida_athletes.json").read_text())
    }
    aida_results = json.loads((canonical / "aida_results.json").read_text())
    cmas_people = json.loads((canonical / "cmas_athletes.json").read_text())
    cmas_attempts = json.loads((canonical / "cmas_attempts.json").read_text())
    cmas_pdf_path = canonical / "cmas_pdf_attempts.json"
    cmas_pdf_attempts = (
        json.loads(cmas_pdf_path.read_text()) if cmas_pdf_path.exists() else []
    )
    events_existing = {
        e["id"]: e for e in json.loads((canonical / "events.json").read_text())
    }
    slices = json.loads((canonical / "aida_ranking_slices.json").read_text())

    for guid, fix in DISPLAY_FIXES.items():
        cur = aida_athletes.get(guid, {"id": guid})
        cur.update({k: v for k, v in fix.items() if k != "aliases"})
        cur["id"] = guid
        cur["aliases"] = fix.get("aliases", [])
        aida_athletes[guid] = cur

    for r in aida_results:
        if r["athlete_id"] not in aida_athletes:
            aida_athletes[r["athlete_id"]] = {
                "id": r["athlete_id"],
                "name": r.get("athlete_name") or r["athlete_id"],
                "sex": r.get("sex") or "M",
                "country": r.get("country") or "",
                "country_iso3": country_to_iso3(r.get("country")),
            }

    for dupe in FORCE_AIDA_DUPES:
        can = dupe["canonical"]
        if can not in aida_athletes:
            aida_athletes[can] = {
                "id": can,
                "name": dupe["name"],
                "sex": dupe["sex"],
                "country": "",
                "country_iso3": "UNK",
            }
        aida_athletes[can]["name"] = dupe["name"]
        aida_athletes[can]["sex"] = dupe["sex"]

    resolver = EntityResolver()
    for a in aida_athletes.values():
        resolver.add_aida(a)

    # Collapse AIDA duplicate GUIDs onto canonical person
    for dupe in FORCE_AIDA_DUPES:
        can_pid = resolver.by_aida.get(dupe["canonical"])
        if not can_pid:
            continue
        can_person = next(p for p in resolver.persons if p.id == can_pid)
        can_person.name = dupe["name"]
        for g in dupe["aliases_guids"]:
            old = resolver.by_aida.get(g)
            resolver.by_aida[g] = can_pid
            can_person.identifiers.append(
                {"source": "AIDA", "external_id": g, "type": "HARD"}
            )
            if old and old != can_pid:
                other = next((p for p in resolver.persons if p.id == old), None)
                if other:
                    for al in other.aliases + other.source_names + [other.name]:
                        if al and al not in can_person.aliases and al != can_person.name:
                            can_person.aliases.append(al)
                    resolver.persons = [p for p in resolver.persons if p.id != old]
            print(f"aida-dupe {dupe['name']}: {g} -> {dupe['canonical']}")

    for a in cmas_people:
        resolver.add_cmas(a)

    for m in FORCE_CMAS_TO_AIDA:
        aida_pid = resolver.by_aida.get(m["aida"])
        cmas_pid = resolver.by_cmas_hmac.get(m["cmas_hmac"])
        if not aida_pid:
            continue
        person = next(p for p in resolver.persons if p.id == aida_pid)
        person.name = m["name"]
        for al in m.get("aliases") or []:
            if al not in person.aliases:
                person.aliases.append(al)
        resolver.by_cmas_hmac[m["cmas_hmac"]] = aida_pid
        if not any(
            i.get("external_id") == m["cmas_hmac"] for i in person.identifiers
        ):
            person.identifiers.append(
                {"source": "CMAS", "external_id": m["cmas_hmac"], "type": "HARD"}
            )
        if cmas_pid and cmas_pid != aida_pid:
            other = next((p for p in resolver.persons if p.id == cmas_pid), None)
            if other:
                for al in other.aliases + other.source_names:
                    if al and al not in person.aliases and al != person.name:
                        person.aliases.append(al)
                resolver.persons = [p for p in resolver.persons if p.id != cmas_pid]
            print(f"cmas-merge {m['name']}: {cmas_pid} -> {aida_pid}")

    for guid, fix in DISPLAY_FIXES.items():
        pid = resolver.by_aida.get(guid)
        if not pid:
            continue
        person = next(p for p in resolver.persons if p.id == pid)
        person.name = fix["name"]
        person.country = fix.get("country_iso3") or person.country
        for al in fix.get("aliases") or []:
            if al not in person.aliases:
                person.aliases.append(al)

    resolved = resolver.to_json()
    (canonical / "persons.json").write_text(
        json.dumps(resolved, indent=2, ensure_ascii=False)
    )
    aida_to_person = resolver.by_aida
    cmas_to_person = resolver.by_cmas_hmac

    events = dict(events_existing)
    performances: list[dict] = []
    for r in aida_results:
        pid = aida_to_person.get(r["athlete_id"])
        if not pid:
            continue
        eid = r.get("event_id") or f"aida-ev-{abs(hash(r.get('event_name') or '')) % 10_000_000}"
        if eid not in events:
            events[eid] = {
                "id": eid,
                "name": r.get("event_name"),
                "federation": "AIDA",
                "date": r.get("date"),
                "country": r.get("country"),
            }
        performances.append(
            {
                **r,
                "athlete_id": pid,
                "source_athlete_id": r["athlete_id"],
                "event_id": eid,
                "federation": "AIDA",
            }
        )

    for r in cmas_attempts:
        hmac_id = r.get("athlete_hmac")
        pid = cmas_to_person.get(hmac_id) if hmac_id else None
        if not pid:
            continue
        performances.append(
            {
                **r,
                "athlete_id": pid,
                "athlete_name": r.get("athlete_name"),
                "record_flags": [r["record"]] if r.get("record") else [],
            }
        )

    # CMAS PDF attempts — match by normalized name (+ sex when present)
    person_by_tok: dict[str, str] = {}
    person_meta = {p.id: p for p in resolver.persons}
    for p in resolver.persons:
        person_by_tok[name_tokens_sorted(p.name)] = p.id
        for al in p.aliases + p.source_names:
            person_by_tok[name_tokens_sorted(al)] = p.id

    def resolve_pdf_name(name: str, sex: str | None) -> str | None:
        tok = name_tokens_sorted(name)
        pid = person_by_tok.get(tok)
        if pid:
            # Exact name match wins; PDF page sex headers are often wrong.
            return pid
        # token containment for multi-part surnames / reversed order
        nt = set(normalize_name(name).split())
        if len(nt) < 2:
            return None
        best = None
        best_n = 0
        for p in resolver.persons:
            if sex and p.sex and p.sex != sex:
                continue
            pt = set(normalize_name(p.name).split())
            for al in p.aliases:
                pt |= set(normalize_name(al).split())
            inter = len(nt & pt)
            if inter >= 2 and inter > best_n and (
                nt <= pt or pt <= nt or inter >= min(3, len(nt))
            ):
                best = p.id
                best_n = inter
        return best

    # Normalize PDF cards to export_seed vocabulary
    def norm_card(c: str | None) -> str:
        c = (c or "WHITE").upper()
        if c in {"W", "WHITE"}:
            return "WHITE"
        if c in {"Y", "YELLOW"}:
            return "YELLOW"
        if c in {"R", "RED"}:
            return "RED"
        return c

    pdf_linked = pdf_miss = 0
    for r in cmas_pdf_attempts:
        if r.get("discipline") not in DISCIPLINE_FACTOR:
            continue
        pid = resolve_pdf_name(r.get("athlete_name") or "", r.get("sex"))
        if not pid:
            pdf_miss += 1
            continue
        pdf_linked += 1
        eid = r.get("event_id") or f"cmas-pdf-ev-{abs(hash(r.get('event_name') or '')) % 10_000_000}"
        if eid not in events:
            events[eid] = {
                "id": eid,
                "name": r.get("event_name") or "CMAS PDF event",
                "federation": "CMAS",
                "date": r.get("date"),
                "country": r.get("country"),
                "type": "pool",
                "status": "past",
            }
        performances.append(
            {
                **r,
                "athlete_id": pid,
                "federation": "CMAS",
                "event_id": eid,
                "card": norm_card(r.get("card")),
            }
        )
    print(f"cmas pdf linked={pdf_linked} unmatched_rows={pdf_miss}")

    # FR gap-fill attempts (secondary source). Prefer AIDA/CMAS when the same
    # dive already exists; FR only supplements missing / higher PBs.
    fr_gap_path = canonical / "fr_gap_attempts.json"
    fr_gap_attempts = (
        json.loads(fr_gap_path.read_text()) if fr_gap_path.exists() else []
    )

    def primary_dive_keys() -> set[str]:
        keys: set[str] = set()
        for perf in performances:
            if (perf.get("source") or "").upper() == "FR":
                continue
            name = perf.get("athlete_name") or name_by_tmp.get(perf.get("athlete_id"), "")
            disc = perf.get("discipline")
            date = (perf.get("date") or "")[:10]
            rp = perf.get("rp")
            if name and disc and date and rp is not None:
                keys.add(
                    f"{name_tokens_sorted(name)}|{disc}|{date}|{round(float(rp), 2)}"
                )
        return keys

    name_by_tmp = {p.id: p.name for p in resolver.persons}
    primary_keys = primary_dive_keys()

    # Best points from primary sources per person×discipline
    primary_best_pts: dict[tuple[str, str], float] = {}
    for perf in performances:
        if (perf.get("source") or "").upper() == "FR":
            continue
        if perf.get("card") == "RED":
            continue
        aid, disc, pts = perf.get("athlete_id"), perf.get("discipline"), perf.get("points")
        if not aid or disc not in DISCIPLINE_FACTOR or pts is None:
            continue
        key = (aid, disc)
        if pts > primary_best_pts.get(key, -1):
            primary_best_pts[key] = float(pts)

    fr_linked = fr_skip_dive = fr_skip_covered = fr_miss = fr_implausible = 0
    for r in fr_gap_attempts:
        if r.get("discipline") not in DISCIPLINE_FACTOR:
            continue
        if (r.get("card") or "").upper() in {"RED", "R"}:
            continue
        if not plausible_pb(r["discipline"], float(r.get("rp") or 0)):
            fr_implausible += 1
            continue
        pid = resolve_pdf_name(r.get("athlete_name") or "", r.get("sex"))
        if not pid:
            fr_miss += 1
            continue
        dive_key = (
            f"{name_tokens_sorted(r.get('athlete_name') or '')}|"
            f"{r.get('discipline')}|{(r.get('date') or '')[:10]}|"
            f"{round(float(r.get('rp') or 0), 2)}"
        )
        if dive_key in primary_keys:
            fr_skip_dive += 1
            continue
        # For synthetic FR PB rows: skip if primary already covers the points
        is_pb = str(r.get("event_id") or "").startswith("fr-pb-") or (
            r.get("remarks") or ""
        ).startswith("gap-fill")
        pts = float(r.get("points") or 0)
        if is_pb and pts <= primary_best_pts.get((pid, r["discipline"]), -1) + 1e-6:
            fr_skip_covered += 1
            continue
        fr_linked += 1
        eid = r.get("event_id") or f"fr-ev-{abs(hash(r.get('event_name') or '')) % 10_000_000}"
        if eid not in events:
            events[eid] = {
                "id": eid,
                "name": r.get("event_name") or "FR gap-fill",
                "federation": r.get("federation") or "CMAS",
                "date": r.get("date"),
                "country": r.get("country"),
                "type": "pool"
                if r.get("discipline") in {"STA", "DYN", "DYNB", "DNF"}
                else "depth",
                "status": "past",
            }
        performances.append(
            {
                **r,
                "athlete_id": pid,
                "federation": r.get("federation")
                if r.get("federation") in {"AIDA", "CMAS"}
                else "CMAS",
                "event_id": eid,
                "card": norm_card(r.get("card")),
                "source": "FR",
                "provenance": r.get("provenance")
                or f"https://freediveranking.com/athlete/{r.get('athlete_slug') or ''}",
            }
        )
    print(
        f"fr gap linked={fr_linked} skip_same_dive={fr_skip_dive} "
        f"skip_covered={fr_skip_covered} implausible={fr_implausible} unmatched={fr_miss}"
    )

    enriched = 0
    for label, rows in slices.items():
        if not label.endswith("-alltime") or label.startswith("OVERALL"):
            continue
        disc = label.split("-")[0]
        if disc not in DISCIPLINE_FACTOR:
            continue
        for r in rows:
            guid = r.get("athlete_id")
            pid = aida_to_person.get(guid)
            if not pid:
                continue
            pts, val = r.get("points"), r.get("result_value")
            if pts is None or val is None:
                continue
            eid = f"aida-slice-{disc}-{guid}"
            if eid not in events:
                events[eid] = {
                    "id": eid,
                    "name": f"AIDA ranking PB · {disc}",
                    "federation": "AIDA",
                    "date": (r.get("date") or "2020-01-01")[:10],
                    "country": r.get("country"),
                }
            performances.append(
                {
                    "id": eid,
                    "athlete_id": pid,
                    "source_athlete_id": guid,
                    "athlete_name": r.get("name"),
                    "sex": r.get("sex"),
                    "country": r.get("country"),
                    "event_id": eid,
                    "event_name": f"AIDA ranking PB · {disc}",
                    "federation": "AIDA",
                    "date": (r.get("date") or "2020-01-01")[:10],
                    "discipline": disc,
                    "ap": float(val),
                    "rp": float(val),
                    "card": "WHITE",
                    "points": float(pts),
                    "remarks": "from AIDA ranking slice",
                    "record_flags": r.get("record_flags") or [],
                    "source": "aida_ranking_slice",
                }
            )
            enriched += 1

    persons = resolved["persons"]
    sex_by = {p["id"]: p["sex"] for p in persons}
    name_by = {p["id"]: p["name"] for p in persons}
    country_by = {p["id"]: p["country"] for p in persons}
    for perf in performances:
        perf["sex"] = sex_by.get(perf["athlete_id"], perf.get("sex"))
        perf["athlete_name"] = name_by.get(perf["athlete_id"], perf.get("athlete_name"))
        perf["country"] = country_by.get(perf["athlete_id"], perf.get("country"))

    (canonical / "performances.json").write_text(
        json.dumps(performances, indent=2, ensure_ascii=False)
    )
    (canonical / "events.json").write_text(
        json.dumps(list(events.values()), indent=2, ensure_ascii=False)
    )
    (canonical / "aida_athletes.json").write_text(
        json.dumps(list(aida_athletes.values()), indent=2, ensure_ascii=False)
    )

    ranking_m = compute_overall_ranking(performances, "M")
    ranking_f = compute_overall_ranking(performances, "F")
    (canonical / "ranking_m_alltime.json").write_text(
        json.dumps(ranking_m, indent=2, ensure_ascii=False)
    )
    (canonical / "ranking_f_alltime.json").write_text(
        json.dumps(ranking_f, indent=2, ensure_ascii=False)
    )

    # Slice pseudo-events stay on performances for provenance, but stay out of the calendar.
    events_ui = [
        e for e in events.values() if not str(e.get("id", "")).startswith("aida-slice-")
    ]
    seed = build_seed(
        persons=persons,
        events=events_ui,
        performances=performances,
        as_of=date.today().isoformat(),
    )
    write_seed(seed, out / "seed.json")
    write_seed(seed, ROOT / "data" / "seed.json")

    # FR compare
    fr_m = json.loads((out / "fr/ranking_men_top50.json").read_text())
    fr_f = json.loads((out / "fr/ranking_women_top50.json").read_text())

    def analyze(fr_rows, our_rank):
        matched_top = present = point_ok = point_close = 0
        missing_top = []
        details = []
        for fr in fr_rows:
            hit = next((r for r in our_rank[:50] if match_name(r["name"], fr["name"])), None)
            person = next(
                (
                    p
                    for p in persons
                    if match_name(p["name"], fr["name"])
                    or any(match_name(al, fr["name"]) for al in p.get("aliases") or [])
                ),
                None,
            )
            if person:
                present += 1
            if hit:
                matched_top += 1
                d = hit["points"] - fr["points"]
                if abs(d) <= 15:
                    point_ok += 1
                if abs(d) <= 40:
                    point_close += 1
                details.append(
                    {
                        "fr": fr["name"],
                        "fr_pts": fr["points"],
                        "fr_rank": fr["rank"],
                        "our": hit["name"],
                        "our_pts": hit["points"],
                        "our_rank": hit["rank"],
                        "delta": round(d, 2),
                    }
                )
            else:
                full = next((r for r in our_rank if match_name(r["name"], fr["name"])), None)
                missing_top.append(
                    {
                        "fr": fr["name"],
                        "fr_pts": fr["points"],
                        "fr_rank": fr["rank"],
                        "our_rank": full["rank"] if full else None,
                        "our_pts": full["points"] if full else None,
                    }
                )
        return {
            "matched_top50": matched_top,
            "present": present,
            "point_within_15": point_ok,
            "point_within_40": point_close,
            "missing_top50": missing_top,
            "matched_details": details,
        }

    report = {
        "men": analyze(fr_m, ranking_m),
        "women": analyze(fr_f, ranking_f),
        "methodology": {
            "portal": (
                "sum of best points over 8 disciplines from AIDA+CMAS "
                "(+ AIDA ranking-slice PBs + FR gap-fill when primary history is thin)"
            ),
            "factors": DISCIPLINE_FACTOR,
            "cards": "RED excluded; YELLOW uses source points after penalties",
            "active_window": "UI Active = rolling 24 months from asOf; FR compare = all-time",
            "ties": "Olympic place for equal points; tie-break %WR → disc count → earlier PB date",
            "fr_gap_fill": (
                "FR rows tagged source=FR + provenance URL; "
                "same-dive conflicts prefer AIDA/CMAS; FR excluded from AIDA/CMAS-only boards"
            ),
        },
        "seed_stats": seed["stats"],
        "slice_enrichment_rows": enriched,
        "fr_gap_linked": fr_linked,
    }
    (out / "fr/portal_compare.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False)
    )
    (canonical / "fr_portal_compare.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False)
    )

    print(
        json.dumps(
            {
                "persons": len(persons),
                "performances": len(performances),
                "events": len(events),
                "slice_enrichment_rows": enriched,
                "men_top50": report["men"]["matched_top50"],
                "women_top50": report["women"]["matched_top50"],
                "men_pts15": report["men"]["point_within_15"],
                "women_pts15": report["women"]["point_within_15"],
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
