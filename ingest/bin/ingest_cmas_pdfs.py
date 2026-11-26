#!/usr/bin/env python3
"""Download-already-present CMAS PDFs → parsed attempts JSON."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from ingest.cmas.pdf_parse import attempts_to_dicts, parse_pdf  # noqa: E402
from ingest.common.normalize import name_tokens_sorted, normalize_name  # noqa: E402


def main() -> int:
    raw = ROOT / "data" / "ingest" / "cmas_pdf" / "raw"
    out_dir = ROOT / "data" / "ingest" / "canonical"
    out_dir.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(raw.rglob("*.pdf"))
    # skip tiny HTML masquerading as pdf and duplicates
    pdfs = [p for p in pdfs if p.stat().st_size > 50_000]
    # prefer unique content by size+name stem
    seen_size: set[int] = set()
    unique: list[Path] = []
    for p in pdfs:
        # skip obvious duplicates of belgrade
        if "sportalsub" in p.name:
            continue
        if "belgrade-indoor-senior" in p.name and (raw / "14th-cmas-world-indoor-championship-2024-belgrade.pdf").exists():
            continue
        key = p.stat().st_size
        # allow same size from different events; only skip exact name dupes
        unique.append(p)

    all_attempts = []
    per_file = {}
    for p in unique:
        print(f"parse {p.relative_to(raw)} …", flush=True)
        atts = parse_pdf(p)
        per_file[p.name] = len(atts)
        all_attempts.extend(atts)
        print(f"  -> {len(atts)}")

    rows = attempts_to_dicts(all_attempts)
    # dedupe identical athlete/disc/rp/date
    dedup = {}
    for r in rows:
        k = (
            name_tokens_sorted(r["athlete_name"]),
            r["discipline"],
            round(float(r["rp"]), 2),
            r.get("date"),
            r.get("card"),
        )
        prev = dedup.get(k)
        if not prev or float(r["points"]) >= float(prev["points"]):
            dedup[k] = r
    rows = list(dedup.values())

    (out_dir / "cmas_pdf_attempts.json").write_text(
        json.dumps(rows, indent=2, ensure_ascii=False)
    )
    summary = {
        "pdfs_parsed": len(unique),
        "raw_attempts": len(all_attempts),
        "deduped": len(rows),
        "per_file": per_file,
        "by_disc": {},
        "sample_targets": {},
    }
    from collections import Counter

    summary["by_disc"] = dict(Counter(r["discipline"] for r in rows))
    targets = [
        "Alessia Zecchini",
        "Alexey Molchanov",
        "Samo Jeranko",
        "Guillaume Bourdila",
        "Mirela Kardasevic",
        "Boris Milosic",
        "Isabel Sanchez",
        "Carol Carrasco",
        "Mateusz Malina",
    ]
    for t in targets:
        hits = [
            r
            for r in rows
            if name_tokens_sorted(r["athlete_name"]) == name_tokens_sorted(t)
            or set(normalize_name(t).split()) <= set(normalize_name(r["athlete_name"]).split())
            or set(normalize_name(r["athlete_name"]).split()) <= set(normalize_name(t).split())
        ]
        best = {}
        for r in hits:
            if r["card"] == "RED":
                continue
            d = r["discipline"]
            best[d] = max(best.get(d, 0), float(r["points"]))
        summary["sample_targets"][t] = {"n": len(hits), "best_pts": best, "total": round(sum(best.values()), 2)}

    (out_dir / "cmas_pdf_summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    print(json.dumps({k: summary[k] for k in ("pdfs_parsed", "raw_attempts", "deduped", "by_disc", "sample_targets")}, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
