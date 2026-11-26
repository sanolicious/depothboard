"""AIDA International HTML/AJAX ingest."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlencode

from ingest.common.http import PoliteClient
from ingest.common.normalize import (
    AIDA_DISC_IDS,
    country_to_iso3,
    normalize_name,
    parse_card,
    parse_result_value,
    portal_points,
)


BASE = "https://www.aidainternational.org"


@dataclass
class AIDARankingRow:
    rank: int
    athlete_id: str
    name: str
    country: str
    sex: str
    result_text: str
    result_value: float | None
    announced_text: str
    points: float | None
    penalties: float | None
    date: str
    event_name: str
    event_id: str | None
    discipline: str
    year_filter: str
    record_flags: list[str] = field(default_factory=list)


def _strip_tags(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html)


@dataclass
class AIDAClient:
    http: PoliteClient

    def ranking_pages(
        self,
        discipline: str,
        gender: str,
        *,
        year: str = "",
        max_pages: int = 20,
    ) -> list[AIDARankingRow]:
        """Fetch ranking pages. gender: '0'=M, '1'=F. discipline: AIDA id or all/pool/depth."""
        disc_code = AIDA_DISC_IDS.get(discipline, discipline)
        sex = "M" if gender == "0" else "F"
        rows: list[AIDARankingRow] = []
        for page in range(1, max_pages + 1):
            params = {
                "discipline": discipline,
                "gender": gender,
                "year": year,
                "nationality": "",
                "continent": "",
            }
            if page > 1:
                params["page"] = str(page)
            url = f"{BASE}/Ranking/?{urlencode(params)}"
            html = self.http.get_text(url)
            page_rows = self._parse_ranking_table(html, disc_code, sex, year)
            if not page_rows:
                break
            rows.extend(page_rows)
            # stop if fewer than 10 (last page)
            if len(page_rows) < 10:
                break
            # detect max page
            pages = [int(x) for x in re.findall(r"[?&]page=(\d+)", html)]
            if pages and page >= max(pages):
                break
        return rows

    def _parse_ranking_table(
        self, html: str, discipline: str, sex: str, year: str
    ) -> list[AIDARankingRow]:
        out: list[AIDARankingRow] = []
        # OVERALL / POOL / DEPTH tables: #, Name, Total Points, STA, DYN, …
        is_aggregate = discipline in {"OVERALL", "POOL", "DEPTH"} or "Total Points" in html
        for m in re.finditer(r'<tr id="diver-([0-9a-fA-F-]{36})">(.*?)</tr>', html, re.S):
            ath_id = m.group(1)
            tds = re.findall(r"<td[^>]*>(.*?)</td>", m.group(2), re.S)
            if len(tds) < 3:
                continue
            rank_s = " ".join(_strip_tags(tds[0]).split()).rstrip(".")
            name_td = tds[1]
            name_m = re.search(r"<strong>([^<]+)</strong>\s*\(([^)]+)\)", name_td)
            if not name_m:
                continue
            name = name_m.group(1).strip()
            country = name_m.group(2).strip()
            try:
                rank = int(rank_s)
            except ValueError:
                continue

            if is_aggregate:
                total_text = " ".join(_strip_tags(tds[2]).split())
                try:
                    points = float(total_text.replace(",", "."))
                except ValueError:
                    points = None
                out.append(
                    AIDARankingRow(
                        rank=rank,
                        athlete_id=ath_id,
                        name=name,
                        country=country,
                        sex=sex,
                        result_text=total_text,
                        result_value=points,
                        announced_text="",
                        points=points,
                        penalties=0.0,
                        date="",
                        event_name="",
                        event_id=None,
                        discipline="",
                        year_filter=year,
                        record_flags=[],
                    )
                )
                continue

            # Single-discipline: # Name Result Announced Points Penalties Date Event
            if len(tds) < 8:
                continue
            result_td, ann_td, pts_td, pen_td, date_td, event_td = tds[2:8]
            flags = re.findall(r"<strong>\s*(WR|NR|CR)\s*</strong>", result_td)
            result_text = " ".join(_strip_tags(result_td).split())
            ann_text = " ".join(_strip_tags(ann_td).split())
            pts_text = " ".join(_strip_tags(pts_td).split())
            pen_text = " ".join(_strip_tags(pen_td).split())
            date = " ".join(_strip_tags(date_td).split())
            event_name = " ".join(_strip_tags(event_td).split())
            ev_m = re.search(r"EventResults-(\d+)|EventPage/(\d+)", event_td)
            event_id = (ev_m.group(1) or ev_m.group(2)) if ev_m else None
            rv, _ = parse_result_value(result_text)
            try:
                points = float(pts_text.replace(",", ".")) if pts_text not in {"", "-"} else None
            except ValueError:
                points = None
            try:
                penalties = float(pen_text.replace(",", ".")) if pen_text not in {"", "-"} else 0.0
            except ValueError:
                penalties = None
            out.append(
                AIDARankingRow(
                    rank=rank,
                    athlete_id=ath_id,
                    name=name,
                    country=country,
                    sex=sex,
                    result_text=result_text,
                    result_value=rv,
                    announced_text=ann_text,
                    points=points,
                    penalties=penalties,
                    date=date,
                    event_name=event_name,
                    event_id=event_id,
                    discipline=discipline,
                    year_filter=year,
                    record_flags=flags,
                )
            )
        return out

    def athlete_profile(self, guid: str) -> dict[str, Any]:
        url = f"{BASE}/Athletes/Profile-{guid}"
        html = self.http.get_text(url)
        name_m = re.search(r"<h1[^>]*>\s*([^<]+)", html) or re.search(
            r"<title>\s*([^|<]+)", html
        )
        name = name_m.group(1).strip() if name_m else guid
        country_m = re.search(
            r"(?:Nationality|Country)[^<]*</[^>]+>\s*<[^>]+>([^<]+)", html, re.I
        )
        country = country_m.group(1).strip() if country_m else ""
        return {
            "id": guid,
            "name": name,
            "country": country,
            "url": url,
            "name_norm": normalize_name(name),
        }

    def athlete_all_results(self, guid: str) -> list[dict[str, Any]]:
        url = (
            f"{BASE}/Athletes/fetch_results_html.php"
            f"?subject=all_results&diver={guid}"
        )
        html = self.http.get_text(url)
        results: list[dict[str, Any]] = []
        for m in re.finditer(r"<tr>(.*?)</tr>", html, re.S):
            row = m.group(1)
            tds = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
            if len(tds) < 9:
                continue
            # medal | event | date | disc | country | AP | RP | card | points | remarks?
            event = " ".join(_strip_tags(tds[1]).split())
            date = " ".join(_strip_tags(tds[2]).split()).replace("/", "-")
            disc = " ".join(_strip_tags(tds[3]).split()).upper()
            country = " ".join(_strip_tags(tds[4]).split())
            ap_t = " ".join(_strip_tags(tds[5]).split())
            rp_t = " ".join(_strip_tags(tds[6]).split())
            card_t = " ".join(_strip_tags(tds[7]).split())
            pts_t = " ".join(_strip_tags(tds[8]).split())
            remarks = " ".join(_strip_tags(tds[9]).split()) if len(tds) > 9 else ""
            flags = re.findall(r"\b(WR|NR|CR)\b", tds[6] + remarks)
            ap, _ = parse_result_value(ap_t)
            rp, _ = parse_result_value(rp_t)
            card = parse_card(card_t)
            try:
                points = float(pts_t.replace(",", ".")) if pts_t not in {"", "-"} else None
            except ValueError:
                points = None
            if disc not in {"STA", "DYN", "DYNB", "DNF", "CWT", "CWTB", "CNF", "FIM", "VWT", "NLT"}:
                continue
            if points is None and rp is not None:
                points = portal_points(disc, rp, card)
            results.append(
                {
                    "athlete_id": guid,
                    "event_name": event,
                    "date": date,
                    "discipline": disc,
                    "country": country,
                    "country_iso3": country_to_iso3(country),
                    "ap": ap,
                    "rp": rp,
                    "ap_text": ap_t,
                    "rp_text": rp_t,
                    "card": card,
                    "points": points,
                    "remarks": remarks,
                    "record_flags": flags,
                    "source": "AIDA_HTML",
                }
            )
        return results

    def search_athletes(self, query: str) -> list[dict[str, str]]:
        url = f"{BASE}/Athletes/fetch_athletes.php?get_searched=1&search={urllib_quote(query)}"
        # may return empty for short queries
        text = self.http.get_text(url, accept="application/json")
        if not text.strip():
            return []
        import json

        data = json.loads(text)
        return [{"id": x["id"], "name": x["text"]} for x in data.get("results", [])]

    def event_page(self, event_id: str) -> dict[str, Any]:
        url = f"{BASE}/EventPage/{event_id}"
        html = self.http.get_text(url)
        title_m = re.search(r"<title>\s*([^<]+)", html)
        title = title_m.group(1).replace("AIDA |", "").strip() if title_m else event_id
        return {
            "id": event_id,
            "name": title,
            "url": url,
            "html_sha": None,
            "source": "AIDA_HTML",
        }

    def event_ranking(
        self, event_id: str, discipline: str, gender: str
    ) -> list[dict[str, Any]]:
        url = f"{BASE}/EventRanking/{event_id}"
        html = self.http.fetch(
            url,
            method="POST",
            data={"discipline": discipline, "gender": gender},
            headers={"Referer": f"{BASE}/EventPage/{event_id}"},
        ).body.decode("utf-8", "replace")
        rows: list[dict[str, Any]] = []
        for m in re.finditer(
            r'Profile-([0-9a-fA-F-]{36})[^>]*>\s*(?:<strong>)?([^<]+)',
            html,
        ):
            rows.append(
                {
                    "athlete_id": m.group(1),
                    "name": m.group(2).strip(),
                    "event_id": event_id,
                    "discipline": discipline,
                    "gender": gender,
                }
            )
        # richer parse if table present
        for m in re.finditer(r"<tr[^>]*>(.*?)</tr>", html, re.S):
            tds = re.findall(r"<td[^>]*>(.*?)</td>", m.group(1), re.S)
            if len(tds) < 4:
                continue
            guid_m = re.search(r"Profile-([0-9a-fA-F-]{36})", m.group(1))
            if not guid_m:
                continue
            texts = [" ".join(_strip_tags(td).split()) for td in tds]
            rows.append(
                {
                    "athlete_id": guid_m.group(1),
                    "cells": texts,
                    "event_id": event_id,
                    "discipline": discipline,
                    "gender": "M" if gender in {"0", "M"} else "F",
                    "source": "AIDA_EventRanking",
                }
            )
        return rows


def urllib_quote(s: str) -> str:
    from urllib.parse import quote

    return quote(s)
