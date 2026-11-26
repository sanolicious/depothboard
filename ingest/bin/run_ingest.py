#!/usr/bin/env python3
"""Run AIDA + CMAS ingest, resolve entities, export seed, compare with FR."""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ingest.aida.client import AIDAClient  # noqa: E402
from ingest.cmas.client import (  # noqa: E402
    CMASClient,
    normalize_cmas_athletes,
    normalize_cmas_attempts,
)
from ingest.common.export_seed import (  # noqa: E402
    build_seed,
    compute_overall_ranking,
    write_seed,
)
from ingest.common.http import PoliteClient  # noqa: E402
from ingest.common.normalize import AIDA_DISC_IDS, country_to_iso3  # noqa: E402
from ingest.common.resolve import EntityResolver  # noqa: E402
from ingest.fr.compare import compare  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--out",
        type=Path,
        default=ROOT / "data" / "ingest",
        help="Output directory for raw + canonical data",
    )
    p.add_argument("--aida-rank-pages", type=int, default=25, help="Pages per ranking slice")
    p.add_argument("--aida-history-top", type=int, default=120, help="Athletes with full history")
    p.add_argument("--skip-fr", action="store_true")
    p.add_argument("--skip-aida", action="store_true")
    p.add_argument("--skip-cmas", action="store_true")
    p.add_argument("--min-interval", type=float, default=0.9)
    return p.parse_args()


def main() -> int:
    args = parse_args()
    out: Path = args.out
    raw = out / "raw"
    canonical = out / "canonical"
    scrubbed = out / "cmas_scrubbed"
    fr_dir = out / "fr"
    for d in (raw, canonical, scrubbed, fr_dir):
        d.mkdir(parents=True, exist_ok=True)

    http = PoliteClient(raw, min_interval=args.min_interval)
    coverage: dict = {
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "aida": {},
        "cmas": {},
        "fr": {},
        "totals": {},
    }

    resolver = EntityResolver()
    aida_athletes: dict[str, dict] = {}
    aida_results: list[dict] = []
    aida_ranking_slices: dict[str, list] = {}
    events: dict[str, dict] = {}
    performances: list[dict] = []

    # ---------- AIDA ----------
    if not args.skip_aida:
        aida = AIDAClient(http)
        # Ranking slices: overall + each discipline, M/F, all-time + recent years
        slices = []
        for gender, sex in [("0", "M"), ("1", "F")]:
            slices.append(("all", gender, "", f"OVERALL-{sex}-alltime"))
            slices.append(("all", gender, "2025", f"OVERALL-{sex}-2025"))
            slices.append(("all", gender, "2026", f"OVERALL-{sex}-2026"))
            for disc_id, code in AIDA_DISC_IDS.items():
                if disc_id in {"pool", "depth", "all"}:
                    continue
                slices.append((disc_id, gender, "", f"{code}-{sex}-alltime"))

        print(f"AIDA ranking slices: {len(slices)} × up to {args.aida_rank_pages} pages")
        for disc_id, gender, year, label in slices:
            print(f"  ranking {label} ...", flush=True)
            try:
                rows = aida.ranking_pages(
                    disc_id, gender, year=year, max_pages=args.aida_rank_pages
                )
            except Exception as e:  # noqa: BLE001
                print(f"    FAIL {e}")
                coverage["aida"].setdefault("errors", []).append({"slice": label, "error": str(e)})
                continue
            aida_ranking_slices[label] = [
                {
                    "rank": r.rank,
                    "athlete_id": r.athlete_id,
                    "name": r.name,
                    "country": r.country,
                    "sex": r.sex,
                    "result_text": r.result_text,
                    "result_value": r.result_value,
                    "points": r.points,
                    "date": r.date,
                    "event_name": r.event_name,
                    "event_id": r.event_id,
                    "discipline": r.discipline,
                    "record_flags": r.record_flags,
                }
                for r in rows
            ]
            for r in rows:
                aida_athletes[r.athlete_id] = {
                    "id": r.athlete_id,
                    "name": r.name,
                    "sex": r.sex,
                    "country": r.country,
                    "country_iso3": country_to_iso3(r.country),
                }
                if r.event_id:
                    events[f"aida-{r.event_id}"] = {
                        "id": f"aida-{r.event_id}",
                        "name": r.event_name,
                        "federation": "AIDA",
                        "date": r.date,
                        "country": r.country,
                    }
            print(f"    -> {len(rows)} rows, athletes so far {len(aida_athletes)}")

        (canonical / "aida_ranking_slices.json").write_text(
            json.dumps(aida_ranking_slices, indent=2, ensure_ascii=False)
        )

        # Full history for top-N from overall all-time M/F
        top_ids: list[str] = []
        for label in ["OVERALL-M-alltime", "OVERALL-F-alltime"]:
            for row in aida_ranking_slices.get(label, []):
                if row["athlete_id"] not in top_ids:
                    top_ids.append(row["athlete_id"])
        top_ids = top_ids[: args.aida_history_top]
        print(f"AIDA full history for {len(top_ids)} athletes")
        history_ok = 0
        for i, guid in enumerate(top_ids, 1):
            try:
                res = aida.athlete_all_results(guid)
            except Exception as e:  # noqa: BLE001
                coverage["aida"].setdefault("errors", []).append(
                    {"athlete": guid, "error": str(e)}
                )
                continue
            ath = aida_athletes.get(guid, {"id": guid, "name": guid, "sex": "M", "country": "UNK"})
            for r in res:
                r["athlete_name"] = ath["name"]
                r["sex"] = ath.get("sex")
                r["athlete_id"] = guid
                r["federation"] = "AIDA"
                # provisional event id from name hash-ish
                r["event_id"] = r.get("event_id") or f"aida-ev-{abs(hash(r['event_name'])) % 10_000_000}"
                if r["event_name"] and r["event_id"] not in events:
                    events[r["event_id"]] = {
                        "id": r["event_id"],
                        "name": r["event_name"],
                        "federation": "AIDA",
                        "date": r.get("date"),
                        "country": r.get("country"),
                    }
            aida_results.extend(res)
            history_ok += 1
            if i % 10 == 0:
                print(f"  history {i}/{len(top_ids)} ({len(aida_results)} results)")

        coverage["aida"] = {
            "ranking_slices": {k: len(v) for k, v in aida_ranking_slices.items()},
            "unique_athletes_from_rankings": len(aida_athletes),
            "history_athletes": history_ok,
            "history_results": len(aida_results),
            "events_discovered": len([e for e in events if e.startswith("aida")]),
            "note": (
                f"Partial crawl: {args.aida_rank_pages} pages/slice "
                f"(~10 athletes/page). Full AIDA overall≈1200 pages/gender."
            ),
        }
        (canonical / "aida_athletes.json").write_text(
            json.dumps(list(aida_athletes.values()), indent=2, ensure_ascii=False)
        )
        (canonical / "aida_results.json").write_text(
            json.dumps(aida_results, indent=2, ensure_ascii=False)
        )

    # ---------- CMAS ----------
    cmas_attempts: list[dict] = []
    cmas_people: list[dict] = []
    if not args.skip_cmas:
        cmas = CMASClient(http, scrubbed)
        print("CMAS competitions…")
        comps = cmas.freediving_competitions()
        print(f"  freediving comps: {len(comps)}")
        all_parts: list[dict] = []
        for comp in comps:
            cid = comp["CmpID"]
            title = comp.get("CmpTitShortDescr") or comp.get("CmpTitLongDescr")
            print(f"  ingest CMAS {cid}: {title}", flush=True)
            try:
                bundle = cmas.ingest_competition(comp)
            except Exception as e:  # noqa: BLE001
                coverage.setdefault("cmas", {}).setdefault("errors", []).append(
                    {"cmp": cid, "error": str(e)}
                )
                continue
            events[f"cmas-{cid}"] = {
                "id": f"cmas-{cid}",
                "name": title,
                "federation": "CMAS",
                "startDate": (comp.get("CmpStartDate") or "")[:10],
                "endDate": (comp.get("CmpEndDate") or "")[:10],
                "country": comp.get("CmpLocLongDescr"),
                "venue": comp.get("CmpVenue") or "",
                "type": "pool"
                if any(
                    (d.get("DCDisCODE") == "FRP")
                    for d in (comp.get("Disciplines") or [])
                )
                else "depth",
                "status": "past",
            }
            parts = bundle["participants"]
            all_parts.extend(parts)
            attempts = normalize_cmas_attempts(bundle["results"], comp)
            cmas_attempts.extend(attempts)
            print(f"    participants={len(parts)} results={len(attempts)}")

        cmas_people = normalize_cmas_athletes(all_parts)
        coverage["cmas"] = {
            "competitions_total_api": len(cmas.competitions()),
            "freediving_competitions": len(comps),
            "athletes": len(cmas_people),
            "attempts": len(cmas_attempts),
            "note": "Full CMAS Microplus freediving coverage from API; older PDF-only events not ingested.",
        }
        (canonical / "cmas_athletes.json").write_text(
            json.dumps(cmas_people, indent=2, ensure_ascii=False)
        )
        (canonical / "cmas_attempts.json").write_text(
            json.dumps(cmas_attempts, indent=2, ensure_ascii=False)
        )

    # ---------- Resolve ----------
    print("Entity resolution…")
    for a in aida_athletes.values():
        resolver.add_aida(a)
    for a in cmas_people:
        resolver.add_cmas(a)
    resolved = resolver.to_json()
    (canonical / "persons.json").write_text(
        json.dumps(resolved, indent=2, ensure_ascii=False)
    )

    # Map source athlete ids -> person ids
    aida_to_person = resolver.by_aida
    cmas_to_person = resolver.by_cmas_hmac

    # Build performances linked to persons
    for r in aida_results:
        pid = aida_to_person.get(r["athlete_id"])
        if not pid:
            continue
        performances.append(
            {
                **r,
                "athlete_id": pid,
                "source_athlete_id": r["athlete_id"],
            }
        )
    for r in cmas_attempts:
        hmac_id = r.get("athlete_hmac")
        pid = cmas_to_person.get(hmac_id) if hmac_id else None
        if not pid:
            # create soft link by adding unresolved as-is skip
            continue
        performances.append(
            {
                **r,
                "athlete_id": pid,
                "athlete_name": r.get("athlete_name"),
                "record_flags": [r["record"]] if r.get("record") else [],
            }
        )

    persons = resolved["persons"]
    # attach sex onto performances from person
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

    ranking_m = compute_overall_ranking(performances, "M")
    ranking_f = compute_overall_ranking(performances, "F")
    (canonical / "ranking_m_alltime.json").write_text(
        json.dumps(ranking_m, indent=2, ensure_ascii=False)
    )
    (canonical / "ranking_f_alltime.json").write_text(
        json.dumps(ranking_f, indent=2, ensure_ascii=False)
    )

    # Also export ranking from AIDA overall slices (authoritative AIDA points when available)
    def slice_as_ranking(label: str) -> list[dict]:
        rows = []
        for r in aida_ranking_slices.get(label, []):
            rows.append(
                {
                    "rank": r["rank"],
                    "athlete_id": r["athlete_id"],
                    "name": r["name"],
                    "country": r["country"],
                    "points": r["points"],
                    "result_text": r.get("result_text"),
                }
            )
        return rows

    (canonical / "aida_overall_m.json").write_text(
        json.dumps(slice_as_ranking("OVERALL-M-alltime"), indent=2, ensure_ascii=False)
    )
    (canonical / "aida_overall_f.json").write_text(
        json.dumps(slice_as_ranking("OVERALL-F-alltime"), indent=2, ensure_ascii=False)
    )

    seed = build_seed(
        persons=persons,
        events=list(events.values()),
        performances=performances,
        as_of=date.today().isoformat(),
    )
    write_seed(seed, out / "seed.json")
    write_seed(seed, ROOT / "data" / "seed.json")

    # ---------- FR compare ----------
    fr_report = {}
    if not args.skip_fr:
        print("FR comparison (rate-limited, verification only)…")
        # Prefer AIDA overall ranking for FR comparison (same methodology family)
        our_m = [
            {"name": r["name"], "points": r["points"], "rank": r["rank"]}
            for r in slice_as_ranking("OVERALL-M-alltime")[:80]
        ]
        our_f = [
            {"name": r["name"], "points": r["points"], "rank": r["rank"]}
            for r in slice_as_ranking("OVERALL-F-alltime")[:80]
        ]
        # Fall back to computed ranking
        if len(our_m) < 10:
            our_m = ranking_m[:80]
        if len(our_f) < 10:
            our_f = ranking_f[:80]
        fr_http = PoliteClient(raw / "fr", min_interval=2.0)
        fr_report = compare(
            our_m,
            our_f,
            persons,
            fr_dir,
            fr_http,
            sample_size=50,
        )
        coverage["fr"] = {
            "access": fr_report.get("fr_access"),
            "men": {
                k: fr_report.get("ranking_men", {}).get(k)
                for k in ("matched", "our_top_n", "fr_top_n")
            },
            "women": {
                k: fr_report.get("ranking_women", {}).get(k)
                for k in ("matched", "our_top_n", "fr_top_n")
            },
            "profile_sample": len(fr_report.get("profile_sample") or []),
            "mojibake": len(fr_report.get("mojibake") or []),
            "point_mismatches_m": len(
                (fr_report.get("ranking_men") or {}).get("point_mismatches") or []
            ),
            "point_mismatches_f": len(
                (fr_report.get("ranking_women") or {}).get("point_mismatches") or []
            ),
        }

    coverage["totals"] = {
        "persons": len(persons),
        "performances": len(performances),
        "events": len(events),
        "merge_conflicts": len(resolved.get("conflicts") or []),
        "http": http.stats,
    }
    coverage["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    (canonical / "coverage.json").write_text(json.dumps(coverage, indent=2, ensure_ascii=False))
    print(json.dumps(coverage["totals"], indent=2))
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
