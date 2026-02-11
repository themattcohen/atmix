"""
Rate limiting for API calls to prevent throttling.
"""

import time
import asyncio
from typing import Callable, Any, TypeVar, Optional
from functools import wraps

T = TypeVar("T")


class RateLimiter:
    """Token bucket rate limiter for API calls."""

    def __init__(self, requests_per_minute: int = 60):
        """
        Initialize rate limiter.

        Args:
            requests_per_minute: Maximum requests allowed per minute.
        """
        self.requests_per_minute = requests_per_minute
        self.interval = 60.0 / requests_per_minute
        self.last_request = 0.0

    def wait(self) -> float:
        """
        Block until rate limit allows next request.

        Returns:
            Time waited in seconds.
        """
        elapsed = time.time() - self.last_request
        wait_time = 0.0
        if elapsed < self.interval:
            wait_time = self.interval - elapsed
            time.sleep(wait_time)
        self.last_request = time.time()
        return wait_time

    async def wait_async(self) -> float:
        """
        Async version of wait.

        Returns:
            Time waited in seconds.
        """
        elapsed = time.time() - self.last_request
        wait_time = 0.0
        if elapsed < self.interval:
            wait_time = self.interval - elapsed
            await asyncio.sleep(wait_time)
        self.last_request = time.time()
        return wait_time

    def reset(self) -> None:
        """Reset the rate limiter state."""
        self.last_request = 0.0


class CircuitBreaker:
    """
    Circuit breaker pattern for fault tolerance.

    States:
        CLOSED: Normal operation, requests pass through
        OPEN: Circuit tripped, requests fail fast
        HALF_OPEN: Testing if service recovered
    """

    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 300):
        """
        Initialize circuit breaker.

        Args:
            failure_threshold: Number of failures before opening circuit.
            reset_timeout: Seconds before attempting to close circuit.
        """
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failure_count = 0
        self.last_failure_time: float = 0.0
        self.state = self.CLOSED
        self.success_count = 0

    def call(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """
        Execute function with circuit breaker protection.

        Args:
            func: Function to execute.
            *args: Positional arguments for function.
            **kwargs: Keyword arguments for function.

        Returns:
            Function result if successful.

        Raises:
            CircuitOpenError: If circuit is open and not ready for retry.
            Exception: Original exception from function.
        """
        if self.state == self.OPEN:
            if time.time() - self.last_failure_time > self.reset_timeout:
                self.state = self.HALF_OPEN
                self.success_count = 0
            else:
                remaining = self.reset_timeout - (time.time() - self.last_failure_time)
                raise CircuitOpenError(
                    f"Circuit breaker OPEN. Retry after {remaining:.0f}s"
                )

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    async def call_async(
        self, func: Callable[..., Any], *args: Any, **kwargs: Any
    ) -> Any:
        """
        Async version of call.

        Args:
            func: Async function to execute.
            *args: Positional arguments for function.
            **kwargs: Keyword arguments for function.

        Returns:
            Function result if successful.

        Raises:
            CircuitOpenError: If circuit is open and not ready for retry.
            Exception: Original exception from function.
        """
        if self.state == self.OPEN:
            if time.time() - self.last_failure_time > self.reset_timeout:
                self.state = self.HALF_OPEN
                self.success_count = 0
            else:
                remaining = self.reset_timeout - (time.time() - self.last_failure_time)
                raise CircuitOpenError(
                    f"Circuit breaker OPEN. Retry after {remaining:.0f}s"
                )

        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self) -> None:
        """Handle successful call."""
        if self.state == self.HALF_OPEN:
            self.success_count += 1
            # Require multiple successes before fully closing
            if self.success_count >= 2:
                self.failure_count = 0
                self.state = self.CLOSED
        else:
            self.failure_count = 0
            self.state = self.CLOSED

    def _on_failure(self) -> None:
        """Handle failed call."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = self.OPEN

    def reset(self) -> None:
        """Reset circuit breaker to closed state."""
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = 0.0
        self.state = self.CLOSED

    def get_state(self) -> dict:
        """Get current circuit breaker state."""
        return {
            "state": self.state,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
            "last_failure_time": self.last_failure_time,
            "reset_timeout": self.reset_timeout,
        }


class CircuitOpenError(Exception):
    """Raised when circuit breaker is open and request cannot proceed."""

    pass


class RetryWithBackoff:
    """Retry handler with exponential backoff."""

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
    ):
        """
        Initialize retry handler.

        Args:
            max_retries: Maximum number of retry attempts.
            base_delay: Initial delay between retries in seconds.
            max_delay: Maximum delay between retries in seconds.
            exponential_base: Base for exponential backoff calculation.
        """
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base

    def execute(
        self,
        func: Callable[..., T],
        *args: Any,
        retryable_exceptions: tuple = (Exception,),
        **kwargs: Any,
    ) -> T:
        """
        Execute function with retry logic.

        Args:
            func: Function to execute.
            *args: Positional arguments for function.
            retryable_exceptions: Exception types that should trigger retry.
            **kwargs: Keyword arguments for function.

        Returns:
            Function result if successful.

        Raises:
            Exception: Last exception if all retries exhausted.
        """
        last_exception: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            try:
                return func(*args, **kwargs)
            except retryable_exceptions as e:
                last_exception = e
                if attempt < self.max_retries:
                    delay = min(
                        self.base_delay * (self.exponential_base**attempt),
                        self.max_delay,
                    )
                    time.sleep(delay)
                else:
                    raise

        # Should not reach here, but satisfy type checker
        raise last_exception  # type: ignore

    async def execute_async(
        self,
        func: Callable[..., Any],
        *args: Any,
        retryable_exceptions: tuple = (Exception,),
        **kwargs: Any,
    ) -> Any:
        """Async version of execute."""
        last_exception: Optional[Exception] = None

        for attempt in range(self.max_retries + 1):
            try:
                return await func(*args, **kwargs)
            except retryable_exceptions as e:
                last_exception = e
                if attempt < self.max_retries:
                    delay = min(
                        self.base_delay * (self.exponential_base**attempt),
                        self.max_delay,
                    )
                    await asyncio.sleep(delay)
                else:
                    raise

        raise last_exception  # type: ignore


# Convenience decorators
def rate_limited(requests_per_minute: int = 60) -> Callable:
    """
    Decorator to rate limit a function.

    Args:
        requests_per_minute: Maximum requests allowed per minute.

    Returns:
        Decorated function.
    """
    limiter = RateLimiter(requests_per_minute)

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            limiter.wait()
            return func(*args, **kwargs)

        return wrapper

    return decorator


def with_circuit_breaker(
    failure_threshold: int = 5, reset_timeout: int = 300
) -> Callable:
    """
    Decorator to add circuit breaker to a function.

    Args:
        failure_threshold: Number of failures before opening circuit.
        reset_timeout: Seconds before attempting to close circuit.

    Returns:
        Decorated function.
    """
    breaker = CircuitBreaker(failure_threshold, reset_timeout)

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            return breaker.call(func, *args, **kwargs)

        # Expose breaker for testing/monitoring
        wrapper.circuit_breaker = breaker  # type: ignore

        return wrapper

    return decorator


def with_retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    retryable_exceptions: tuple = (Exception,),
) -> Callable:
    """
    Decorator to add retry logic with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts.
        base_delay: Initial delay between retries in seconds.
        max_delay: Maximum delay between retries in seconds.
        retryable_exceptions: Exception types that should trigger retry.

    Returns:
        Decorated function.
    """
    retry = RetryWithBackoff(max_retries, base_delay, max_delay)

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            return retry.execute(
                func, *args, retryable_exceptions=retryable_exceptions, **kwargs
            )

        return wrapper

    return decorator
