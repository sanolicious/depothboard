#!/usr/bin/env python3
"""Gap-fill missing Portal PBs from freediveranking.com athlete pages.

FR is a secondary source: every row is tagged source=FR + provenance URL.
When the same dive already exists from AIDA/CMAS, the primary row wins.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from ingest.common.http import PoliteClient  # noqa: E402
from ingest.common.normalize import (  # noqa: E402
    DISCIPLINE_FACTOR,
    name_tokens_sorted,
    normalize_name,
)
from ingest.fr.client import (  # noqa: E402
    FRClient,
    athlete_slug,
    plausible_pb,
    pbs_to_gap_attempts,
    rows_to_attempts,
)

# Named gaps + large point deltas from last compare.
PRIORITY_NAMES = [
    "Vivien Richard",
    "Sebastian Lira",
    "Abdelatif Alouach",
    "Emmanouil Giankos",
    "Mirela Kardašević",
    "Agata Załęcka",
    "Linda Paganelli",
    "Jennifer Wendland",
    "Claire Beatrix Paris",
    "Alexey Molchanov",
    "Samo Jeranko",
    "Guillaume Bourdila",
    "Francisco Quesada",
    "Goran Colak",
]


def _primary_best_by_name(
    performances: list[dict], persons: list[dict]
) -> dict[str, dict[str, float]]:
    """tok -> {disc: best points} from non-FR sources only."""
    name_by = {p["id"]: p["name"] for p in persons}
    aliases: dict[str, str] = {}
    for p in persons:
        aliases[name_tokens_sorted(p["name"])] = p["id"]
        for al in p.get("aliases") or []:
            aliases[name_tokens_sorted(al)] = p["id"]

    best: dict[str, dict[str, float]] = {}
    for perf in performances:
        if (perf.get("source") or "").upper() == "FR":
            continue
        fed = (perf.get("federation") or "").upper()
        if fed not in {"AIDA", "CMAS"} and perf.get("source") not in {
            "aida_ranking_slice",
            None,
            "",
        }:
            continue
        disc = perf.get("discipline")
        pts = perf.get("points")
        if disc not in DISCIPLINE_FACTOR or pts is None:
            continue
        if perf.get("card") == "RED":
            continue
        aid = perf.get("athlete_id")
        name = name_by.get(aid) or perf.get("athlete_name") or ""
        tok = name_tokens_sorted(name)
        if not tok:
            continue
        cur = best.setdefault(tok, {})
        if pts > cur.get(disc, -1):
            cur[disc] = float(pts)
    return best


def _same_dive_key(name: str, disc: str, date: str, rp: float) -> str:
    return f"{name_tokens_sorted(name)}|{disc}|{date}|{round(float(rp), 2)}"


def main() -> int:
    out = ROOT / "data" / "ingest"
    canonical = out / "canonical"
    fr_dir = out / "fr"
    fr_dir.mkdir(parents=True, exist_ok=True)

    http = PoliteClient(out / "raw", min_interval=1.25)
    fr = FRClient(http)

    # Refresh FR top-50 (verification + PB hints)
    men = fr.ranking("M", limit=50)
    women = fr.ranking("F", limit=50)
    (fr_dir / "ranking_men_top50.json").write_text(
        json.dumps(men, indent=2, ensure_ascii=False)
    )
    (fr_dir / "ranking_women_top50.json").write_text(
        json.dumps(women, indent=2, ensure_ascii=False)
    )

    # Load primary corpus if present (post-rebuild snapshot optional)
    persons = []
    performances = []
    if (canonical / "persons.json").exists():
        persons = json.loads((canonical / "persons.json").read_text())["persons"]
    if (canonical / "performances.json").exists():
        performances = json.loads((canonical / "performances.json").read_text())

    primary_best = _primary_best_by_name(performances, persons) if performances else {}

    primary_dive_keys: set[str] = set()
    for perf in performances:
        if (perf.get("source") or "").upper() == "FR":
            continue
        name = perf.get("athlete_name") or ""
        disc = perf.get("discipline")
        date = (perf.get("date") or "")[:10]
        rp = perf.get("rp")
        if name and disc and date and rp is not None:
            primary_dive_keys.add(_same_dive_key(name, disc, date, float(rp)))

    targets: list[tuple[str, str, str, dict]] = []  # name, sex, slug, pbs
    seen: set[str] = set()

    def add_target(name: str, sex: str, slug: str | None = None, pbs: dict | None = None):
        key = name_tokens_sorted(name)
        if key in seen:
            return
        seen.add(key)
        targets.append((name, sex, slug or athlete_slug(name), pbs or {}))

    for n in PRIORITY_NAMES:
        sex = "M"
        row = next((r for r in men if name_tokens_sorted(r["name"]) == name_tokens_sorted(n)), None)
        if not row:
            row = next(
                (r for r in women if name_tokens_sorted(r["name"]) == name_tokens_sorted(n)),
                None,
            )
            sex = "F" if row else ("F" if n in {
                "Mirela Kardašević",
                "Agata Załęcka",
                "Linda Paganelli",
                "Jennifer Wendland",
                "Claire Beatrix Paris",
            } else "M")
        else:
            sex = "M"
        add_target(n, sex, (row or {}).get("slug"), (row or {}).get("pbs"))

    # Also every FR top-50 athlete (gap-fill any discipline we're behind on)
    for row in men + women:
        add_target(row["name"], row["sex"], row.get("slug"), row.get("pbs"))

    all_attempts: list[dict] = []
    coverage = {
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "targets": len(targets),
        "fetched": 0,
        "fetch_errors": [],
        "result_rows": 0,
        "kept_rows": 0,
        "skipped_primary_dive": 0,
        "pb_gap_rows": 0,
        "by_athlete": {},
    }

    for name, sex, slug, pbs in targets:
        print(f"FR fetch {name} ({slug}) …", flush=True)
        try:
            html = fr.athlete_html(slug, force=True)
        except Exception as e:  # noqa: BLE001
            coverage["fetch_errors"].append({"name": name, "slug": slug, "error": str(e)})
            continue
        if "Personal Best" not in html and "Competition bests" not in html and len(html) < 5000:
            coverage["fetch_errors"].append(
                {"name": name, "slug": slug, "error": "thin_or_missing_page"}
            )
            continue
        coverage["fetched"] += 1
        rows = fr.parse_athlete_results(html, name=name, slug=slug)
        attempts = rows_to_attempts(rows, sex=sex)
        coverage["result_rows"] += len(attempts)

        kept = []
        for a in attempts:
            if a.get("card") == "RED":
                continue
            if not plausible_pb(a["discipline"], float(a.get("rp") or 0)):
                continue
            key = _same_dive_key(a["athlete_name"], a["discipline"], a["date"], a["rp"])
            if key in primary_dive_keys:
                coverage["skipped_primary_dive"] += 1
                continue
            kept.append(a)

        # PB synthetic fill for disciplines still behind after result rows
        tok = name_tokens_sorted(name)
        existing = dict(primary_best.get(tok) or {})
        for a in kept:
            d, pts = a["discipline"], a["points"]
            if pts > existing.get(d, -1):
                existing[d] = pts
        # Prefer ranking-API PBs; HTML table only when ranking had no pbs dict
        pb_rows: list[dict] = []
        if pbs:
            pb_rows = pbs_to_gap_attempts(
                name=name,
                slug=slug,
                sex=sex,
                pbs=pbs,
                existing_best=existing,
                origin="ranking",
            )
        else:
            pb_from_html = _pbs_from_html(html)
            pb_rows = pbs_to_gap_attempts(
                name=name,
                slug=slug,
                sex=sex,
                pbs=pb_from_html,
                existing_best=existing,
                origin="html",
            )
        coverage["pb_gap_rows"] += len(pb_rows)
        kept.extend(pb_rows)

        coverage["kept_rows"] += len(kept)
        coverage["by_athlete"][name] = {
            "slug": slug,
            "result_rows": len(attempts),
            "kept": len(kept),
            "pb_gaps": len(pb_rows),
        }
        all_attempts.extend(kept)

    # Deduplicate FR rows themselves (same dive twice)
    deduped = {}
    for a in all_attempts:
        k = _same_dive_key(a["athlete_name"], a["discipline"], a["date"], a["rp"])
        # keep higher points / prefer real event over synthetic pb date
        prev = deduped.get(k)
        if not prev or a["points"] > prev["points"]:
            deduped[k] = a
        elif a["points"] == prev["points"] and not str(a["event_id"]).startswith("fr-pb-"):
            deduped[k] = a
    final = list(deduped.values())

    (canonical / "fr_gap_attempts.json").write_text(
        json.dumps(final, indent=2, ensure_ascii=False)
    )
    coverage["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    coverage["final_attempts"] = len(final)
    (canonical / "fr_gap_coverage.json").write_text(
        json.dumps(coverage, indent=2, ensure_ascii=False)
    )
    (fr_dir / "gap_fill_coverage.json").write_text(
        json.dumps(coverage, indent=2, ensure_ascii=False)
    )
    print(json.dumps({k: coverage[k] for k in coverage if k != "by_athlete"}, indent=2))
    return 0


def _pbs_from_html(html: str) -> dict[str, str]:
    import re

    out: dict[str, str] = {}
    # Table cells: Personal Best row
    m = re.search(
        r"Personal Best</td>(.*?)</tr>",
        html,
        re.S | re.I,
    )
    if m:
        cells = re.findall(r"<td[^>]*>\s*(.*?)\s*</td>", m.group(1), re.S | re.I)
        discs = ["STA", "DYN", "DYNB", "DNF", "FIM", "CWT", "CWTB", "CNF"]
        plain = [re.sub(r"<[^>]+>", "", c).strip() for c in cells]
        for disc, val in zip(discs, plain):
            if val and val not in {"-", "—"}:
                out[disc] = val
    # Per-discipline cards
    for disc in ["STA", "DYN", "DYNB", "DNF", "FIM", "CWT", "CWTB", "CNF"]:
        if disc in out:
            continue
        dm = re.search(
            rf">\s*{disc}\s*<.*?>(\d{{1,2}}:\d{{2}}(?:\.\d+)?|\d+(?:\.\d+)?\s*m)<",
            html,
            re.S | re.I,
        )
        if dm:
            out[disc] = dm.group(1)
    return out


if __name__ == "__main__":
    raise SystemExit(main())
