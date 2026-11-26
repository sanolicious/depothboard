"""Entity resolution across AIDA and CMAS athletes."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ingest.common.normalize import name_tokens_sorted, normalize_name, slugify


@dataclass
class Person:
    id: str
    name: str
    sex: str
    country: str
    aliases: list[str] = field(default_factory=list)
    identifiers: list[dict[str, str]] = field(default_factory=list)
    birth_year: int | None = None
    source_names: list[str] = field(default_factory=list)

    @property
    def slug(self) -> str:
        return slugify(self.name)


@dataclass
class MergeConflict:
    left: dict[str, Any]
    right: dict[str, Any]
    score: float
    reason: str


def _token_similarity(a: str, b: str) -> float:
    ta = set(normalize_name(a).split())
    tb = set(normalize_name(b).split())
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    return inter / max(len(ta), len(tb))


def score_pair(a: dict[str, Any], b: dict[str, Any]) -> float:
    """Heuristic confidence in [0,1]."""
    if a.get("sex") and b.get("sex") and a["sex"] != b["sex"]:
        return 0.0
    na = name_tokens_sorted(a.get("name") or "")
    nb = name_tokens_sorted(b.get("name") or "")
    if not na or not nb:
        return 0.0
    score = 0.0
    exact_name = na == nb
    if exact_name:
        # Exact normalized token-sort match is a strong signal across federations.
        score += 0.80
    else:
        sim = _token_similarity(a.get("name") or "", b.get("name") or "")
        score += 0.35 * sim
        # partial family match
        if na.split() and nb.split() and na.split()[-1] == nb.split()[-1]:
            score += 0.1
    ca = (a.get("country") or "").upper()
    cb = (b.get("country") or "").upper()
    if ca and cb:
        if ca == cb or {ca, cb} <= {"AIN", "RUS", "CMAS1"} or (
            ca in {"AIN", "XXX"} or cb in {"AIN", "XXX"}
        ):
            score += 0.15
        else:
            score -= 0.05
    ya, yb = a.get("birth_year"), b.get("birth_year")
    if ya and yb:
        if abs(int(ya) - int(yb)) == 0:
            score += 0.2
        elif abs(int(ya) - int(yb)) == 1:
            score += 0.1
        else:
            return min(score, 0.4)
    # Exact name + same sex + compatible country → auto-link territory
    if exact_name and a.get("sex") and b.get("sex") and a.get("sex") == b.get("sex"):
        score = max(score, 0.96)
    return max(0.0, min(1.0, score))


class EntityResolver:
    def __init__(self) -> None:
        self.persons: list[Person] = []
        self.by_aida: dict[str, str] = {}
        self.by_cmas_hmac: dict[str, str] = {}
        self.conflicts: list[MergeConflict] = []
        self._seq = 0

    def _new_id(self) -> str:
        self._seq += 1
        return f"p{self._seq:05d}"

    def add_aida(self, athlete: dict[str, Any]) -> Person:
        guid = athlete["id"]
        if guid in self.by_aida:
            pid = self.by_aida[guid]
            person = next(p for p in self.persons if p.id == pid)
            return person
        person = Person(
            id=self._new_id(),
            name=athlete["name"],
            sex=athlete.get("sex") or "M",
            country=athlete.get("country_iso3")
            or athlete.get("country")
            or "UNK",
            identifiers=[{"source": "AIDA", "external_id": guid, "type": "HARD"}],
            source_names=[athlete["name"]],
        )
        self.persons.append(person)
        self.by_aida[guid] = person.id
        return person

    def add_cmas(self, athlete: dict[str, Any]) -> Person:
        hmac_id = athlete.get("accred_hmac") or athlete["id"]
        if hmac_id in self.by_cmas_hmac:
            return next(p for p in self.persons if p.id == self.by_cmas_hmac[hmac_id])

        # try match to existing AIDA person
        best: tuple[float, Person | None] = (0.0, None)
        for p in self.persons:
            sc = score_pair(
                {
                    "name": athlete["name"],
                    "sex": athlete.get("sex"),
                    "country": athlete.get("country"),
                    "birth_year": athlete.get("birth_year"),
                },
                {
                    "name": p.name,
                    "sex": p.sex,
                    "country": p.country,
                    "birth_year": p.birth_year,
                },
            )
            if sc > best[0]:
                best = (sc, p)

        if best[1] and best[0] >= 0.95:
            person = best[1]
            person.identifiers.append(
                {"source": "CMAS", "external_id": hmac_id, "type": "HARD"}
            )
            if athlete["name"] not in person.source_names:
                person.aliases.append(athlete["name"])
                person.source_names.append(athlete["name"])
            self.by_cmas_hmac[hmac_id] = person.id
            return person

        if best[1] and 0.70 <= best[0] < 0.95:
            self.conflicts.append(
                MergeConflict(
                    left={
                        "id": best[1].id,
                        "name": best[1].name,
                        "sex": best[1].sex,
                        "country": best[1].country,
                    },
                    right=athlete,
                    score=best[0],
                    reason="cross_federation_name_match",
                )
            )

        person = Person(
            id=self._new_id(),
            name=athlete["name"],
            sex=athlete.get("sex") or "M",
            country=athlete.get("country") or "UNK",
            birth_year=athlete.get("birth_year"),
            identifiers=[
                {"source": "CMAS", "external_id": hmac_id, "type": "HARD"}
            ],
            aliases=list(athlete.get("aliases") or []),
            source_names=[athlete["name"]],
        )
        self.persons.append(person)
        self.by_cmas_hmac[hmac_id] = person.id
        return person

    def to_json(self) -> dict[str, Any]:
        return {
            "persons": [
                {
                    "id": p.id,
                    "slug": p.slug,
                    "name": p.name,
                    "sex": p.sex,
                    "country": p.country,
                    "birth_year": p.birth_year,
                    "aliases": p.aliases,
                    "identifiers": p.identifiers,
                }
                for p in self.persons
            ],
            "conflicts": [
                {
                    "left": c.left,
                    "right": {
                        k: v
                        for k, v in c.right.items()
                        if k != "accred_hmac" or True  # hmac ok to keep
                    },
                    "score": c.score,
                    "reason": c.reason,
                }
                for c in self.conflicts
            ],
        }
