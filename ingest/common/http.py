"""Polite HTTP client with rate limiting, retries, and raw storage."""

from __future__ import annotations

import hashlib
import json
import random
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_UA = (
    "Mozilla/5.0 (compatible; DepthboardIngest/0.1; "
    "+https://github.com/sanolicious/depothboard; "
    "contact=ingest@depthboard.local) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


@dataclass
class FetchResult:
    url: str
    status: int
    body: bytes
    content_type: str
    sha256: str
    path: Path | None
    from_cache: bool = False


class PoliteClient:
    def __init__(
        self,
        raw_dir: Path,
        *,
        min_interval: float = 0.85,
        user_agent: str = DEFAULT_UA,
        max_retries: int = 5,
    ) -> None:
        self.raw_dir = Path(raw_dir)
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.min_interval = min_interval
        self.user_agent = user_agent
        self.max_retries = max_retries
        self._last_by_host: dict[str, float] = {}
        self.stats = {"gets": 0, "posts": 0, "cache_hits": 0, "errors": 0, "bytes": 0}

    def _host(self, url: str) -> str:
        return urllib.parse.urlparse(url).netloc

    def _wait(self, url: str) -> None:
        host = self._host(url)
        last = self._last_by_host.get(host, 0.0)
        gap = self.min_interval + random.uniform(0.05, 0.25)
        delay = last + gap - time.time()
        if delay > 0:
            time.sleep(delay)

    def _mark(self, url: str) -> None:
        self._last_by_host[self._host(url)] = time.time()

    def _cache_path(self, url: str, method: str, body: bytes | None) -> Path:
        key = hashlib.sha256()
        key.update(method.encode())
        key.update(b"\0")
        key.update(url.encode())
        if body:
            key.update(b"\0")
            key.update(body)
        digest = key.hexdigest()
        host = self._host(url).replace(":", "_")
        folder = self.raw_dir / host / digest[:2]
        folder.mkdir(parents=True, exist_ok=True)
        return folder / f"{digest}.bin"

    def _meta_path(self, path: Path) -> Path:
        return path.with_suffix(".meta.json")

    def fetch(
        self,
        url: str,
        *,
        method: str = "GET",
        data: dict[str, str] | bytes | None = None,
        headers: dict[str, str] | None = None,
        use_cache: bool = True,
        force: bool = False,
        accept: str | None = None,
    ) -> FetchResult:
        body: bytes | None
        if data is None:
            body = None
        elif isinstance(data, bytes):
            body = data
        else:
            body = urllib.parse.urlencode(data).encode()

        cache_path = self._cache_path(url, method, body)
        meta_path = self._meta_path(cache_path)
        if use_cache and not force and cache_path.exists() and meta_path.exists():
            meta = json.loads(meta_path.read_text())
            raw = cache_path.read_bytes()
            self.stats["cache_hits"] += 1
            return FetchResult(
                url=url,
                status=meta.get("status", 200),
                body=raw,
                content_type=meta.get("content_type", ""),
                sha256=meta.get("sha256", hashlib.sha256(raw).hexdigest()),
                path=cache_path,
                from_cache=True,
            )

        hdrs = {
            "User-Agent": self.user_agent,
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": accept
            or (
                "application/json"
                if "api" in url
                else "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            ),
        }
        if headers:
            hdrs.update(headers)
        if body is not None and "Content-Type" not in hdrs:
            hdrs["Content-Type"] = "application/x-www-form-urlencoded"

        last_err: Exception | None = None
        for attempt in range(self.max_retries):
            self._wait(url)
            req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    raw = resp.read()
                    status = getattr(resp, "status", 200)
                    ctype = resp.headers.get("Content-Type", "")
                self._mark(url)
                sha = hashlib.sha256(raw).hexdigest()
                cache_path.write_bytes(raw)
                meta_path.write_text(
                    json.dumps(
                        {
                            "url": url,
                            "method": method,
                            "status": status,
                            "content_type": ctype,
                            "sha256": sha,
                            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "bytes": len(raw),
                        },
                        indent=2,
                    )
                )
                self.stats["gets" if method == "GET" else "posts"] += 1
                self.stats["bytes"] += len(raw)
                return FetchResult(
                    url=url,
                    status=status,
                    body=raw,
                    content_type=ctype,
                    sha256=sha,
                    path=cache_path,
                )
            except urllib.error.HTTPError as e:
                self._mark(url)
                last_err = e
                self.stats["errors"] += 1
                if e.code in (429, 503, 502, 500):
                    sleep_for = min(60.0, (2**attempt) + random.uniform(0, 1))
                    time.sleep(sleep_for)
                    continue
                if e.code == 403 and attempt < self.max_retries - 1:
                    time.sleep(2**attempt)
                    continue
                raw = e.read() if e.fp else b""
                sha = hashlib.sha256(raw).hexdigest()
                cache_path.write_bytes(raw)
                meta_path.write_text(
                    json.dumps(
                        {
                            "url": url,
                            "method": method,
                            "status": e.code,
                            "content_type": e.headers.get("Content-Type", "") if e.headers else "",
                            "sha256": sha,
                            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                            "bytes": len(raw),
                            "error": str(e),
                        },
                        indent=2,
                    )
                )
                return FetchResult(
                    url=url,
                    status=e.code,
                    body=raw,
                    content_type="",
                    sha256=sha,
                    path=cache_path,
                )
            except Exception as e:  # noqa: BLE001
                self._mark(url)
                last_err = e
                self.stats["errors"] += 1
                time.sleep(min(30.0, (2**attempt) + random.uniform(0, 1)))
        raise RuntimeError(f"fetch failed for {url}: {last_err}")

    def get_text(self, url: str, **kwargs: Any) -> str:
        res = self.fetch(url, **kwargs)
        return res.body.decode("utf-8", errors="replace")

    def get_json(self, url: str, **kwargs: Any) -> Any:
        res = self.fetch(url, accept="application/json", **kwargs)
        return json.loads(res.body.decode("utf-8"))
