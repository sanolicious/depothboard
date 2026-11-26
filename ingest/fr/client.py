"""Rate-limited Freedive Ranking (FR) client — gap-fill + verification only."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote

from ingest.common.http import PoliteClient
from ingest.common.normalize import normalize_name, parse_card, parse_result_value, portal_points


BASE = "https://freediveranking.com"

# Explicit slug overrides for diacritics / multi-part names.
SLUG_OVERRIDES = {
    "Mirela Kardašević": "Mirela-Kardasevic",
    "Agata Załęcka": "Agata-Zalecka",
    "Vitomir Maričić": "Vitomir-Maricic",
    "Jarmila Slovenčíková": "Jarmila-Slovencikova",
    "Guillaume Néry": "Guillaume-Nery",
    "Sofía Gómez Uribe": "Sofia-Gomez-Uribe",
    "Claire Beatrix Paris": "Claire-Beatrix-Paris",
    "Siew Ling, Elys Lai": "Elys-Lai",
    "Hyemi (Mimi) Kim": "Hyemi-Kim",
    "Yi(Zy) Zhang": "Yi-Zhang",
    "Ming (William Joy) Jin": "Ming-Jin",
}


def athlete_slug(name: str) -> str:
    if name in SLUG_OVERRIDES:
        return SLUG_OVERRIDES[name]
    # drop nicknames in parens, collapse whitespace
    s = re.sub(r"\([^)]*\)", " ", name)
    s = s.replace(",", " ")
    # strip combining marks for URL
    import unicodedata

    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^A-Za-z0-9\s\-]", "", s)
    s = re.sub(r"\s+", "-", s.strip())
    return s


@dataclass
class FrResultRow:
    event_id: str
    event_name: str
    date: str
    federation: str  # AIDA | CMAS (native)
    discipline: str
    ap: float | None
    rp: float | None
    card: str
    remarks: str
    athlete_name: str
    athlete_slug: str
    provenance: str


class FRClient:
    """Polite FR access. Prefer longer min_interval than AIDA/CMAS."""

    def __init__(self, http: PoliteClient) -> None:
        self.http = http

    def ranking(self, gender: str, limit: int = 50) -> list[dict[str, Any]]:
        g = "male" if gender.upper().startswith("M") else "female"
        url = f"{BASE}/api/ranking?gender={g}&limit={limit}"
        data = self.http.get_json(url, force=True)
        items = data.get("items") or data.get("data") or []
        out = []
        for i, row in enumerate(items, 1):
            pbs = row.get("pbs") or row.get("bests") or row.get("disciplines") or {}
            out.append(
                {
                    "rank": row.get("rank") or row.get("position") or i,
                    "name": row.get("name"),
                    "points": float(row.get("points") or 0),
                    "country": row.get("country"),
                    "slug": row.get("slug") or athlete_slug(row.get("name") or ""),
                    "pbs": pbs,
                    "sex": "M" if g == "male" else "F",
                    "id": row.get("id") or "",
                }
            )
        return out

    def athlete_html(self, slug: str, *, force: bool = False) -> str:
        url = f"{BASE}/athlete/{quote(slug)}"
        return self.http.get_text(url, force=force)

    def parse_athlete_results(self, html: str, *, name: str, slug: str) -> list[FrResultRow]:
        provenance = f"{BASE}/athlete/{slug}"
        rows: list[FrResultRow] = []
        # Each result row links to /events/<id>?day=YYYY-MM-DD
        trs = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I)
        for tr in trs:
            if "/events/" not in tr:
                continue
            if "CMAS" not in tr and "AIDA" not in tr:
                continue
            em = re.search(
                r'href="/events/([a-f0-9]+)\?day=(\d{4}-\d{2}-\d{2})"[^>]*>(.*?)</a>',
                tr,
                re.S | re.I,
            )
            if not em:
                continue
            event_id, date, event_name = em.group(1), em.group(2), _strip_tags(em.group(3))
            fed = "CMAS" if re.search(r">\s*CMAS\s*<", tr) else "AIDA"
            # cells after federation badge: date | discipline | announced | realised | card | remarks
            plain = _strip_tags(tr)
            parts = [p.strip() for p in re.split(r"\s*\|\s*", plain) if p.strip()]
            # Fallback: extract discipline + values via regex on raw tr
            dm = re.search(
                r">\s*(STA|DYN|DYNB|DNF|FIM|CWT|CWTB|CNF)\s*<",
                tr,
                re.I,
            )
            if not dm:
                continue
            disc = dm.group(1).upper()
            # Collect meter/time-looking cells
            cells = re.findall(
                r"<td[^>]*>\s*(.*?)\s*</td>",
                tr,
                re.S | re.I,
            )
            cells_plain = [_strip_tags(c).strip() for c in cells]
            # Typical: [event+fed, date, disc, announced, realised, card, remarks]
            announced = realised = card_raw = remarks = ""
            for i, c in enumerate(cells_plain):
                if c.upper() == disc and i + 3 < len(cells_plain):
                    announced = cells_plain[i + 1]
                    realised = cells_plain[i + 2]
                    card_raw = cells_plain[i + 3]
                    remarks = cells_plain[i + 4] if i + 4 < len(cells_plain) else ""
                    break
            if not realised or realised in {"-", "—"}:
                # try announced as fallback only if realised missing
                continue
            ap_v, _ = parse_result_value(announced)
            rp_v, _ = parse_result_value(realised)
            if rp_v is None:
                continue
            card = parse_card(card_raw if card_raw not in {"-", "—", ""} else "W")
            if card == "UNKNOWN":
                card = "WHITE"
            rows.append(
                FrResultRow(
                    event_id=f"fr-{event_id}-{date}-{disc}",
                    event_name=event_name.strip(),
                    date=date,
                    federation=fed,
                    discipline=disc,
                    ap=ap_v if ap_v is not None else rp_v,
                    rp=rp_v,
                    card=card,
                    remarks=remarks,
                    athlete_name=name,
                    athlete_slug=slug,
                    provenance=provenance,
                )
            )
        return rows


def _strip_tags(html: str) -> str:
    s = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S | re.I)
    s = re.sub(r"<style[^>]*>.*?</style>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", "|", s)
    s = (
        s.replace("&amp;", "&")
        .replace("&#x27;", "'")
        .replace("&quot;", '"')
        .replace("&nbsp;", " ")
    )
    s = re.sub(r"\|+", "|", s)
    return s.strip("| ")


def rows_to_attempts(rows: list[FrResultRow], *, sex: str) -> list[dict[str, Any]]:
    out = []
    for r in rows:
        pts = portal_points(r.discipline, r.rp, r.card)
        out.append(
            {
                "id": f"fr-{r.athlete_slug}-{r.date}-{r.discipline}-{r.event_id[-8:]}",
                "athlete_name": r.athlete_name,
                "athlete_slug": r.athlete_slug,
                "sex": sex,
                "event_id": r.event_id,
                "event_name": r.event_name,
                "federation": r.federation if r.federation in {"AIDA", "CMAS"} else "CMAS",
                "date": r.date,
                "discipline": r.discipline,
                "ap": r.ap,
                "rp": r.rp,
                "card": r.card,
                "points": pts,
                "remarks": r.remarks,
                "source": "FR",
                "provenance": r.provenance,
                "record_flags": [],
            }
        )
    return out


# Hard caps — reject misparsed HTML cells (e.g. STA seconds → CNF metres).
PB_VALUE_CAPS = {
    "CWT": 160,
    "CWTB": 160,
    "CNF": 130,
    "FIM": 160,
    "DYN": 400,
    "DYNB": 400,
    "DNF": 300,
    "STA": 800,  # seconds
}


def plausible_pb(disc: str, value: float) -> bool:
    cap = PB_VALUE_CAPS.get(disc)
    if cap is None:
        return False
    if value <= 0 or value > cap:
        return False
    # Depth PBs are almost never sub-metre fractions > 3 decimals of noise only
    if disc in {"CWT", "CWTB", "CNF", "FIM"} and value < 5:
        return False
    return True


def pbs_to_gap_attempts(
    *,
    name: str,
    slug: str,
    sex: str,
    pbs: dict[str, Any],
    existing_best: dict[str, float],
    origin: str = "ranking",
) -> list[dict[str, Any]]:
    """Synthetic FR PB rows only for disciplines where primary sources are behind/missing."""
    provenance = f"{BASE}/athlete/{slug}"
    out = []
    for disc, raw in (pbs or {}).items():
        disc = str(disc).upper()
        if disc not in {"STA", "DYN", "DYNB", "DNF", "CWT", "CWTB", "CNF", "FIM"}:
            continue
        val, _ = parse_result_value(str(raw))
        if val is None or not plausible_pb(disc, val):
            continue
        pts = portal_points(disc, val, "WHITE")
        cur = existing_best.get(disc)
        if cur is not None and cur + 1e-6 >= pts:
            continue  # primary already covers
        out.append(
            {
                "id": f"fr-pb-{slug}-{disc}",
                "athlete_name": name,
                "athlete_slug": slug,
                "sex": sex,
                "event_id": f"fr-pb-{slug}-{disc}",
                "event_name": f"FR competition PB · {disc}",
                "federation": "CMAS",  # unknown native fed; board uses source=FR
                "date": "2020-01-01",
                "discipline": disc,
                "ap": val,
                "rp": val,
                "card": "WHITE",
                "points": pts,
                "remarks": f"gap-fill from FR {origin} PB",
                "source": "FR",
                "provenance": provenance,
                "record_flags": [],
            }
        )
    return out
