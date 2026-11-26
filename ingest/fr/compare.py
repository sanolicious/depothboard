"""Compare our canonical rankings/profiles against freediveranking.com (FR).

FR is a competitor — used only for verification, never as a data source.
Be polite: long delays, small sample, cache responses.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

from ingest.common.http import PoliteClient
from ingest.common.normalize import name_tokens_sorted, normalize_name


FR_BASE = "https://freediveranking.com"


def _parse_ranking_markdownish(text: str) -> list[dict[str, Any]]:
    """Best-effort parse of FR ranking HTML/markdown into rows."""
    rows: list[dict[str, Any]] = []
    # athlete links
    for m in re.finditer(
        r"/athlete/([A-Za-z0-9\-]+).*?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-'. ]{2,60}).*?(\d+[.,]?\d*)\s*pts",
        text,
        re.S | re.I,
    ):
        rows.append(
            {
                "slug": m.group(1),
                "name": m.group(2).strip(),
                "points": float(m.group(3).replace(",", ".")),
            }
        )
    if rows:
        return rows
    # fallback: lines with rank-like patterns
    for m in re.finditer(
        r"(?:^|\n)\s*(\d{1,3})[.)]\s+([A-ZÀ-ÿ][^\n|]{3,60}?)\s+(\d+[.,]\d+|\d+)\b",
        text,
    ):
        rows.append(
            {
                "rank": int(m.group(1)),
                "name": m.group(2).strip(),
                "points": float(m.group(3).replace(",", ".")),
            }
        )
    return rows


def fetch_fr_ranking(
    http: PoliteClient, *, women: bool = False, page: int = 1
) -> tuple[str, list[dict[str, Any]]]:
    path = "/women" if women else "/"
    url = f"{FR_BASE}{path}" + (f"?page={page}" if page > 1 else "")
    try:
        html = http.get_text(url)
    except Exception as e:  # noqa: BLE001
        return f"error:{e}", []
    if "Just a moment" in html or "cf-browser-verification" in html.lower():
        return "cloudflare_challenge", []
    if http.fetch(url).status == 403:
        return "forbidden", []
    rows = _parse_ranking_markdownish(html)
    return "ok" if rows else "empty_parse", rows


def fetch_fr_athlete(http: PoliteClient, slug: str) -> dict[str, Any]:
    url = f"{FR_BASE}/athlete/{quote(slug)}"
    try:
        html = http.get_text(url)
    except Exception as e:  # noqa: BLE001
        return {"slug": slug, "error": str(e)}
    if "Just a moment" in html:
        return {"slug": slug, "error": "cloudflare_challenge"}
    name_m = re.search(r"<h1[^>]*>([^<]+)", html) or re.search(
        r"property=\"og:title\"\s+content=\"([^\"]+)\"", html
    )
    name = name_m.group(1).strip() if name_m else slug.replace("-", " ")
    # points
    pts_m = re.search(r"(\d+[.,]\d+)\s*points", html, re.I) or re.search(
        r"World no\.\s*(\d+)", html, re.I
    )
    pbs = {}
    for disc in ["STA", "DYN", "DYNB", "DNF", "CWT", "CWTB", "CNF", "FIM"]:
        m = re.search(rf"{disc}\s*[:|]?\s*([0-9:,.]+ ?m?|[0-9]+:[0-9]{{2}})", html)
        if m:
            pbs[disc] = m.group(1)
    return {
        "slug": slug,
        "name": name,
        "name_norm": normalize_name(name),
        "pbs_text": pbs,
        "snippet_points": pts_m.group(1) if pts_m else None,
        "url": url,
    }


def match_name(a: str, b: str) -> bool:
    return name_tokens_sorted(a) == name_tokens_sorted(b) or normalize_name(
        a
    ) == normalize_name(b)


def compare(
    our_ranking_m: list[dict[str, Any]],
    our_ranking_f: list[dict[str, Any]],
    our_athletes: list[dict[str, Any]],
    fr_dir: Path,
    http: PoliteClient,
    *,
    sample_size: int = 50,
) -> dict[str, Any]:
    fr_dir.mkdir(parents=True, exist_ok=True)
    report: dict[str, Any] = {
        "fr_access": {},
        "ranking_men": {},
        "ranking_women": {},
        "profile_sample": [],
        "missing_in_ours": [],
        "missing_in_fr": [],
        "point_mismatches": [],
        "matching_issues": [],
        "mojibake": [],
    }

    status_m, fr_m = fetch_fr_ranking(http, women=False, page=1)
    time.sleep(1.2)
    status_f, fr_f = fetch_fr_ranking(http, women=True, page=1)
    report["fr_access"] = {"men": status_m, "women": status_f, "men_n": len(fr_m), "women_n": len(fr_f)}
    (fr_dir / "ranking_men_raw_status.json").write_text(
        json.dumps({"status": status_m, "rows": fr_m[:50]}, indent=2, ensure_ascii=False)
    )
    (fr_dir / "ranking_women_raw_status.json").write_text(
        json.dumps({"status": status_f, "rows": fr_f[:50]}, indent=2, ensure_ascii=False)
    )

    def side_by_side(ours: list[dict[str, Any]], fr: list[dict[str, Any]], label: str) -> dict:
        ours_top = ours[:50]
        fr_top = fr[:50]
        our_names = {name_tokens_sorted(r.get("name") or ""): r for r in ours_top}
        fr_names = {name_tokens_sorted(r.get("name") or ""): r for r in fr_top}
        missing_ours = []
        missing_fr = []
        mismatches = []
        for k, fr_row in fr_names.items():
            if k not in our_names:
                missing_ours.append(fr_row)
            else:
                op = our_names[k].get("points")
                fp = fr_row.get("points")
                if op is not None and fp is not None and abs(float(op) - float(fp)) > 0.5:
                    mismatches.append(
                        {
                            "name": fr_row.get("name"),
                            "our_points": op,
                            "fr_points": fp,
                            "delta": round(float(op) - float(fp), 2),
                        }
                    )
        for k, our_row in our_names.items():
            if k not in fr_names:
                missing_fr.append(our_row)
        return {
            "label": label,
            "our_top_n": len(ours_top),
            "fr_top_n": len(fr_top),
            "matched": len(our_names.keys() & fr_names.keys()),
            "missing_in_ours": missing_ours[:30],
            "missing_in_fr": missing_fr[:30],
            "point_mismatches": mismatches[:30],
        }

    if fr_m:
        report["ranking_men"] = side_by_side(our_ranking_m, fr_m, "men")
    if fr_f:
        report["ranking_women"] = side_by_side(our_ranking_f, fr_f, "women")

    # Profile sample from our top athletes — try FR slug guess
    sample = (our_ranking_m[: sample_size // 2] + our_ranking_f[: sample_size // 2])[
        :sample_size
    ]
    for row in sample:
        name = row.get("name") or ""
        slug = "-".join(normalize_name(name).split())
        if not slug:
            continue
        # rate limit FR harder
        time.sleep(1.5)
        info = fetch_fr_athlete(http, slug.title().replace(" ", "-") if False else slug)
        # try Title-Case slug variant commonly used by FR
        if info.get("error") or info.get("name") == slug:
            time.sleep(1.5)
            parts = name.split()
            alt = "-".join(p.capitalize() for p in parts)
            info = fetch_fr_athlete(http, alt)
        info["our_points"] = row.get("points")
        info["our_name"] = name
        report["profile_sample"].append(info)
        # mojibake detection
        blob = json.dumps(info, ensure_ascii=False)
        if re.search(r"Ã.|Â.|â€", blob):
            report["mojibake"].append({"name": name, "where": "fr_profile", "sample": blob[:200]})

    (fr_dir / "compare_report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False)
    )
    return report
