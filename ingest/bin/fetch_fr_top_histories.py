#!/usr/bin/env python3
"""Fetch AIDA full histories for FR top-50 athletes (and search misses)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from ingest.aida.client import AIDAClient  # noqa: E402
from ingest.common.http import PoliteClient  # noqa: E402
from ingest.common.normalize import country_to_iso3, name_tokens_sorted, normalize_name  # noqa: E402


SEARCH_ALIASES = {
    "Sofía Gómez Uribe": ["Sofia Gomez", "Gomez Uribe", "Sofia Gómez"],
    "Isabel Sanchez Aran": ["Isabel Sanchez", "Sanchez Aran", "Isabel Aran"],
    "Siew Ling, Elys Lai": ["Elys Lai", "Siew Ling Lai", "Lai Siew Ling"],
    "Hyemi (Mimi) Kim": ["Hyemi Kim", "Mimi Kim"],
    "Yi(Zy) Zhang": ["Yi Zhang", "Zy Zhang"],
    "Ming (William Joy) Jin": ["Ming Jin", "William Joy Jin"],
    "Guillaume Néry": ["Guillaume Nery"],
    "Mirela Kardašević": ["Mirela Kardasevic"],
    "Agata Załęcka": ["Agata Zalecka"],
    "Jarmila Slovenčíková": ["Jarmila Slovencikova"],
}


def main() -> int:
    out = ROOT / "data" / "ingest"
    http = PoliteClient(out / "raw", min_interval=0.85)
    aida = AIDAClient(http)

    fr_m = json.loads((out / "fr/ranking_men_top50.json").read_text())
    fr_f = json.loads((out / "fr/ranking_women_top50.json").read_text())
    aida_ath = {
        name_tokens_sorted(a["name"]): a
        for a in json.loads((out / "canonical/aida_athletes.json").read_text())
    }
    # also index existing results athletes
    existing_results = json.loads((out / "canonical/aida_results.json").read_text())
    have_hist = {r["athlete_id"] for r in existing_results}

    targets: list[tuple[str, str, str | None]] = []  # name, sex, guid
    for row in fr_m + fr_f:
        name = row["name"]
        sex = row["sex"]
        k = name_tokens_sorted(name)
        ath = aida_ath.get(k)
        guid = ath["id"] if ath else None
        if not guid:
            # try aliases / search
            queries = SEARCH_ALIASES.get(name, []) + [name, " ".join(name.replace(",", " ").split()[:2])]
            for q in queries:
                try:
                    hits = aida.search_athletes(q)
                except Exception as e:  # noqa: BLE001
                    print("search fail", q, e)
                    continue
                if hits:
                    # pick best name match
                    best = None
                    best_sc = -1
                    for h in hits:
                        sc = len(set(normalize_name(h["name"]).split()) & set(normalize_name(name).split()))
                        if sc > best_sc:
                            best_sc = sc
                            best = h
                    if best and best_sc >= 1:
                        guid = best["id"]
                        print(f"search hit {name!r} <- {best['name']!r} ({guid})")
                        aida_ath[k] = {"id": guid, "name": best["name"], "sex": "M" if sex == "M" else "F", "country": ""}
                        break
        targets.append((name, sex, guid))

    new_results: list[dict] = []
    fetched = 0
    skipped = 0
    failed = []
    for name, sex, guid in targets:
        if not guid:
            failed.append({"name": name, "reason": "no_guid"})
            continue
        if guid in have_hist and sum(1 for r in existing_results if r["athlete_id"] == guid) >= 15:
            # still refresh if thin; skip only if rich
            skipped += 1
            # Actually force fetch for incomplete — check count
            n = sum(1 for r in existing_results if r["athlete_id"] == guid)
            if n >= 20:
                continue
        print(f"history {name} ({guid}) …", flush=True)
        try:
            res = aida.athlete_all_results(guid)
        except Exception as e:  # noqa: BLE001
            failed.append({"name": name, "guid": guid, "error": str(e)})
            continue
        for r in res:
            r["athlete_name"] = name
            r["sex"] = sex
            r["federation"] = "AIDA"
            r["event_id"] = r.get("event_id") or f"aida-ev-{abs(hash(r['event_name'])) % 10_000_000}"
        # drop old for this guid from existing, append new
        existing_results = [r for r in existing_results if r["athlete_id"] != guid]
        existing_results.extend(res)
        new_results.extend(res)
        fetched += 1
        have_hist.add(guid)
        # ensure athlete catalog
        if name_tokens_sorted(name) not in aida_ath:
            aida_ath[name_tokens_sorted(name)] = {
                "id": guid,
                "name": name,
                "sex": sex,
                "country": res[0].get("country") if res else "",
                "country_iso3": country_to_iso3(res[0].get("country")) if res else "UNK",
            }
        else:
            aida_ath[name_tokens_sorted(name)]["id"] = guid
            aida_ath[name_tokens_sorted(name)]["sex"] = sex

    # also update aida athletes list
    ath_list = list({a["id"]: a for a in aida_ath.values()}.values())
    for a in ath_list:
        if "country_iso3" not in a:
            a["country_iso3"] = country_to_iso3(a.get("country"))

    (out / "canonical/aida_results.json").write_text(
        json.dumps(existing_results, indent=2, ensure_ascii=False)
    )
    (out / "canonical/aida_athletes.json").write_text(
        json.dumps(ath_list, indent=2, ensure_ascii=False)
    )
    summary = {
        "fetched": fetched,
        "skipped_rich": skipped,
        "failed": failed,
        "total_aida_results": len(existing_results),
        "new_rows": len(new_results),
    }
    (out / "canonical/fr_top_history_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False)
    )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
