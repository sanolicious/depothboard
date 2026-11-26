#!/usr/bin/env python3
"""Incremental AIDA + CMAS live sync → canonical → seed → coverage log.

Designed for cron / GitHub Actions:
  PYTHONPATH=. python3 ingest/bin/live_sync.py --mode incremental

Idempotent: reuses PoliteClient raw cache, merges by stable ids, scrubs CMAS PII.
Backoff/rate-limit via PoliteClient. FR gap-fill is optional secondary step.

Provisional marking (consumed by export_seed / portal UI):
  - Events still in progress should carry status \"live\" (and optional liveUrl/day/ofDays).
  - Attempts under a live event default to result status \"provisional\" unless the
    federation payload (or steward) stamps result_status=unofficial|official.
  - Cycle: provisional (live feed) → unofficial (day closed / jury pending) →
    official (confirmed). Only official rows enter Portal Points rankings.
  - export_seed builds seed.liveResults from provisional/unofficial rows of the
    first live event for the home LiveBar board.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from ingest.aida.client import AIDAClient  # noqa: E402
from ingest.cmas.client import (  # noqa: E402
    CMASClient,
    normalize_cmas_athletes,
    normalize_cmas_attempts,
)
from ingest.common.http import PoliteClient  # noqa: E402
from ingest.common.normalize import AIDA_DISC_IDS, country_to_iso3  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=ROOT / "data" / "ingest")
    p.add_argument(
        "--mode",
        choices=["incremental", "full"],
        default="incremental",
        help="incremental = recent windows + merge; full = broader crawl",
    )
    p.add_argument("--min-interval", type=float, default=1.0)
    p.add_argument("--aida-rank-pages", type=int, default=5)
    p.add_argument("--aida-history-top", type=int, default=40)
    p.add_argument("--cmas-limit", type=int, default=25)
    p.add_argument("--skip-aida", action="store_true")
    p.add_argument("--skip-cmas", action="store_true")
    p.add_argument("--skip-fr-gaps", action="store_true")
    p.add_argument("--skip-rebuild", action="store_true")
    return p.parse_args()


def _run(cmd: list[str]) -> int:
    print("+", " ".join(cmd), flush=True)
    return subprocess.call(cmd, cwd=str(ROOT))


def sync_aida(http: PoliteClient, out: Path, args: argparse.Namespace, coverage: dict) -> None:
    canonical = out / "canonical"
    aida = AIDAClient(http)
    year = date.today().year
    years = [str(year), str(year - 1)]
    if args.mode == "full":
        years.append(str(year - 2))

    slices_path = canonical / "aida_ranking_slices.json"
    slices: dict = json.loads(slices_path.read_text()) if slices_path.exists() else {}
    athletes_path = canonical / "aida_athletes.json"
    athletes = {
        a["id"]: a
        for a in (json.loads(athletes_path.read_text()) if athletes_path.exists() else [])
    }
    results_path = canonical / "aida_results.json"
    results = json.loads(results_path.read_text()) if results_path.exists() else []

    jobs: list[tuple[str, str, str, str]] = []
    for gender, sex in [("0", "M"), ("1", "F")]:
        jobs.append(("all", gender, "", f"OVERALL-{sex}-alltime"))
        for y in years:
            jobs.append(("all", gender, y, f"OVERALL-{sex}-{y}"))
        for disc_id, code in AIDA_DISC_IDS.items():
            if disc_id in {"pool", "depth", "all"}:
                continue
            jobs.append((disc_id, gender, "", f"{code}-{sex}-alltime"))

    fetched_slices = 0
    for disc_id, gender, year_s, label in jobs:
        try:
            rows = aida.ranking_pages(
                disc_id, gender, year=year_s, max_pages=args.aida_rank_pages
            )
        except Exception as e:  # noqa: BLE001
            coverage["aida"].setdefault("errors", []).append(
                {"slice": label, "error": str(e)}
            )
            continue
        slices[label] = [
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
        fetched_slices += 1
        for r in rows:
            athletes[r.athlete_id] = {
                "id": r.athlete_id,
                "name": r.name,
                "sex": r.sex,
                "country": r.country,
                "country_iso3": country_to_iso3(r.country),
            }

    overall_m = slices.get("OVERALL-M-alltime") or []
    overall_f = slices.get("OVERALL-F-alltime") or []
    targets: list[str] = []
    for row in (overall_m + overall_f)[: args.aida_history_top]:
        guid = row.get("athlete_id")
        if guid and guid not in targets:
            targets.append(guid)
    counts = Counter(r["athlete_id"] for r in results if r.get("athlete_id"))
    for guid, n in counts.items():
        if n < 8 and guid not in targets:
            targets.append(guid)
        if len(targets) >= args.aida_history_top * 2:
            break

    hist_new = 0
    for guid in targets:
        try:
            res = aida.athlete_all_results(guid)
        except Exception as e:  # noqa: BLE001
            coverage["aida"].setdefault("errors", []).append(
                {"history": guid, "error": str(e)}
            )
            continue
        ath = athletes.get(guid, {"id": guid, "name": guid, "sex": "M"})
        results = [r for r in results if r.get("athlete_id") != guid]
        for r in res:
            r["federation"] = "AIDA"
            r["athlete_id"] = guid
            r["athlete_name"] = ath.get("name")
            r["sex"] = ath.get("sex")
            r["event_id"] = (
                r.get("event_id")
                or f"aida-ev-{abs(hash(r.get('event_name') or '')) % 10_000_000}"
            )
        results.extend(res)
        hist_new += 1

    athletes_path.write_text(
        json.dumps(list(athletes.values()), indent=2, ensure_ascii=False)
    )
    results_path.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    slices_path.write_text(json.dumps(slices, indent=2, ensure_ascii=False))
    coverage["aida"].update(
        {
            "slices_refreshed": fetched_slices,
            "histories_refreshed": hist_new,
            "athletes": len(athletes),
            "results": len(results),
        }
    )


def sync_cmas(http: PoliteClient, out: Path, args: argparse.Namespace, coverage: dict) -> None:
    canonical = out / "canonical"
    scrubbed = out / "cmas_scrubbed"
    scrubbed.mkdir(parents=True, exist_ok=True)
    cmas = CMASClient(http, scrubbed)

    try:
        comps = cmas.freediving_competitions()
    except Exception as e:  # noqa: BLE001
        coverage["cmas"]["errors"] = [{"list": str(e)}]
        return

    today = date.today().isoformat()

    def start_of(c: dict) -> str:
        return str(c.get("CmpStartDate") or "")[:10] or "1970-01-01"

    def end_of(c: dict) -> str:
        return str(c.get("CmpEndDate") or c.get("CmpStartDate") or "")[:10]

    comps_sorted = sorted(comps, key=start_of, reverse=True)
    pick: list[dict] = []
    for c in comps_sorted[: args.cmas_limit]:
        pick.append(c)
    for c in comps_sorted:
        s, e = start_of(c), end_of(c)
        if s <= today <= e and c not in pick:
            pick.append(c)

    athletes_path = canonical / "cmas_athletes.json"
    attempts_path = canonical / "cmas_attempts.json"
    existing_ath = (
        json.loads(athletes_path.read_text()) if athletes_path.exists() else []
    )
    existing_att = (
        json.loads(attempts_path.read_text()) if attempts_path.exists() else []
    )

    by_hmac = {
        a.get("accred_hmac") or a.get("athlete_hmac"): a
        for a in existing_ath
        if a.get("accred_hmac") or a.get("athlete_hmac")
    }
    by_att_id = {a.get("id"): a for a in existing_att if a.get("id")}

    synced = 0
    for comp in pick:
        cid = comp.get("CmpID")
        title = comp.get("CmpTitShortDescr") or comp.get("CmpTitLongDescr")
        print(f"  CMAS {cid}: {title}", flush=True)
        try:
            bundle = cmas.ingest_competition(comp)
        except Exception as e:  # noqa: BLE001
            coverage["cmas"].setdefault("errors", []).append(
                {"cmp": cid, "error": str(e)}
            )
            continue
        ath = normalize_cmas_athletes(bundle.get("participants") or [])
        att = normalize_cmas_attempts(bundle.get("results") or [], comp)
        for a in ath:
            k = a.get("accred_hmac")
            if k:
                by_hmac[k] = a
        for a in att:
            if a.get("id"):
                by_att_id[a["id"]] = a
        synced += 1

    merged_ath = list(by_hmac.values())
    merged_att = list(by_att_id.values())
    athletes_path.write_text(json.dumps(merged_ath, indent=2, ensure_ascii=False))
    attempts_path.write_text(json.dumps(merged_att, indent=2, ensure_ascii=False))
    coverage["cmas"].update(
        {
            "competitions_listed": len(comps),
            "competitions_synced": synced,
            "athletes": len(merged_ath),
            "attempts": len(merged_att),
        }
    )


def main() -> int:
    args = parse_args()
    out: Path = args.out
    raw = out / "raw"
    canonical = out / "canonical"
    for d in (raw, canonical, out / "cmas_scrubbed", out / "fr"):
        d.mkdir(parents=True, exist_ok=True)

    coverage: dict = {
        "started_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": args.mode,
        "aida": {},
        "cmas": {},
        "fr": {},
        "rebuild": {},
    }

    http = PoliteClient(raw, min_interval=args.min_interval)

    if not args.skip_aida:
        print("== AIDA sync ==", flush=True)
        try:
            sync_aida(http, out, args, coverage)
        except Exception as e:  # noqa: BLE001
            coverage["aida"]["fatal"] = str(e)
            print("AIDA sync failed:", e, flush=True)

    if not args.skip_cmas:
        print("== CMAS sync ==", flush=True)
        try:
            sync_cmas(http, out, args, coverage)
        except Exception as e:  # noqa: BLE001
            coverage["cmas"]["fatal"] = str(e)
            print("CMAS sync failed:", e, flush=True)

    if not args.skip_fr_gaps:
        print("== FR gap-fill (rate-limited) ==", flush=True)
        rc = _run([sys.executable, "ingest/bin/fr_gap_fill.py"])
        coverage["fr"]["gap_fill_exit"] = rc
        cov_path = canonical / "fr_gap_coverage.json"
        if cov_path.exists():
            summary = json.loads(cov_path.read_text())
            coverage["fr"]["summary"] = {
                k: summary[k]
                for k in summary
                if k != "by_athlete"
            }

    if not args.skip_rebuild:
        print("== rebuild seed ==", flush=True)
        rc = _run([sys.executable, "ingest/bin/rebuild_seed.py"])
        coverage["rebuild"]["exit"] = rc
        compare = out / "fr" / "portal_compare.json"
        if compare.exists():
            rep = json.loads(compare.read_text())
            coverage["rebuild"]["men_top50"] = rep.get("men", {}).get("matched_top50")
            coverage["rebuild"]["women_top50"] = rep.get("women", {}).get(
                "matched_top50"
            )
            coverage["rebuild"]["seed_stats"] = rep.get("seed_stats")

    coverage["finished_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    coverage["http_stats"] = http.stats
    log_path = canonical / "live_sync_coverage.json"
    log_path.write_text(json.dumps(coverage, indent=2, ensure_ascii=False))
    hist = canonical / "live_sync_history.jsonl"
    with hist.open("a", encoding="utf-8") as f:
        f.write(json.dumps(coverage, ensure_ascii=False) + "\n")
    print(json.dumps(coverage, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
