"""Live sync scheduler helpers.

Prefer invoking `ingest/bin/live_sync.py` from cron or GitHub Actions.
See README.md in this package and docs/live-sync.md.
"""

from __future__ import annotations

DEFAULT_CRON = "17 */6 * * *"  # every 6 hours
DEFAULT_CMD = [
    "python3",
    "ingest/bin/live_sync.py",
    "--mode",
    "incremental",
    "--min-interval",
    "1.0",
]
