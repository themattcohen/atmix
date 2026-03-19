"""Graceful shutdown handler — catch Ctrl+C, finish current action, save state."""
from __future__ import annotations

import signal
import sys

from utils.logger import log


class GracefulShutdown:
    """Catch SIGINT, let current action complete, then stop cleanly.

    Usage::

        shutdown = GracefulShutdown()
        for job in queue:
            if shutdown.should_stop:
                break
            run_job(job)
    """

    def __init__(self) -> None:
        self._shutting_down = False
        signal.signal(signal.SIGINT, self._handler)

    def _handler(self, signum: int, frame) -> None:  # noqa: ANN001
        if self._shutting_down:
            log.warning("Force quit — state may be inconsistent.")
            sys.exit(1)
        log.info("Shutting down gracefully... (Ctrl+C again to force)")
        self._shutting_down = True

    @property
    def should_stop(self) -> bool:
        return self._shutting_down
