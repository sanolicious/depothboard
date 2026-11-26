"""Name normalization, discipline mapping, result parsing, points."""

from __future__ import annotations

import hashlib
import hmac
import re
import unicodedata
from typing import Any


DISCIPLINE_FACTOR = {
    "STA": 0.2,
    "DYN": 0.5,
    "DYNB": 0.5,
    "DNF": 0.5,
    "CWT": 1.0,
    "CWTB": 1.0,
    "CNF": 1.0,
    "FIM": 1.0,
}

AIDA_DISC_IDS = {
    "8": "STA",
    "6": "DYN",
    "11": "DYNB",
    "7": "DNF",
    "3": "CWT",
    "12": "CWTB",
    "4": "CNF",
    "5": "FIM",
    "pool": "POOL",
    "depth": "DEPTH",
    "all": "OVERALL",
}

CMAS_DISC_MAP = {
    "CONSTANT WEIGHT WITH FINS": "CWT",
    "CONSTANT WEIGHT WITH BI-FINS": "CWTB",
    "CONSTANT WEIGHT BI-FINS": "CWTB",
    "CONSTANT WEIGHT WITHOUT FINS": "CNF",
    "FREE IMMERSION": "FIM",
    "STATIC APNEA": "STA",
    "DYNAMIC WITH FINS": "DYN",
    "DYNAMIC WITH BI-FINS": "DYNB",
    "DYNAMIC BI-FINS": "DYNB",
    "DYNAMIC WITHOUT FINS": "DNF",
    "CWT": "CWT",
    "CWT-BF": "CWTB",
    "CWTB": "CWTB",
    "CNF": "CNF",
    "FIM": "FIM",
    "STA": "STA",
    "DYN": "DYN",
    "DYN-BF": "DYNB",
    "DYNB": "DYNB",
    "DNF": "DNF",
}

# HMAC key for CMAS accreditation codes — never store plaintext.
_ACCRED_HMAC_KEY = b"depthboard-ingest-accred-v1-dev-only"


def scrub_cmas_pii(obj: Any) -> Any:
    """Remove birth dates; replace accreditation codes with HMAC digests."""
    if isinstance(obj, list):
        return [scrub_cmas_pii(x) for x in obj]
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            lk = k.lower()
            if "birth" in lk:
                continue
            if "accreditation" in lk or k == "ParAccreditationCode":
                if v:
                    digest = hmac.new(
                        _ACCRED_HMAC_KEY, str(v).encode("utf-8"), hashlib.sha256
                    ).hexdigest()
                    out["ParAccreditationHmac"] = digest
                continue
            out[k] = scrub_cmas_pii(v)
        return out
    return obj


def normalize_name(name: str) -> str:
    """Comparable form: NFKD, strip diacritics, lower, drop punctuation/parens."""
    if not name:
        return ""
    # Drop nickname parentheses: Hyemi (Mimi) Kim
    s = re.sub(r"\([^)]*\)", " ", name)
    s = s.replace(",", " ")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    # Turkish İ / ı quirks
    s = s.replace("İ", "I").replace("ı", "i")
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def name_tokens_sorted(name: str) -> str:
    toks = normalize_name(name).split()
    return " ".join(sorted(toks))


def parse_cmas_print_name(print_name: str) -> tuple[str, str, str]:
    """CMAS uses 'SURNAME Given'. Return (display, given, family)."""
    raw = (print_name or "").strip()
    if not raw:
        return "", "", ""
    parts = raw.split()
    if len(parts) == 1:
        return raw.title(), raw.title(), ""
    # Heuristic: leading ALLCAPS tokens are family name
    family_parts: list[str] = []
    given_parts: list[str] = []
    for i, p in enumerate(parts):
        if p.isupper() and i == 0:
            family_parts.append(p.title())
        elif p.isupper() and family_parts and not given_parts:
            family_parts.append(p.title())
        else:
            given_parts.append(p.title() if p.isupper() else p)
    if not given_parts and len(family_parts) >= 2:
        given_parts = [family_parts[-1]]
        family_parts = family_parts[:-1]
    family = " ".join(family_parts)
    given = " ".join(given_parts)
    display = f"{given} {family}".strip()
    return display, given, family


def parse_result_value(text: str) -> tuple[float | None, str]:
    """Parse '137 m', '11:35', '8:32,00', '96.2' into base units (m or s)."""
    if text is None:
        return None, ""
    raw = str(text).strip()
    if not raw or raw in {"-", "—", "DNS", "DSQ", "DNF"}:
        return None, raw
    cleaned = re.sub(r"<[^>]+>", " ", raw)
    cleaned = cleaned.replace(",", ".")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # time mm:ss or h:mm:ss
    m = re.search(r"(\d+):(\d{2})(?:\.(\d+))?", cleaned)
    if m and "m" not in cleaned.lower().split(":")[0][-3:]:
        # distinguish from depths? times have colon
        minutes = int(m.group(1))
        seconds = int(m.group(2))
        frac = float(f"0.{m.group(3)}") if m.group(3) else 0.0
        # if looks like hours (rare for STA): treat first as minutes when < 30
        total = minutes * 60 + seconds + frac
        return total, cleaned
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*m\b", cleaned, re.I)
    if m:
        return float(m.group(1)), cleaned
    m = re.search(r"(-?\d+(?:\.\d+)?)", cleaned)
    if m:
        return float(m.group(1)), cleaned
    return None, cleaned


def parse_card(text: str) -> str:
    t = (text or "").strip().upper()
    if t.startswith("W") or t == "WHITE":
        return "WHITE"
    if t.startswith("Y") or t == "YELLOW":
        return "YELLOW"
    if t.startswith("R") or t == "RED":
        return "RED"
    return t or "UNKNOWN"


def map_cmas_discipline(ev_long: str | None, short: str | None = None) -> str | None:
    for key in (ev_long or "", short or ""):
        k = key.strip().upper()
        if k in CMAS_DISC_MAP:
            return CMAS_DISC_MAP[k]
        # fuzzy contains
        for src, dst in CMAS_DISC_MAP.items():
            if src in k and len(src) > 3:
                return dst
    return None


def portal_points(discipline: str, final_result: float | None, card: str) -> float:
    if final_result is None or card == "RED":
        return 0.0
    factor = DISCIPLINE_FACTOR.get(discipline)
    if factor is None:
        return 0.0
    pts = factor * final_result
    return max(0.0, round(pts, 4))


def slugify(name: str) -> str:
    base = normalize_name(name).replace(" ", "-")
    base = re.sub(r"-+", "-", base).strip("-")
    return base or "athlete"


COUNTRY_NAME_TO_ISO3 = {
    "france": "FRA",
    "italy": "ITA",
    "poland": "POL",
    "croatia": "CRO",
    "ukraine": "UKR",
    "china": "CHN",
    "japan": "JPN",
    "russia": "RUS",
    "russian federation": "RUS",
    "united states": "USA",
    "usa": "USA",
    "united kingdom": "GBR",
    "great britain": "GBR",
    "germany": "GER",
    "spain": "ESP",
    "brazil": "BRA",
    "canada": "CAN",
    "australia": "AUS",
    "new zealand": "NZL",
    "south korea": "KOR",
    "korea": "KOR",
    "republic of korea": "KOR",
    "sweden": "SWE",
    "norway": "NOR",
    "finland": "FIN",
    "denmark": "DEN",
    "netherlands": "NED",
    "belgium": "BEL",
    "switzerland": "SUI",
    "austria": "AUT",
    "czech republic": "CZE",
    "czechia": "CZE",
    "hungary": "HUN",
    "romania": "ROU",
    "serbia": "SRB",
    "slovenia": "SLO",
    "slovakia": "SVK",
    "greece": "GRE",
    "turkey": "TUR",
    "türkiye": "TUR",
    "egypt": "EGY",
    "south africa": "RSA",
    "mexico": "MEX",
    "colombia": "COL",
    "argentina": "ARG",
    "chile": "CHI",
    "venezuela": "VEN",
    "cuba": "CUB",
    "dominican republic": "DOM",
    "dominica": "DMA",
    "cyprus": "CYP",
    "israel": "ISR",
    "indonesia": "INA",
    "malaysia": "MAS",
    "thailand": "THA",
    "philippines": "PHI",
    "singapore": "SGP",
    "taiwan": "TPE",
    "hong kong": "HKG",
    "ireland": "IRL",
    "portugal": "POR",
    "iceland": "ISL",
    "estonia": "EST",
    "latvia": "LAT",
    "lithuania": "LTU",
    "bulgaria": "BUL",
    "moldova": "MDA",
    "republic of moldova": "MDA",
    "international": "AIN",
    "neutral": "AIN",
}


def country_to_iso3(name_or_code: str | None) -> str:
    if not name_or_code:
        return "UNK"
    s = name_or_code.strip()
    if len(s) == 3 and s.isalpha():
        # CMAS1 neutral
        if s.upper() in {"AIN", "XXX"}:
            return "AIN"
        if s.upper() == "CMAS1":
            return "AIN"
        return s.upper()
    key = normalize_name(s)
    return COUNTRY_NAME_TO_ISO3.get(key, s[:3].upper())
