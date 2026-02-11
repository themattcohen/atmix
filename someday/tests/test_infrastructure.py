#!/usr/bin/env python3
"""
Infrastructure Test Suite
=========================
Tests for sync state persistence, rate limiting, circuit breaker, and logging.

Usage:
    pytest tests/test_infrastructure.py -v
    pytest tests/test_infrastructure.py -v -k "test_sync_state"
    pytest tests/test_infrastructure.py -v --tb=short

Author: GHL-Baserow Sync Pipeline
"""

import json
import logging
import time
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Add scripts directory to path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from utils.sync_state import SyncState
from utils.rate_limiter import (
    RateLimiter,
    CircuitBreaker,
    CircuitOpenError,
    RetryWithBackoff,
    rate_limited,
    with_circuit_breaker,
    with_retry,
)
from utils.logging_config import setup_logging, SyncLogger, OperationLogger


# =============================================================================
# FIXTURES
# =============================================================================


@pytest.fixture
def temp_state_file(tmp_path: Path) -> Path:
    """Create a temporary state file path."""
    return tmp_path / "sync_state.json"


@pytest.fixture
def sync_state(temp_state_file: Path) -> SyncState:
    """Create a SyncState instance with temp file."""
    return SyncState(state_file=temp_state_file)


@pytest.fixture
def temp_log_dir(tmp_path: Path) -> Path:
    """Create a temporary log directory."""
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    return log_dir


# =============================================================================
# SYNC STATE TESTS
# =============================================================================


class TestSyncState:
    """Tests for SyncState persistence."""

    def test_init_creates_default_state(self, sync_state: SyncState):
        """Test initialization creates default state structure."""
        assert "contacts" in sync_state.state
        assert "opportunities" in sync_state.state
        assert "newsletters" in sync_state.state
        assert "errors" in sync_state.state

    def test_init_default_values(self, sync_state: SyncState):
        """Test default values for entity state."""
        contacts = sync_state.state["contacts"]
        assert contacts["last_sync"] is None
        assert contacts["last_cursor"] is None
        assert contacts["total_synced"] == 0
        assert contacts["last_error"] is None

    def test_save_creates_file(
        self, sync_state: SyncState, temp_state_file: Path
    ):
        """Test save creates state file."""
        sync_state.save()
        assert temp_state_file.exists()

    def test_save_creates_parent_dirs(self, tmp_path: Path):
        """Test save creates parent directories if needed."""
        nested_path = tmp_path / "nested" / "deep" / "sync_state.json"
        state = SyncState(state_file=nested_path)
        state.save()
        assert nested_path.exists()

    def test_load_persisted_state(self, temp_state_file: Path):
        """Test loading persisted state from file."""
        # Create initial state
        state1 = SyncState(state_file=temp_state_file)
        state1.set_last_sync("contacts", "2024-01-15T10:30:00Z")
        state1.increment_synced("contacts", 50)

        # Load in new instance
        state2 = SyncState(state_file=temp_state_file)
        assert state2.get_last_sync("contacts") == "2024-01-15T10:30:00Z"
        assert state2.get_total_synced("contacts") == 50

    def test_set_last_sync_auto_timestamp(self, sync_state: SyncState):
        """Test set_last_sync uses current time when no timestamp provided."""
        before = datetime.utcnow().isoformat()
        sync_state.set_last_sync("contacts")
        after = datetime.utcnow().isoformat()

        last_sync = sync_state.get_last_sync("contacts")
        assert last_sync is not None
        # Verify timestamp is within expected range
        assert before[:19] <= last_sync[:19] <= after[:19]

    def test_set_last_sync_custom_timestamp(self, sync_state: SyncState):
        """Test set_last_sync with custom timestamp."""
        custom_time = "2024-06-01T12:00:00Z"
        sync_state.set_last_sync("contacts", custom_time)
        assert sync_state.get_last_sync("contacts") == custom_time

    def test_get_set_cursor(self, sync_state: SyncState):
        """Test cursor get/set operations."""
        assert sync_state.get_cursor("contacts") is None

        sync_state.set_cursor("contacts", "cursor_abc123")
        assert sync_state.get_cursor("contacts") == "cursor_abc123"

        sync_state.set_cursor("contacts", None)
        assert sync_state.get_cursor("contacts") is None

    def test_increment_synced(self, sync_state: SyncState):
        """Test increment synced count."""
        assert sync_state.get_total_synced("contacts") == 0

        sync_state.increment_synced("contacts", 10)
        assert sync_state.get_total_synced("contacts") == 10

        sync_state.increment_synced("contacts", 5)
        assert sync_state.get_total_synced("contacts") == 15

        sync_state.increment_synced("contacts")  # default 1
        assert sync_state.get_total_synced("contacts") == 16

    def test_record_error(self, sync_state: SyncState):
        """Test error recording."""
        sync_state.record_error(
            "contacts",
            "API timeout",
            context={"contact_id": "123", "attempt": 3},
        )

        assert sync_state.has_error("contacts")
        errors = sync_state.get_errors()
        assert len(errors) == 1
        assert errors[0]["entity"] == "contacts"
        assert errors[0]["error"] == "API timeout"
        assert errors[0]["context"]["contact_id"] == "123"

    def test_error_limit_100(self, sync_state: SyncState):
        """Test errors are limited to 100."""
        for i in range(150):
            sync_state.record_error("contacts", f"Error {i}")

        errors = sync_state.get_errors(limit=200)
        assert len(errors) == 100
        # Should keep most recent
        assert "Error 149" in errors[-1]["error"]

    def test_clear_error(self, sync_state: SyncState):
        """Test clearing entity error."""
        sync_state.record_error("contacts", "Test error")
        assert sync_state.has_error("contacts")

        sync_state.clear_error("contacts")
        assert not sync_state.has_error("contacts")

    def test_get_summary(self, sync_state: SyncState):
        """Test getting sync summary."""
        sync_state.set_last_sync("contacts", "2024-01-15T10:30:00Z")
        sync_state.increment_synced("contacts", 100)
        sync_state.record_error("opportunities", "Test error")

        summary = sync_state.get_summary()

        assert summary["contacts"]["last_sync"] == "2024-01-15T10:30:00Z"
        assert summary["contacts"]["total_synced"] == 100
        assert summary["contacts"]["has_error"] is False
        assert summary["opportunities"]["has_error"] is True

    def test_reset_entity(self, sync_state: SyncState):
        """Test resetting entity state."""
        sync_state.set_last_sync("contacts", "2024-01-15T10:30:00Z")
        sync_state.increment_synced("contacts", 100)
        sync_state.record_error("contacts", "Test error")

        sync_state.reset_entity("contacts")

        assert sync_state.get_last_sync("contacts") is None
        assert sync_state.get_total_synced("contacts") == 0
        assert not sync_state.has_error("contacts")

    def test_reset_all(self, sync_state: SyncState):
        """Test resetting all state."""
        sync_state.set_last_sync("contacts", "2024-01-15T10:30:00Z")
        sync_state.increment_synced("opportunities", 50)

        sync_state.reset_all()

        assert sync_state.get_last_sync("contacts") is None
        assert sync_state.get_total_synced("opportunities") == 0
        assert len(sync_state.get_errors()) == 0

    def test_new_entity_auto_creation(self, sync_state: SyncState):
        """Test operations on new entity create it automatically."""
        sync_state.set_last_sync("custom_entity", "2024-01-01T00:00:00Z")
        assert sync_state.get_last_sync("custom_entity") == "2024-01-01T00:00:00Z"

        sync_state.increment_synced("another_entity", 5)
        assert sync_state.get_total_synced("another_entity") == 5


# =============================================================================
# RATE LIMITER TESTS
# =============================================================================


class TestRateLimiter:
    """Tests for RateLimiter."""

    def test_init_calculates_interval(self):
        """Test interval calculation from requests per minute."""
        limiter = RateLimiter(requests_per_minute=60)
        assert limiter.interval == 1.0

        limiter = RateLimiter(requests_per_minute=120)
        assert limiter.interval == 0.5

    def test_first_request_no_wait(self):
        """Test first request doesn't wait."""
        limiter = RateLimiter(requests_per_minute=60)
        start = time.time()
        wait_time = limiter.wait()
        elapsed = time.time() - start

        assert elapsed < 0.1  # Should be nearly instant
        assert wait_time < 0.1

    def test_rate_limiting_enforced(self):
        """Test rate limiting is enforced between requests."""
        limiter = RateLimiter(requests_per_minute=600)  # 0.1s interval

        limiter.wait()  # First request
        start = time.time()
        limiter.wait()  # Second request should wait
        elapsed = time.time() - start

        assert elapsed >= 0.08  # Allow some tolerance

    def test_reset(self):
        """Test reset allows immediate next request."""
        limiter = RateLimiter(requests_per_minute=60)
        limiter.wait()  # First request
        limiter.reset()

        start = time.time()
        limiter.wait()  # Should be immediate after reset
        elapsed = time.time() - start

        assert elapsed < 0.1

    def test_wait_async(self):
        """Test async wait functionality."""
        import asyncio

        async def run_test():
            limiter = RateLimiter(requests_per_minute=600)
            await limiter.wait_async()

            start = time.time()
            await limiter.wait_async()
            elapsed = time.time() - start

            assert elapsed >= 0.08

        asyncio.run(run_test())


class TestRateLimitedDecorator:
    """Tests for rate_limited decorator."""

    def test_decorator_applies_rate_limit(self):
        """Test decorator applies rate limiting."""
        call_count = 0

        @rate_limited(requests_per_minute=600)
        def api_call():
            nonlocal call_count
            call_count += 1
            return call_count

        start = time.time()
        for _ in range(3):
            api_call()
        elapsed = time.time() - start

        assert call_count == 3
        assert elapsed >= 0.15  # At least 2 intervals


# =============================================================================
# CIRCUIT BREAKER TESTS
# =============================================================================


class TestCircuitBreaker:
    """Tests for CircuitBreaker."""

    def test_init_defaults(self):
        """Test default initialization."""
        breaker = CircuitBreaker()
        assert breaker.state == CircuitBreaker.CLOSED
        assert breaker.failure_threshold == 5
        assert breaker.reset_timeout == 300

    def test_success_keeps_closed(self):
        """Test successful calls keep circuit closed."""
        breaker = CircuitBreaker(failure_threshold=3)

        for _ in range(10):
            result = breaker.call(lambda: "success")
            assert result == "success"

        assert breaker.state == CircuitBreaker.CLOSED
        assert breaker.failure_count == 0

    def test_failures_open_circuit(self):
        """Test failures open the circuit."""
        breaker = CircuitBreaker(failure_threshold=3, reset_timeout=1)

        def failing_func():
            raise ValueError("API Error")

        for _ in range(3):
            with pytest.raises(ValueError):
                breaker.call(failing_func)

        assert breaker.state == CircuitBreaker.OPEN
        assert breaker.failure_count == 3

    def test_open_circuit_rejects_calls(self):
        """Test open circuit rejects calls immediately."""
        breaker = CircuitBreaker(failure_threshold=2, reset_timeout=60)

        def failing_func():
            raise ValueError("Error")

        # Open the circuit
        for _ in range(2):
            with pytest.raises(ValueError):
                breaker.call(failing_func)

        # Next call should be rejected
        with pytest.raises(CircuitOpenError) as exc_info:
            breaker.call(lambda: "test")

        assert "Circuit breaker OPEN" in str(exc_info.value)

    def test_half_open_after_timeout(self):
        """Test circuit becomes half-open after timeout."""
        breaker = CircuitBreaker(failure_threshold=2, reset_timeout=0.1)

        def failing_func():
            raise ValueError("Error")

        # Open the circuit
        for _ in range(2):
            with pytest.raises(ValueError):
                breaker.call(failing_func)

        assert breaker.state == CircuitBreaker.OPEN

        # Wait for timeout
        time.sleep(0.15)

        # Next call should be allowed (half-open)
        result = breaker.call(lambda: "recovered")
        assert result == "recovered"

    def test_half_open_success_closes_circuit(self):
        """Test successful calls in half-open state close circuit."""
        breaker = CircuitBreaker(failure_threshold=2, reset_timeout=0.1)

        def failing_func():
            raise ValueError("Error")

        # Open the circuit
        for _ in range(2):
            with pytest.raises(ValueError):
                breaker.call(failing_func)

        # Wait and make successful calls
        time.sleep(0.15)
        breaker.call(lambda: "success1")
        breaker.call(lambda: "success2")

        assert breaker.state == CircuitBreaker.CLOSED
        assert breaker.failure_count == 0

    def test_half_open_failure_reopens_circuit(self):
        """Test failure in half-open state reopens circuit."""
        breaker = CircuitBreaker(failure_threshold=2, reset_timeout=0.1)

        def failing_func():
            raise ValueError("Error")

        # Open the circuit
        for _ in range(2):
            with pytest.raises(ValueError):
                breaker.call(failing_func)

        # Wait and fail again
        time.sleep(0.15)
        with pytest.raises(ValueError):
            breaker.call(failing_func)

        assert breaker.state == CircuitBreaker.OPEN

    def test_reset(self):
        """Test manual reset."""
        breaker = CircuitBreaker(failure_threshold=2)

        def failing_func():
            raise ValueError("Error")

        # Open the circuit
        for _ in range(2):
            with pytest.raises(ValueError):
                breaker.call(failing_func)

        assert breaker.state == CircuitBreaker.OPEN

        breaker.reset()

        assert breaker.state == CircuitBreaker.CLOSED
        assert breaker.failure_count == 0

    def test_get_state(self):
        """Test getting circuit state info."""
        breaker = CircuitBreaker(failure_threshold=5, reset_timeout=300)
        state_info = breaker.get_state()

        assert state_info["state"] == CircuitBreaker.CLOSED
        assert state_info["failure_count"] == 0
        assert state_info["failure_threshold"] == 5
        assert state_info["reset_timeout"] == 300


class TestCircuitBreakerDecorator:
    """Tests for with_circuit_breaker decorator."""

    def test_decorator_applies_circuit_breaker(self):
        """Test decorator applies circuit breaker."""
        call_count = 0

        @with_circuit_breaker(failure_threshold=2, reset_timeout=1)
        def failing_api():
            nonlocal call_count
            call_count += 1
            raise ValueError("Error")

        for _ in range(2):
            with pytest.raises(ValueError):
                failing_api()

        with pytest.raises(CircuitOpenError):
            failing_api()

        assert call_count == 2  # Third call should not execute


# =============================================================================
# RETRY WITH BACKOFF TESTS
# =============================================================================


class TestRetryWithBackoff:
    """Tests for RetryWithBackoff."""

    def test_success_no_retry(self):
        """Test successful call returns immediately."""
        retry = RetryWithBackoff(max_retries=3)
        call_count = 0

        def success_func():
            nonlocal call_count
            call_count += 1
            return "success"

        result = retry.execute(success_func)

        assert result == "success"
        assert call_count == 1

    def test_retry_on_failure(self):
        """Test retry on transient failure."""
        retry = RetryWithBackoff(max_retries=3, base_delay=0.01)
        call_count = 0

        def failing_then_success():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ValueError("Transient error")
            return "success"

        result = retry.execute(failing_then_success)

        assert result == "success"
        assert call_count == 3

    def test_max_retries_exhausted(self):
        """Test exception raised when retries exhausted."""
        retry = RetryWithBackoff(max_retries=2, base_delay=0.01)

        def always_fail():
            raise ValueError("Persistent error")

        with pytest.raises(ValueError, match="Persistent error"):
            retry.execute(always_fail)

    def test_retryable_exceptions_filter(self):
        """Test only specified exceptions trigger retry."""
        retry = RetryWithBackoff(max_retries=3, base_delay=0.01)
        call_count = 0

        def non_retryable():
            nonlocal call_count
            call_count += 1
            raise TypeError("Non-retryable")

        with pytest.raises(TypeError):
            retry.execute(
                non_retryable,
                retryable_exceptions=(ValueError,),
            )

        assert call_count == 1  # No retry for non-matching exception

    def test_exponential_backoff(self):
        """Test delays increase exponentially."""
        retry = RetryWithBackoff(
            max_retries=3,
            base_delay=0.1,
            exponential_base=2.0,
        )
        call_count = 0

        def always_fail():
            nonlocal call_count
            call_count += 1
            raise ValueError("Error")

        start = time.time()
        with pytest.raises(ValueError):
            retry.execute(always_fail)
        elapsed = time.time() - start

        # Should wait: 0.1 + 0.2 + 0.4 = 0.7s minimum
        assert elapsed >= 0.6  # Allow some tolerance


class TestRetryDecorator:
    """Tests for with_retry decorator."""

    def test_decorator_applies_retry(self):
        """Test decorator applies retry logic."""
        call_count = 0

        @with_retry(max_retries=2, base_delay=0.01)
        def flaky_api():
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ValueError("Transient")
            return "success"

        result = flaky_api()

        assert result == "success"
        assert call_count == 2


# =============================================================================
# LOGGING TESTS
# =============================================================================


class TestSetupLogging:
    """Tests for setup_logging function."""

    def test_creates_logger(self, temp_log_dir: Path):
        """Test logger creation."""
        logger = setup_logging("test_logger", log_dir=temp_log_dir)

        assert logger.name == "test_logger"
        assert logger.level == logging.INFO

    def test_creates_log_file(self, temp_log_dir: Path):
        """Test log file creation."""
        logger = setup_logging("test_logger", log_dir=temp_log_dir)
        logger.info("Test message")

        log_files = list(temp_log_dir.glob("*.log"))
        assert len(log_files) == 1
        assert "test_logger" in log_files[0].name

    def test_log_file_contains_message(self, temp_log_dir: Path):
        """Test log file contains logged message."""
        logger = setup_logging("test_logger", log_dir=temp_log_dir)
        logger.info("Test message 12345")

        log_file = list(temp_log_dir.glob("*.log"))[0]
        content = log_file.read_text()
        assert "Test message 12345" in content


class TestSyncLogger:
    """Tests for SyncLogger."""

    def test_init(self, temp_log_dir: Path):
        """Test SyncLogger initialization."""
        logger = SyncLogger("contacts", log_dir=temp_log_dir)

        assert logger.entity == "contacts"
        assert logger.stats["created"] == 0
        assert logger.stats["updated"] == 0

    def test_start_sync_resets_stats(self, temp_log_dir: Path):
        """Test start_sync resets statistics."""
        logger = SyncLogger("contacts", log_dir=temp_log_dir)
        logger.stats["created"] = 10
        logger.stats["errors"] = 5

        logger.start_sync()

        assert logger.stats["created"] == 0
        assert logger.stats["errors"] == 0

    def test_record_create(self, temp_log_dir: Path):
        """Test recording creation."""
        logger = SyncLogger("contacts", log_dir=temp_log_dir)
        logger.start_sync()

        logger.record_create("contact_123")
        logger.record_create("contact_456")

        assert logger.stats["created"] == 2
        assert logger.stats["processed"] == 2

    def test_record_update(self, temp_log_dir: Path):
        """Test recording update."""
        logger = SyncLogger("contacts", log_dir=temp_log_dir)
        logger.start_sync()

        logger.record_update("contact_123")

        assert logger.stats["updated"] == 1

    def test_record_skip(self, temp_log_dir: Path):
        """Test recording skip."""
        logger = SyncLogger("contacts", log_dir=temp_log_dir)
        logger.start_sync()

        logger.record_skip("contact_123", "Duplicate")

        assert logger.stats["skipped"] == 1

    def test_record_error(self, temp_log_dir: Path):
        """Test recording error."""
        logger = SyncLogger("contacts", log_dir=temp_log_dir)
        logger.start_sync()

        logger.record_error("contact_123", "API timeout")

        assert logger.stats["errors"] == 1

    def test_end_sync_returns_stats(self, temp_log_dir: Path):
        """Test end_sync returns statistics."""
        logger = SyncLogger("contacts", log_dir=temp_log_dir)
        logger.start_sync()
        logger.record_create("c1")
        logger.record_update("c2")
        logger.record_skip("c3", "dup")
        logger.record_error("c4", "error")

        result = logger.end_sync(success=True)

        assert result["created"] == 1
        assert result["updated"] == 1
        assert result["skipped"] == 1
        assert result["errors"] == 1
        assert result["success"] is True
        assert result["duration_seconds"] is not None

    def test_log_progress(self, temp_log_dir: Path):
        """Test progress logging."""
        logger = SyncLogger("contacts", log_dir=temp_log_dir)
        logger.start_sync()
        logger.stats["created"] = 5

        # Should not raise
        logger.log_progress(5, 100)


class TestOperationLogger:
    """Tests for OperationLogger context manager."""

    def test_logs_operation_success(self, temp_log_dir: Path):
        """Test logging successful operation."""
        # Use DEBUG level since OperationLogger uses debug for success messages
        base_logger = setup_logging(
            "test_op_success", level=logging.DEBUG, log_dir=temp_log_dir
        )

        with OperationLogger(base_logger, "fetch_contacts", "batch_1"):
            time.sleep(0.01)  # Simulate work

        # Flush handlers to ensure log is written
        for handler in base_logger.handlers:
            handler.flush()

        log_file = list(temp_log_dir.glob("*test_op_success*.log"))[0]
        content = log_file.read_text()
        assert "Starting fetch_contacts" in content
        assert "Completed fetch_contacts" in content

    def test_logs_operation_failure(self, temp_log_dir: Path):
        """Test logging failed operation."""
        base_logger = setup_logging("test_op_fail", log_dir=temp_log_dir)

        with pytest.raises(ValueError):
            with OperationLogger(base_logger, "fetch_contacts", "batch_1"):
                raise ValueError("API Error")

        # Flush handlers to ensure log is written
        for handler in base_logger.handlers:
            handler.flush()

        log_file = list(temp_log_dir.glob("*test_op_fail*.log"))[0]
        content = log_file.read_text()
        assert "Failed fetch_contacts" in content
        assert "API Error" in content


# =============================================================================
# INTEGRATION TESTS
# =============================================================================


class TestIntegration:
    """Integration tests for infrastructure components."""

    def test_state_with_logging(
        self, temp_state_file: Path, temp_log_dir: Path
    ):
        """Test SyncState integrated with logging."""
        state = SyncState(state_file=temp_state_file)
        logger = SyncLogger("contacts", log_dir=temp_log_dir)

        logger.start_sync()

        # Simulate sync operation
        for i in range(5):
            if i % 2 == 0:
                logger.record_create(f"contact_{i}")
                state.increment_synced("contacts")
            else:
                logger.record_skip(f"contact_{i}", "duplicate")

        state.set_last_sync("contacts")
        stats = logger.end_sync()

        assert state.get_total_synced("contacts") == 3
        assert stats["created"] == 3
        assert stats["skipped"] == 2

    def test_rate_limiter_with_circuit_breaker(self):
        """Test combining rate limiter and circuit breaker."""
        limiter = RateLimiter(requests_per_minute=600)
        breaker = CircuitBreaker(failure_threshold=3, reset_timeout=1)
        call_count = 0

        def rate_limited_api():
            nonlocal call_count
            limiter.wait()
            call_count += 1
            if call_count <= 3:
                raise ValueError("Error")
            return "success"

        # First 3 calls fail and open circuit
        for _ in range(3):
            with pytest.raises(ValueError):
                breaker.call(rate_limited_api)

        # Circuit is now open
        with pytest.raises(CircuitOpenError):
            breaker.call(rate_limited_api)

    def test_full_sync_workflow(
        self, temp_state_file: Path, temp_log_dir: Path
    ):
        """Test complete sync workflow with all infrastructure."""
        state = SyncState(state_file=temp_state_file)
        logger = SyncLogger("contacts", log_dir=temp_log_dir)
        retry = RetryWithBackoff(max_retries=2, base_delay=0.01)

        logger.start_sync()

        mock_records = [
            {"id": "1", "name": "Contact 1"},
            {"id": "2", "name": "Contact 2"},
            {"id": "3", "name": "Contact 3"},
        ]

        for record in mock_records:
            try:
                # Simulate API call with retry
                def process():
                    return f"processed_{record['id']}"

                result = retry.execute(process)
                logger.record_create(record["id"])
                state.increment_synced("contacts")
            except Exception as e:
                logger.record_error(record["id"], str(e))
                state.record_error("contacts", str(e), {"record_id": record["id"]})

        state.set_last_sync("contacts")
        stats = logger.end_sync()

        assert state.get_total_synced("contacts") == 3
        assert stats["created"] == 3
        assert not state.has_error("contacts")


# =============================================================================
# MAIN
# =============================================================================


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
