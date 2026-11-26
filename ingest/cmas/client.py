"""CMAS Microplus Timing JSON API ingest (PII scrubbed)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ingest.common.http import PoliteClient
from ingest.common.normalize import (
    map_cmas_discipline,
    parse_cmas_print_name,
    parse_result_value,
    portal_points,
    scrub_cmas_pii,
)


API = "https://cmas-api.microplustimingservices.com/api"


def _is_freediving(comp: dict[str, Any]) -> bool:
    discs = comp.get("Disciplines") or []
    for d in discs:
        code = (d.get("DCDisCODE") or d.get("DisCODE") or "").upper()
        if code in {"FRD", "FRP"}:
            return True
        descr = (d.get("DisLongDescr") or d.get("DisShortDescr") or "").lower()
        if "freediv" in descr or "apnea" in descr:
            return True
    title = (
        (comp.get("CmpTitLongDescr") or "")
        + " "
        + (comp.get("CmpTitShortDescr") or "")
    ).lower()
    return "freediv" in title or "apnea" in title


@dataclass
class CMASClient:
    http: PoliteClient
    scrubbed_dir: Path

    def __post_init__(self) -> None:
        self.scrubbed_dir.mkdir(parents=True, exist_ok=True)

    def competitions(self) -> list[dict[str, Any]]:
        comps = self.http.get_json(f"{API}/competitions")
        # store scrubbed full list
        (self.scrubbed_dir / "competitions.json").write_text(
            json.dumps(comps, indent=2, ensure_ascii=False)
        )
        return comps

    def freediving_competitions(self) -> list[dict[str, Any]]:
        return [c for c in self.competitions() if _is_freediving(c)]

    def participants(self, cmp_id: int) -> list[dict[str, Any]]:
        raw = self.http.get_json(f"{API}/competitions/{cmp_id}/participants")
        scrubbed = scrub_cmas_pii(raw)
        path = self.scrubbed_dir / f"participants_{cmp_id}.json"
        path.write_text(json.dumps(scrubbed, indent=2, ensure_ascii=False))
        return scrubbed

    def schedule(self, cmp_id: int) -> list[dict[str, Any]]:
        data = self.http.get_json(f"{API}/competitions/{cmp_id}/schedule")
        path = self.scrubbed_dir / f"schedule_{cmp_id}.json"
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        return data

    def unit_results(self, ut_id: int) -> list[dict[str, Any]]:
        raw = self.http.get_json(f"{API}/units/{ut_id}/results")
        scrubbed = scrub_cmas_pii(raw)
        path = self.scrubbed_dir / f"unit_results_{ut_id}.json"
        path.write_text(json.dumps(scrubbed, indent=2, ensure_ascii=False))
        return scrubbed

    def medallists(self, cmp_id: int) -> Any:
        try:
            data = self.http.get_json(f"{API}/competitions/{cmp_id}/medallists")
        except Exception:  # noqa: BLE001
            return []
        scrubbed = scrub_cmas_pii(data)
        (self.scrubbed_dir / f"medallists_{cmp_id}.json").write_text(
            json.dumps(scrubbed, indent=2, ensure_ascii=False)
        )
        return scrubbed

    def ingest_competition(self, comp: dict[str, Any]) -> dict[str, Any]:
        cmp_id = comp["CmpID"]
        parts = self.participants(cmp_id)
        sched = self.schedule(cmp_id)
        unit_ids = sorted(
            {
                int(s["UtID"])
                for s in sched
                if s.get("UtID") is not None
            }
        )
        results: list[dict[str, Any]] = []
        for ut in unit_ids:
            try:
                results.extend(self.unit_results(ut))
            except Exception as e:  # noqa: BLE001
                results.append({"error": str(e), "ut_id": ut})
        meds = self.medallists(cmp_id)
        return {
            "competition": comp,
            "participants": parts,
            "schedule": sched,
            "results": results,
            "medallists": meds,
        }


def normalize_cmas_athletes(participants: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_hmac: dict[str, dict[str, Any]] = {}
    for p in participants:
        hmac_id = p.get("ParAccreditationHmac") or f"par-{p.get('ParID')}"
        display, given, family = parse_cmas_print_name(p.get("ParPrintName") or "")
        sex = "F" if (p.get("ParGender") or "").upper().startswith("F") else "M"
        country = p.get("ParOrgCode") or p.get("OrgCodeDescr") or "UNK"
        if country == "CMAS1":
            country = "AIN"
        entry = by_hmac.get(hmac_id)
        if not entry:
            entry = {
                "id": f"cmas:{hmac_id[:16]}",
                "accred_hmac": hmac_id,
                "name": display,
                "given": given,
                "family": family,
                "sex": sex,
                "country": country,
                "source": "CMAS_API",
                "age_category": p.get("AGLongDescr"),
                "aliases": [],
            }
            by_hmac[hmac_id] = entry
        else:
            if display and display not in entry["aliases"] and display != entry["name"]:
                entry["aliases"].append(display)
        # birth year if present (ParYearBirthDate only — full DOB scrubbed)
        y = p.get("ParYearBirthDate")
        if y and not entry.get("birth_year"):
            try:
                entry["birth_year"] = int(str(y)[:4])
            except ValueError:
                pass
    return list(by_hmac.values())


def normalize_cmas_attempts(
    results: list[dict[str, Any]], comp: dict[str, Any]
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for r in results:
        if "error" in r:
            continue
        disc = map_cmas_discipline(r.get("EvLongDescr"), r.get("EvShortDescr"))
        if not disc:
            continue
        display, _, _ = parse_cmas_print_name(r.get("ParPrintName") or "")
        final_t = r.get("ResResultFinal") or r.get("ResResult")
        rp, _ = parse_result_value(str(final_t) if final_t is not None else "")
        ap_t = r.get("DECLLEN_STR") or r.get("DECLTIME_STR")
        ap, _ = parse_result_value(str(ap_t) if ap_t is not None else "")
        status = (r.get("ResReasonCode") or r.get("ResNote") or "") or ""
        pen = r.get("ResPenality") or r.get("ResNotePenality")
        card = "WHITE"
        if pen not in (None, "", 0, "0"):
            card = "YELLOW"
        st_up = str(status).upper()
        if "DSQ" in st_up or "DQ" in st_up or "RED" in st_up:
            card = "RED"
        points = portal_points(disc, rp, card)
        sex = "F" if (r.get("ParGender") or "").upper().startswith("F") else "M"
        country = r.get("ParOrgCode") or r.get("OrgCodeDescr") or "UNK"
        if country == "CMAS1":
            country = "AIN"
        out.append(
            {
                "id": f"cmas-res-{r.get('ResID')}",
                "athlete_name": display,
                "athlete_hmac": r.get("ParAccreditationHmac"),
                "par_id": r.get("ParID"),
                "event_id": f"cmas-{comp.get('CmpID')}",
                "event_name": comp.get("CmpTitShortDescr") or comp.get("CmpTitLongDescr"),
                "discipline": disc,
                "date": (r.get("EvStartDate") or r.get("UtOfficialDate") or "")[:10],
                "ap": ap,
                "rp": rp,
                "card": card,
                "points": points,
                "penalty": pen,
                "status_note": status,
                "record": r.get("ResRecord"),
                "rank": r.get("ResRnk"),
                "sex": sex,
                "country": country,
                "age_category": r.get("AGLongDescr"),
                "federation": "CMAS",
                "source": "CMAS_API",
            }
        )
    return out
