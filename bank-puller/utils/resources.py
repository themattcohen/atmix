"""Resource monitoring -- memory usage and concurrency adjustment."""
import psutil
from config import MEMORY_WARNING_THRESHOLD, MAX_CONCURRENT_BANK_WINDOWS
from utils.logger import log


def check_resources() -> str:
    """Check system resources. Returns action recommendation.

    Returns:
        "ok" -- normal operation
        "reduce_concurrency" -- high memory, reduce to 1 bank window
    """
    mem = psutil.virtual_memory()
    if mem.percent > MEMORY_WARNING_THRESHOLD:
        log.warning(f"High memory usage: {mem.percent:.0f}% -- reducing concurrency")
        return "reduce_concurrency"
    return "ok"


def get_max_windows() -> int:
    """Get recommended max concurrent bank windows based on resources."""
    if check_resources() == "reduce_concurrency":
        return 1
    return MAX_CONCURRENT_BANK_WINDOWS


def log_resource_summary():
    """Log current resource usage."""
    mem = psutil.virtual_memory()
    cpu = psutil.cpu_percent(interval=0.5)
    log.info(f"Resources -- RAM: {mem.percent:.0f}% ({mem.used // (1024**2)}MB/{mem.total // (1024**2)}MB), CPU: {cpu:.0f}%")
