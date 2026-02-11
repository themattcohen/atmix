"""
Structured logging configuration for sync operations.
"""

import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

LOG_DIR = Path(__file__).parent.parent.parent / "logs"


def setup_logging(
    name: str = "ghl_sync",
    level: int = logging.INFO,
    log_dir: Optional[Path] = None,
) -> logging.Logger:
    """
    Configure structured logging for sync operations.

    Logs to both console and rotating file.

    Args:
        name: Logger name.
        level: Logging level.
        log_dir: Directory for log files. Defaults to project logs/.

    Returns:
        Configured logger instance.
    """
    target_dir = log_dir or LOG_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Clear existing handlers to avoid duplicates
    logger.handlers = []

    # Console handler
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console_format = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(message)s", datefmt="%H:%M:%S"
    )
    console.setFormatter(console_format)
    logger.addHandler(console)

    # File handler
    log_file = target_dir / f"{name}_{datetime.now().strftime('%Y%m%d')}.log"
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(level)
    file_format = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    )
    file_handler.setFormatter(file_format)
    logger.addHandler(file_handler)

    return logger


class SyncLogger:
    """Structured sync operation logger with statistics tracking."""

    def __init__(self, entity: str, log_dir: Optional[Path] = None):
        """
        Initialize sync logger.

        Args:
            entity: Entity type being synced (e.g., 'contacts', 'opportunities').
            log_dir: Directory for log files.
        """
        self.logger = setup_logging(f"sync_{entity}", log_dir=log_dir)
        self.entity = entity
        self.stats: Dict[str, int] = {}
        self._start_time: Optional[datetime] = None
        self._reset_stats()

    def _reset_stats(self) -> None:
        """Reset statistics counters."""
        self.stats = {
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 0,
            "processed": 0,
        }

    def start_sync(self, batch_info: Optional[str] = None) -> None:
        """
        Log sync start.

        Args:
            batch_info: Optional batch information string.
        """
        self._reset_stats()
        self._start_time = datetime.now()
        msg = f"Starting {self.entity} sync"
        if batch_info:
            msg += f" - {batch_info}"
        self.logger.info(msg)

    def record_create(self, identifier: str, details: Optional[str] = None) -> None:
        """
        Log record creation.

        Args:
            identifier: Record identifier.
            details: Optional additional details.
        """
        self.stats["created"] += 1
        self.stats["processed"] += 1
        msg = f"Created: {identifier}"
        if details:
            msg += f" - {details}"
        self.logger.debug(msg)

    def record_update(self, identifier: str, details: Optional[str] = None) -> None:
        """
        Log record update.

        Args:
            identifier: Record identifier.
            details: Optional additional details.
        """
        self.stats["updated"] += 1
        self.stats["processed"] += 1
        msg = f"Updated: {identifier}"
        if details:
            msg += f" - {details}"
        self.logger.debug(msg)

    def record_skip(self, identifier: str, reason: str) -> None:
        """
        Log skipped record.

        Args:
            identifier: Record identifier.
            reason: Reason for skipping.
        """
        self.stats["skipped"] += 1
        self.stats["processed"] += 1
        self.logger.debug(f"Skipped: {identifier} - {reason}")

    def record_error(
        self, identifier: str, error: str, context: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Log error.

        Args:
            identifier: Record identifier.
            error: Error message.
            context: Optional error context.
        """
        self.stats["errors"] += 1
        self.stats["processed"] += 1
        msg = f"Error processing {identifier}: {error}"
        if context:
            msg += f" | Context: {context}"
        self.logger.error(msg)

    def log_progress(self, current: int, total: int) -> None:
        """
        Log sync progress.

        Args:
            current: Current record number.
            total: Total records to process.
        """
        percentage = (current / total * 100) if total > 0 else 0
        self.logger.info(
            f"Progress: {current}/{total} ({percentage:.1f}%) - "
            f"Created: {self.stats['created']}, "
            f"Updated: {self.stats['updated']}, "
            f"Errors: {self.stats['errors']}"
        )

    def end_sync(self, success: bool = True) -> Dict[str, Any]:
        """
        Log sync completion with summary.

        Args:
            success: Whether sync completed successfully.

        Returns:
            Statistics dictionary with duration.
        """
        duration = None
        if self._start_time:
            duration = (datetime.now() - self._start_time).total_seconds()

        status = "completed" if success else "failed"
        self.logger.info(
            f"{status.capitalize()} {self.entity} sync: "
            f"created={self.stats['created']}, "
            f"updated={self.stats['updated']}, "
            f"skipped={self.stats['skipped']}, "
            f"errors={self.stats['errors']}"
            + (f", duration={duration:.1f}s" if duration else "")
        )

        result = dict(self.stats)
        result["duration_seconds"] = duration
        result["success"] = success
        return result

    def get_stats(self) -> Dict[str, int]:
        """Get current statistics."""
        return dict(self.stats)

    def info(self, message: str) -> None:
        """Log info message."""
        self.logger.info(message)

    def warning(self, message: str) -> None:
        """Log warning message."""
        self.logger.warning(message)

    def error(self, message: str) -> None:
        """Log error message."""
        self.logger.error(message)

    def debug(self, message: str) -> None:
        """Log debug message."""
        self.logger.debug(message)


class OperationLogger:
    """Context manager for logging individual operations with timing."""

    def __init__(self, logger: logging.Logger, operation: str, identifier: str = ""):
        """
        Initialize operation logger.

        Args:
            logger: Logger instance.
            operation: Operation name.
            identifier: Optional identifier for the operation.
        """
        self.logger = logger
        self.operation = operation
        self.identifier = identifier
        self._start_time: Optional[datetime] = None

    def __enter__(self) -> "OperationLogger":
        """Start operation timing."""
        self._start_time = datetime.now()
        if self.identifier:
            self.logger.debug(f"Starting {self.operation}: {self.identifier}")
        else:
            self.logger.debug(f"Starting {self.operation}")
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        """End operation timing and log result."""
        duration = None
        if self._start_time:
            duration = (datetime.now() - self._start_time).total_seconds()

        duration_str = f" ({duration:.3f}s)" if duration else ""

        if exc_type is None:
            if self.identifier:
                self.logger.debug(
                    f"Completed {self.operation}: {self.identifier}{duration_str}"
                )
            else:
                self.logger.debug(f"Completed {self.operation}{duration_str}")
        else:
            if self.identifier:
                self.logger.error(
                    f"Failed {self.operation}: {self.identifier} - {exc_val}{duration_str}"
                )
            else:
                self.logger.error(f"Failed {self.operation} - {exc_val}{duration_str}")

        return False  # Don't suppress exceptions
