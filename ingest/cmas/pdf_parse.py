"""Parse CMAS freediving result PDFs (Microplus + organizer layouts)."""

from __future__ import annotations

import hashlib
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DISC_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bDNF\b|DYNAMIC\s+NO\s+FIN", re.I), "DNF"),
    (
        re.compile(
            r"\bDYN[\s\-]?BF\b|\bDYN\s+BI[\-\s]?FIN|\bDBF\b|DYNAMIC\s+WITH\s+BI[\-\s]?FIN",
            re.I,
        ),
        "DYNB",
    ),
    (re.compile(r"\bDYN\b|DYNAMIC\s+WITH\s+FIN(?!S)|MONOFIN", re.I), "DYN"),
    (re.compile(r"\bSTA\b|STATIC\s+APNEA", re.I), "STA"),
    (re.compile(r"\bCWTB\b|CWT[\s\-]?BF|CWT\s+BF\b", re.I), "CWTB"),
    (re.compile(r"\bCWT\b|CONSTANT\s+WEIGHT\s+WITH\s+FINS", re.I), "CWT"),
    (re.compile(r"\bCNF\b|WITHOUT\s+FINS|NO\s+FINS", re.I), "CNF"),
    (re.compile(r"\bFIM\b|FREE\s+IMMERSION", re.I), "FIM"),
]

SEX_MAP = {"M": "M", "F": "F", "W": "F", "MEN": "M", "WOMEN": "F", "MALE": "M", "FEMALE": "F"}


@dataclass
class PdfAttempt:
    athlete_name: str
    sex: str | None
    country: str | None
    discipline: str
    rp: float
    ap: float | None
    card: str
    points: float
    date: str | None
    event_name: str
    source_file: str
    remarks: str
    raw_line: str


def pdf_to_text(path: Path) -> str:
    try:
        out = subprocess.check_output(
            ["pdftotext", "-layout", str(path), "-"],
            stderr=subprocess.DEVNULL,
            timeout=120,
        )
        return out.decode("utf-8", errors="replace")
    except Exception:  # noqa: BLE001
        return ""


def _num(s: str) -> float | None:
    s = (s or "").strip().replace(",", ".")
    s = re.sub(r"[^\d:.]", "", s)
    if not s:
        return None
    if ":" in s:
        parts = s.split(":")
        try:
            if len(parts) == 2:
                return int(parts[0]) * 60 + float(parts[1])
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        except ValueError:
            return None
    try:
        return float(s)
    except ValueError:
        return None


def _points(disc: str, rp: float) -> float:
    from ingest.common.normalize import DISCIPLINE_FACTOR

    return round(rp * DISCIPLINE_FACTOR[disc], 4)


def _detect_disc(header_blob: str, fallback: str | None = None) -> str | None:
    # Prefer more specific patterns first (already ordered)
    for pat, code in DISC_PATTERNS:
        if pat.search(header_blob):
            return code
    return fallback


def _guess_date(text: str, filename: str) -> str | None:
    m = re.search(r"(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})", text)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.search(r"(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(20\d{2})", text, re.I)
    if m:
        months = {
            "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
            "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
        }
        return f"{m.group(3)}-{months[m.group(2)[:3].upper()]:02d}-{int(m.group(1)):02d}"
    m = re.search(r"(20\d{2})", filename)
    if m:
        return f"{m.group(1)}-07-01"
    return None


def _card_from(notes: str, final: float | None, realized: float | None) -> str:
    n = (notes or "").upper()
    if any(x in n for x in ("DQ", "DSQ", "DNS", "RED", "BO ", " BLACKOUT", "UW BO", "SP DIP")):
        if "DNS" in n:
            return "RED"
        return "RED"
    if final is not None and realized is not None and final == 0 and realized > 0:
        return "RED"
    if "PEN" in n or "YELLOW" in n or "EARLY" in n:
        return "YELLOW"
    return "WHITE"


_COUNTRY_WORDS = {
    "italy", "france", "russia", "croatia", "poland", "spain", "germany",
    "japan", "china", "ukraine", "hungary", "turkey", "brazil", "mexico",
    "colombia", "chile", "serbia", "slovenia", "slovakia", "austria",
    "sweden", "norway", "finland", "denmark", "belgium", "netherlands",
    "portugal", "greece", "israel", "egypt", "kuwait", "usa", "canada",
    "australia", "switzerland", "romania", "bulgaria", "czech", "republic",
    "world", "record", "gold", "silver", "bronze", "medal", "new",
}


def _clean_name(parts: list[str]) -> str:
    # Drop trailing country / award noise
    toks = [t for t in parts if t.lower().strip(".,") not in _COUNTRY_WORDS]
    name = " ".join(toks)
    name = re.sub(r"\s+", " ", name).strip(" -")
    if name.isupper():
        toks = name.split()
        name = " ".join(t.title() for t in toks)
    # Prefer "Given Family" when CMAS dumps "FAMILY Given" as two tokens all-caps already titled
    return name


def parse_pdf(path: Path) -> list[PdfAttempt]:
    text = pdf_to_text(path)
    if not text.strip():
        return []
    event_name = path.stem.replace("--", " ").replace("-", " ")
    # Try first heading line
    for line in text.splitlines()[:30]:
        if "CMAS" in line.upper() or "CHAMPIONSHIP" in line.upper() or "WORLD" in line.upper():
            event_name = re.sub(r"\s+", " ", line).strip() or event_name
            break
    date = _guess_date(text, path.name)
    attempts: list[PdfAttempt] = []

    # Filename often encodes discipline: "Results - CWT Men 4th Oct 2024.pdf"
    file_disc = _detect_disc(path.name)
    file_sex = None
    if re.search(r"\bwomen\b|\bfemale\b", path.name, re.I):
        file_sex = "F"
    elif re.search(r"\bmen\b|\bmale\b", path.name, re.I):
        file_sex = "M"

    # Split into page-ish chunks on form feed
    pages = text.split("\f")
    current_disc: str | None = file_disc
    current_sex: str | None = file_sex

    for page in pages:
        header = "\n".join(page.splitlines()[:12])
        disc = _detect_disc(header, current_disc)
        if disc:
            current_disc = disc
        sex_m = re.search(r"\b(SENIOR|SENIORS)?\s*(RESULTS)?\s*[-–]?\s*(MALE|FEMALE|MEN|WOMEN|M|F)\b", header, re.I)
        if sex_m:
            current_sex = SEX_MAP.get(sex_m.group(3).upper())
        if re.search(r"\bWOMEN\b|\bFEMALE\b", header, re.I):
            current_sex = "F"
        elif re.search(r"\bMEN\b|\bMALE\b", header, re.I) and "WOMEN" not in header.upper():
            current_sex = "M"

        if not current_disc:
            continue

        for raw in page.splitlines():
            line = raw.rstrip()
            if len(line) < 10:
                continue
            if re.search(
                r"RANK|SURNAME|NAME\s+Surname|Final Distance|Target Dist|PAGE\s+\d|TARGET DEPTH|REACHED",
                line,
                re.I,
            ):
                continue
            # Skip relay / speed apnea
            if re.search(r"\b\d\s*X\s*\d{2}\b|\bSPEED\b", line, re.I):
                continue

            # Per-row discipline (Authentic Big Blue / dive-log style)
            row_disc = _detect_disc(line)
            use_disc = row_disc or current_disc
            if not use_disc:
                continue

            parsed = _parse_line(line, use_disc, current_sex)
            if not parsed:
                continue
            name, sex, country, ap, rp, notes = parsed
            if rp is None:
                continue
            # Prefer explicit card token on the line when present
            if re.search(r"\bRED\b|\bDQ\b|\bDSQ\b", line, re.I):
                card = "RED"
            elif re.search(r"\bYELLOW\b", line, re.I):
                card = "YELLOW"
            elif re.search(r"\bWHITE\b", line, re.I):
                card = "WHITE"
            else:
                card = _card_from(notes, rp if rp else 0, ap)
            if card == "RED":
                pts = 0.0
            else:
                pts = _points(use_disc, rp)
            attempts.append(
                PdfAttempt(
                    athlete_name=name,
                    sex=sex or current_sex,
                    country=country,
                    discipline=use_disc,
                    rp=rp,
                    ap=ap,
                    card=card,
                    points=pts,
                    date=date,
                    event_name=event_name,
                    source_file=path.name,
                    remarks=notes[:200],
                    raw_line=line.strip()[:240],
                )
            )
    return attempts


_FULL_COUNTRY = {
    "france": "FRA", "italy": "ITA", "poland": "POL", "croatia": "CRO", "crotia": "CRO",
    "spain": "ESP", "germany": "GER", "japan": "JPN", "china": "CHN", "ukraine": "UKR",
    "hungary": "HUN", "turkey": "TUR", "brazil": "BRA", "mexico": "MEX", "colombia": "COL",
    "chile": "CHI", "serbia": "SRB", "slovenia": "SLO", "slovakia": "SVK", "austria": "AUT",
    "sweden": "SWE", "norway": "NOR", "finland": "FIN", "denmark": "DEN", "belgium": "BEL",
    "netherlands": "NED", "portugal": "POR", "greece": "GRE", "israel": "ISR", "egypt": "EGY",
    "kuwait": "KUW", "peru": "PER", "usa": "USA", "united states": "USA", "canada": "CAN",
    "australia": "AUS", "switzerland": "SUI", "romania": "ROU", "bulgaria": "BUL",
    "united kingdom": "GBR", "great britain": "GBR", "chinese taipei": "TPE", "taiwan": "TPE",
    "south korea": "KOR", "korea": "KOR", "russia": "RUS", "oman": "OMA", "lithuania": "LTU",
    "morocco": "MAR", "saudi arabia": "KSA", "singapore": "SGP", "cmas-1": "CMAS1",
    "cmas1": "CMAS1",
}


def _parse_kalamata_depth(
    line: str, disc: str, default_sex: str | None
) -> tuple[str, str | None, str | None, float | None, float | None, str] | None:
    """Parse 'Rank Name Country Announced Realized Points Card Notes'."""
    s = re.sub(r"^\s*\d{0,3}\s+", "", line).strip()
    if not s or "Athlete name" in s or "Announced" in s:
        return None
    # Card token
    card_m = re.search(r"\b(WHITE|YELLOW|RED)\b", s, re.I)
    if not card_m:
        return None
    card = card_m.group(1).upper()
    left = s[: card_m.start()].rstrip()
    notes = s[card_m.end() :].strip()
    # Trailing numbers: announced realized points (points may equal realized for depth)
    nums = list(re.finditer(r"(\d+[.,]?\d*)", left))
    if len(nums) < 2:
        return None
    # last 2–3 numbers are depths/points
    rp = _num(nums[-2].group(1)) if len(nums) >= 3 else _num(nums[-1].group(1))
    # Prefer realized depth (second last when 3 nums) — for YELLOW, points column may be lower
    if len(nums) >= 3:
        announced = _num(nums[-3].group(1))
        realized = _num(nums[-2].group(1))
        points_col = _num(nums[-1].group(1))
        # Use realized for RP; if red use 0
        rp = realized
        ap = announced
    else:
        ap = None
        rp = _num(nums[-1].group(1))
    name_country = left[: nums[-3].start() if len(nums) >= 3 else nums[0].start()].strip()
    # Split country (full name at end)
    country = None
    name = name_country
    low = name_country.lower()
    for cname, iso in sorted(_FULL_COUNTRY.items(), key=lambda x: -len(x[0])):
        if low.endswith(cname):
            country = iso
            name = name_country[: -len(cname)].strip()
            break
        # also "CMAS-1" / "CMAS1"
        if cname.replace("-", "") in low.replace("-", "").replace(" ", "")[-10:]:
            if "cmas" in low:
                country = "CMAS1"
                name = re.sub(r"CMAS-?\s*1", "", name_country, flags=re.I).strip()
                break
    name = _clean_name(name.split())
    if len(name.split()) < 2:
        return None
    if card == "RED":
        rp = 0.0
    elif card == "YELLOW" and len(nums) >= 3:
        # Official final after penalties is points column for depth events
        rp = points_col if points_col is not None else rp
    if rp is not None and rp > 0:
        if disc in {"CWT", "CWTB", "CNF", "FIM"} and rp > 150:
            return None
        if disc in {"DYN", "DYNB", "DNF"} and rp > 350:
            return None
        if disc == "STA" and (rp < 30 or rp > 800):
            return None
    return (name, default_sex, country, ap, rp, notes)


def _parse_dive_log_row(
    line: str, disc: str, default_sex: str | None
) -> tuple[str, str | None, str | None, float | None, float | None, str] | None:
    """Parse Authentic Big Blue / dive-log rows with per-line discipline + WHITE/YELLOW/RED."""
    if not re.search(r"\b(WHITE|YELLOW|RED)\b", line, re.I):
        return None
    # Given Surname NAT SEX DISC ... FINAL
    m = re.search(
        r"([A-Za-zÀ-ÿ'.\-]+)\s+([A-Za-zÀ-ÿ'.\-]+(?:\s+[A-Za-zÀ-ÿ'.\-]+)?)\s+"
        r"([A-Z]{3}|CMAS1)\s+([MF])\s+"
        r"(CWT\s*BF|CWTB|CWT|CNF|FIM|DYN\s*BF|DYNB|DYN|DNF|STA)\s+"
        r".*?\b(WHITE|YELLOW|RED)\b.*?(\d+[.,]?\d*)\s*$",
        line,
        re.I,
    )
    if not m:
        return None
    given, family, country, sex, _disc_tok, card, final_s = m.groups()
    name = _clean_name([given, family])
    rp = _num(final_s)
    if card.upper() == "RED":
        rp = 0.0
    # announced depth: first standalone meter-like number after disc
    ap = None
    am = re.search(
        r"(?:CWT\s*BF|CWTB|CWT|CNF|FIM|DYN\s*BF|DYNB|DYN|DNF|STA)\s+(\d{1,3})\b",
        line,
        re.I,
    )
    if am:
        ap = float(am.group(1))
    if country == "SPA":
        country = "ESP"
    return (name, sex, country, ap, rp, card)


def _parse_line(
    line: str, disc: str, default_sex: str | None
) -> tuple[str, str | None, str | None, float | None, float | None, str] | None:
    """Return (name, sex, country, ap, rp, notes) or None."""
    hit = _parse_dive_log_row(line, disc, default_sex)
    if hit:
        return hit

    # Kalamata / modern depth layout
    if re.search(r"\b(WHITE|YELLOW|RED)\b", line, re.I) and re.search(
        r"\b(France|Italy|Poland|Croatia|Spain|Germany|Japan|China|Ukraine|CMAS-?1|United|Chile|Slovenia)\b",
        line,
        re.I,
    ):
        hit = _parse_kalamata_depth(line, disc, default_sex)
        if hit:
            return hit

    # Strip leading rank
    s = re.sub(r"^\s*[-–]?\s*\d{0,3}\s+", "", line).strip()
    if not s:
        return None

    # Country codes (3 letters) or full country names later
    # Pattern Kuwait-like: Name Surname NAT SEX category result card pen final
    m = re.match(
        r"^([A-Za-zÀ-ÿ'.\-]+(?:\s+[A-Za-zÀ-ÿ'.\-]+){0,4})\s+"
        r"([A-Za-zÀ-ÿ'.\-]+(?:\s+[A-Za-zÀ-ÿ'.\-]+){0,3})\s+"
        r"([A-Z]{3}|CMAS1)\s+"
        r"([MF])\s+"
        r"(?:seniors?|juniors?|masters?)?\s*"
        r"(\d+[.,]\d+|\d+:\d{2}(?:[.,]\d+)?|DNS|DSQ|DQ)?\s*"
        r"(W|Y|R|White|Yellow|Red)?\s*"
        r"([\d.,]*)\s*"
        r"(\d+[.,]\d+|\d+:\d{2}(?:[.,]\d+)?)?",
        s,
        re.I,
    )
    # Simpler: find trailing numeric final result
    nums = list(re.finditer(r"(\d+:\d{2}(?:[.,]\d+)?|\d+[.,]\d{1,2}|\d+\.\d+)", s))
    if not nums:
        # DNS/DQ only
        if re.search(r"\b(DNS|DSQ|DQ)\b", s, re.I):
            # try extract name + country
            cm = re.search(r"([A-Za-zÀ-ÿ' .\-]{5,60})\s+([A-Z]{3}|CMAS1)\b", s)
            if cm:
                return (_clean_name(cm.group(1).split()), default_sex, cm.group(2), None, 0.0, s)
        return None

    # Country token
    country = None
    cm = re.search(r"\b([A-Z]{3}|CMAS1|SPA|GER|SUI|NED|CHI|CRO|POL|ITA|FRA|RUS|USA|JPN|CHN|UKR|HUN|TUR|COL|ESP|TPE|KOR|GRE|NOR|AUT|MEX|CUB|SRB|SLO|SVK|ISR|GBR|SWE|FIN|BEL|DEN|POR|ARM|IRI|IRA|KUW|PER)\b", s)
    if cm:
        country = cm.group(1)
        if country == "SPA":
            country = "ESP"
        if country in {"IRA", "IRI"}:
            country = "IRI"

    sex = default_sex
    sm = re.search(r"\b([MF])\b", s)
    if sm and re.search(r"\b[MF]\b.*\b(seniors?|juniors?|[A-Z]{3})\b|\b(seniors?|juniors?|[A-Z]{3}).*\b[MF]\b", s, re.I):
        sex = sm.group(1)

    # Final result: last number; for DQ lines final may be 0
    final_s = nums[-1].group(1)
    rp = _num(final_s)
    ap = _num(nums[-2].group(1)) if len(nums) >= 2 else None

    # Name: text before country code
    name_region = s
    if country:
        name_region = s[: s.find(country)].strip()
    # Remove leading junk numbers already stripped
    name_region = re.sub(r"^[\d\s./-]+", "", name_region)
    # Remove trailing time/distance fragments accidentally included
    name_toks = [
        t
        for t in name_region.split()
        if not re.fullmatch(r"\d+[.,]?\d*", t)
        and not re.fullmatch(r"\d+:\d{2}.*", t)
        and t.upper() not in {"SENIOR", "SENIORS", "JUNIOR", "JUNIORS", "MASTERS", "MALE", "FEMALE"}
    ]
    if len(name_toks) < 2:
        return None
    # Heuristic: if first token is ALLCAPS surname-ish and rest given names — CMAS "SURNAME Given"
    # Many PDFs are "GIVEN SURNAME" in separate columns already joined.
    name = _clean_name(name_toks[:5])
    notes = ""
    nm = re.search(r"(GOLD|SILVER|BRONZE|DQ|DSQ|DNS|WR|NR|BO|EARLY|WORLD RECORD|PEN).*$", s, re.I)
    if nm:
        notes = nm.group(0)

    # Filter absurd values (keep rp==0 for DQ)
    if rp is None:
        return None
    if rp == 0:
        return (name, sex, country, ap, rp, notes)
    if disc == "STA":
        if rp < 30 or rp > 800:
            return None
    elif disc in {"CWT", "CWTB", "CNF", "FIM"}:
        if rp > 150:
            return None
    elif disc in {"DYN", "DYNB", "DNF"}:
        if rp > 350:
            return None
    elif rp > 400:
        return None

    return (name, sex, country, ap, rp, notes)


def attempts_to_dicts(attempts: list[PdfAttempt]) -> list[dict[str, Any]]:
    out = []
    for i, a in enumerate(attempts):
        rid = hashlib.sha1(
            f"{a.source_file}|{a.athlete_name}|{a.discipline}|{a.rp}|{a.date}|{a.raw_line}".encode()
        ).hexdigest()[:16]
        out.append(
            {
                "id": f"cmas-pdf-{rid}",
                "athlete_name": a.athlete_name,
                "sex": a.sex,
                "country": a.country,
                "discipline": a.discipline,
                "ap": a.ap if a.ap is not None else a.rp,
                "rp": a.rp,
                "card": a.card,
                "points": a.points if a.card != "RED" else 0.0,
                "date": a.date,
                "event_name": a.event_name,
                "event_id": f"cmas-pdf-{hashlib.sha1(a.event_name.encode()).hexdigest()[:10]}",
                "federation": "CMAS",
                "source": "CMAS_PDF",
                "remarks": a.remarks,
                "source_file": a.source_file,
                "record_flags": [],
            }
        )
    return out
