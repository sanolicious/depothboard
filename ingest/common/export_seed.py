"""Export canonical data to JsonRepository seed.json shape."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any

from ingest.common.normalize import DISCIPLINE_FACTOR, country_to_iso3, slugify


DISCIPLINES = [
    {"code": "CWT", "name": "Constant Weight with fins", "group": "depth", "unit": "m", "factor": 1},
    {"code": "CWTB", "name": "Constant Weight bi-fins", "group": "depth", "unit": "m", "factor": 1},
    {"code": "CNF", "name": "Constant Weight no fins", "group": "depth", "unit": "m", "factor": 1},
    {"code": "FIM", "name": "Free Immersion", "group": "depth", "unit": "m", "factor": 1},
    {"code": "STA", "name": "Static Apnea", "group": "pool", "unit": "s", "factor": 0.2},
    {"code": "DYN", "name": "Dynamic with fins", "group": "pool", "unit": "m", "factor": 0.5},
    {"code": "DYNB", "name": "Dynamic bi-fins", "group": "pool", "unit": "m", "factor": 0.5},
    {"code": "DNF", "name": "Dynamic no fins", "group": "pool", "unit": "m", "factor": 0.5},
]

# Approximate WR placeholders — overwritten when we have record tables.
DEFAULT_WR = {
    "M": {"CWT": 137, "CWTB": 122, "CNF": 102, "FIM": 133, "STA": 695, "DYN": 325, "DYNB": 250, "DNF": 244},
    "F": {"CWT": 122, "CWTB": 117, "CNF": 74, "FIM": 103, "STA": 549, "DYN": 273, "DYNB": 236, "DNF": 213},
}

COUNTRY_NAMES = {
    "FRA": "France",
    "ITA": "Italy",
    "POL": "Poland",
    "CRO": "Croatia",
    "UKR": "Ukraine",
    "CHN": "China",
    "JPN": "Japan",
    "RUS": "Russia",
    "USA": "United States",
    "GBR": "United Kingdom",
    "GER": "Germany",
    "ESP": "Spain",
    "BRA": "Brazil",
    "CAN": "Canada",
    "AUS": "Australia",
    "SWE": "Sweden",
    "NOR": "Norway",
    "FIN": "Finland",
    "KOR": "South Korea",
    "AIN": "Neutral Athlete",
    "UNK": "Unknown",
}


def build_seed(
    *,
    persons: list[dict[str, Any]],
    events: list[dict[str, Any]],
    performances: list[dict[str, Any]],
    as_of: str | None = None,
) -> dict[str, Any]:
    as_of = as_of or date.today().isoformat()
    athletes = []
    for p in persons:
        iso = country_to_iso3(p.get("country"))
        sex = p.get("sex") or "M"
        athletes.append(
            {
                "id": p["id"],
                "slug": p.get("slug") or slugify(p["name"]),
                "name": p["name"],
                "country": iso,
                "countryName": COUNTRY_NAMES.get(iso, iso),
                "sex": sex,
                "status": "active",
                "minor": False,
                "neutral": iso == "AIN",
                "rankDelta": 0,
                "form": [],
                "bio": f"{p['name']} — results imported from AIDA/CMAS.",
                "claimed": False,
                "club": None,
            }
        )

    # dedupe events by id
    ev_out = []
    seen_ev = set()
    for e in events:
        eid = str(e["id"])
        if eid in seen_ev:
            continue
        seen_ev.add(eid)
        fed = e.get("federation") or "AIDA"
        name = e.get("name") or eid
        slug = e.get("slug") or slugify(name)[:80]
        start = (e.get("startDate") or e.get("date") or as_of)[:10]
        end = (e.get("endDate") or start)[:10]
        status = e.get("status") or ("past" if start < as_of else "upcoming")
        ev_out.append(
            {
                "id": eid,
                "slug": slug,
                "name": name,
                "shortName": e.get("shortName") or name[:40],
                "federation": fed if fed in {"AIDA", "CMAS"} else "AIDA",
                "type": e.get("type") or "depth",
                "status": status,
                "startDate": start,
                "endDate": end,
                "venue": e.get("venue") or "",
                "country": country_to_iso3(e.get("country")),
                "lat": e.get("lat") or 0,
                "lng": e.get("lng") or 0,
                "disciplines": e.get("disciplines")
                or ["CWT", "CWTB", "CNF", "FIM", "STA", "DYN", "DYNB", "DNF"],
                "rightsModel": "diveye_owned" if fed == "AIDA" else "cmas_link",
            }
        )

    # map athlete id by various keys
    by_id = {a["id"]: a for a in athletes}
    slug_by_id = {a["id"]: a["slug"] for a in athletes}

    perf_out = []
    for i, perf in enumerate(performances):
        aid = perf.get("athlete_id")
        if aid not in by_id:
            continue
        disc = perf.get("discipline")
        if disc not in DISCIPLINE_FACTOR:
            continue
        card = perf.get("card") or "WHITE"
        card_short = {"WHITE": "W", "YELLOW": "Y", "RED": "R"}.get(card, "W")
        pts = perf.get("points")
        if pts is None:
            continue
        eid = str(perf.get("event_id") or "unknown")
        ename = perf.get("event_name") or eid
        perf_out.append(
            {
                "id": perf.get("id") or f"perf-{i}",
                "athleteId": aid,
                "athleteSlug": slug_by_id[aid],
                "eventId": eid,
                "eventName": ename,
                "discipline": disc,
                "federation": perf.get("federation") or "AIDA",
                "date": (perf.get("date") or as_of)[:10],
                "ap": float(perf.get("ap") or perf.get("rp") or 0),
                "rp": float(perf.get("rp") or 0),
                "card": card_short,
                "points": float(pts),
                "wr": "WR" in (perf.get("record_flags") or [])
                or perf.get("record") in {"WR", "WRSENIORS"},
                "nr": "NR" in (perf.get("record_flags") or []),
                "status": "official",
                "diveId": perf.get("id") or f"dive-{i}",
                "day": 1,
                "ot": "00:00",
            }
        )

    return {
        "asOf": as_of,
        "disciplines": DISCIPLINES,
        "wr": DEFAULT_WR,
        "athletes": athletes,
        "events": ev_out,
        "performances": perf_out,
        "showcaseDives": [],
        "products": [],
        "cartSeed": [],
        "liveResults": [],
        "stats": {
            "athletes": len(athletes),
            "events": len(ev_out),
            "results": len(perf_out),
            "asOf": as_of,
        },
        "site": {
            "name": "Depthboard",
            "url": "https://depthboard.example",
            "tagline": "Freediving results from AIDA & CMAS",
            "endorsement": "Data sourced from public AIDA and CMAS results.",
        },
    }


def write_seed(seed: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n")


def compute_overall_ranking(
    performances: list[dict[str, Any]], sex: str
) -> list[dict[str, Any]]:
    """All-time PB sum (Portal Points) per athlete."""
    best: dict[str, dict[str, float]] = defaultdict(dict)
    meta: dict[str, dict[str, Any]] = {}
    for p in performances:
        if p.get("sex") and p["sex"] != sex:
            continue
        if p.get("card") == "RED":
            continue
        aid = p["athlete_id"]
        disc = p.get("discipline")
        pts = p.get("points")
        if not disc or pts is None or disc not in DISCIPLINE_FACTOR:
            continue
        cur = best[aid].get(disc)
        if cur is None or pts > cur:
            best[aid][disc] = float(pts)
        meta[aid] = {
            "name": p.get("athlete_name"),
            "country": p.get("country"),
            "sex": sex,
        }
    rows = []
    for aid, discs in best.items():
        total = sum(discs.values())
        rows.append(
            {
                "athlete_id": aid,
                "name": meta.get(aid, {}).get("name"),
                "country": meta.get(aid, {}).get("country"),
                "points": round(total, 2),
                "pbs": discs,
            }
        )
    rows.sort(key=lambda r: r["points"], reverse=True)
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    return rows
