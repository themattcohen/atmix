#!/usr/bin/env python3
"""
Pipeline Orchestrator for Data Centralization.

Coordinates the entire data centralization pipeline including extraction,
normalization, chunking, and validation stages. Provides checkpoint/resume
capability and comprehensive execution reporting.

Usage:
    python pipeline.py --stage extract|normalize|chunk|validate|all
    python pipeline.py --stage all --sources youtube,blog,podcast --parallel
    python pipeline.py --stage normalize --skip-blocked --dry-run

Stages:
    extract   - Run extraction for specified sources
    normalize - Transform raw data to unified schema
    chunk     - Create RAG chunks from normalized documents
    validate  - Validate documents and generate reports
    all       - Run full pipeline (extract -> normalize -> chunk -> validate)

Version: 1.0.0
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import logging
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Optional

# Configure logging with timestamps and structured format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("pipeline")


# =============================================================================
# CONFIGURATION
# =============================================================================


class PipelineStage(Enum):
    """Pipeline execution stages."""

    EXTRACT = "extract"
    NORMALIZE = "normalize"
    CHUNK = "chunk"
    VALIDATE = "validate"
    ALL = "all"


# Default blocked sources that require user action
BLOCKED_SOURCES = frozenset({"linkedin", "book", "deal_academy"})

# All valid source types
VALID_SOURCES = frozenset(
    {"youtube", "blog", "podcast", "book", "linkedin", "deal_academy", "media"}
)

# Default paths
DEFAULT_STATE_FILE = Path("data/state/extraction_state.json")
DEFAULT_RAW_DIR = Path("data/raw")
DEFAULT_NORMALIZED_DIR = Path("data/normalized/documents")
DEFAULT_CHUNKS_DIR = Path("data/rag/chunks")
DEFAULT_REPORTS_DIR = Path("reports")

# Script paths relative to project root
SCRIPTS_DIR = Path("scripts")


@dataclass
class PipelineConfig:
    """Configuration for pipeline execution."""

    stage: PipelineStage
    sources: list[str]
    skip_blocked: bool = True
    parallel: bool = False
    dry_run: bool = False
    max_workers: int = 4
    state_file: Path = DEFAULT_STATE_FILE
    raw_dir: Path = DEFAULT_RAW_DIR
    normalized_dir: Path = DEFAULT_NORMALIZED_DIR
    chunks_dir: Path = DEFAULT_CHUNKS_DIR
    reports_dir: Path = DEFAULT_REPORTS_DIR
    verbose: bool = False

    def __post_init__(self) -> None:
        """Validate and normalize configuration."""
        # Filter out blocked sources if requested
        if self.skip_blocked:
            self.sources = [s for s in self.sources if s not in BLOCKED_SOURCES]

        # Validate sources
        invalid = set(self.sources) - VALID_SOURCES
        if invalid:
            raise ValueError(f"Invalid sources: {', '.join(invalid)}")


@dataclass
class StageResult:
    """Result from executing a single pipeline stage."""

    stage: str
    success: bool
    started_at: str
    completed_at: str
    duration_seconds: float
    items_processed: int = 0
    items_failed: int = 0
    errors: list[str] = field(default_factory=list)
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "stage": self.stage,
            "success": self.success,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_seconds": round(self.duration_seconds, 2),
            "items_processed": self.items_processed,
            "items_failed": self.items_failed,
            "errors": self.errors,
            "details": self.details,
        }


@dataclass
class PipelineReport:
    """Complete pipeline execution report."""

    started_at: str
    completed_at: str = ""
    total_duration_seconds: float = 0.0
    stages_executed: list[StageResult] = field(default_factory=list)
    overall_success: bool = True
    config_used: dict[str, Any] = field(default_factory=dict)
    checkpoint: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "summary": {
                "started_at": self.started_at,
                "completed_at": self.completed_at,
                "total_duration_seconds": round(self.total_duration_seconds, 2),
                "overall_success": self.overall_success,
                "stages_completed": sum(
                    1 for s in self.stages_executed if s.success
                ),
                "stages_failed": sum(
                    1 for s in self.stages_executed if not s.success
                ),
            },
            "stages": [s.to_dict() for s in self.stages_executed],
            "config_used": self.config_used,
            "checkpoint": self.checkpoint,
        }


# =============================================================================
# STATE MANAGEMENT
# =============================================================================


class StateManager:
    """Manages pipeline state and checkpointing."""

    def __init__(self, state_file: Path):
        self.state_file = state_file
        self._state: dict[str, Any] = {}
        self._load_state()

    def _load_state(self) -> None:
        """Load state from file."""
        if self.state_file.exists():
            try:
                with open(self.state_file, "r", encoding="utf-8") as f:
                    self._state = json.load(f)
                logger.debug(f"Loaded state from {self.state_file}")
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Failed to load state file: {e}")
                self._state = {}
        else:
            self._state = {}

    def save_state(self) -> None:
        """Save current state to file."""
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(self._state, f, indent=2, ensure_ascii=False)
        logger.debug(f"Saved state to {self.state_file}")

    def get_source_status(self, source: str) -> dict[str, Any]:
        """Get status for a specific source."""
        sources = self._state.get("sources", {})
        return sources.get(source, {})

    def update_source_status(
        self,
        source: str,
        status: str,
        **kwargs: Any,
    ) -> None:
        """Update status for a specific source."""
        if "sources" not in self._state:
            self._state["sources"] = {}
        if source not in self._state["sources"]:
            self._state["sources"][source] = {}

        self._state["sources"][source]["status"] = status
        self._state["sources"][source]["last_updated"] = (
            datetime.now(timezone.utc).isoformat()
        )

        for key, value in kwargs.items():
            self._state["sources"][source][key] = value

    def update_pipeline_status(self, **kwargs: Any) -> None:
        """Update overall pipeline status."""
        if "pipeline" not in self._state:
            self._state["pipeline"] = {}

        for key, value in kwargs.items():
            self._state["pipeline"][key] = value

    def get_last_checkpoint(self) -> Optional[str]:
        """Get the last completed stage for resume capability."""
        return self._state.get("pipeline", {}).get("last_checkpoint")

    def set_checkpoint(self, stage: str) -> None:
        """Set a checkpoint at the given stage."""
        self.update_pipeline_status(
            last_checkpoint=stage,
            checkpoint_at=datetime.now(timezone.utc).isoformat(),
        )
        self.save_state()

    def clear_checkpoint(self) -> None:
        """Clear the checkpoint after successful completion."""
        if "pipeline" in self._state:
            self._state["pipeline"].pop("last_checkpoint", None)
            self._state["pipeline"].pop("checkpoint_at", None)
        self.save_state()

    def get_active_sources(self, skip_blocked: bool = True) -> list[str]:
        """Get list of sources that are not blocked."""
        sources = self._state.get("sources", {})
        active = []

        for source, info in sources.items():
            status = info.get("status", "pending")
            if skip_blocked and status == "blocked":
                continue
            active.append(source)

        return active

    @property
    def state(self) -> dict[str, Any]:
        """Get the full state dictionary."""
        return self._state


# =============================================================================
# PROGRESS INDICATOR
# =============================================================================


class ProgressIndicator:
    """Simple progress indicator for long operations."""

    def __init__(self, total: int, description: str = "Processing"):
        self.total = total
        self.current = 0
        self.description = description
        self.start_time = time.time()

    def update(self, increment: int = 1) -> None:
        """Update progress and print status."""
        self.current += increment
        elapsed = time.time() - self.start_time
        rate = self.current / elapsed if elapsed > 0 else 0
        eta = (self.total - self.current) / rate if rate > 0 else 0

        # Print progress line
        percent = (self.current / self.total * 100) if self.total > 0 else 100
        bar_width = 30
        filled = int(bar_width * self.current // self.total) if self.total > 0 else bar_width
        bar = "=" * filled + "-" * (bar_width - filled)

        sys.stdout.write(
            f"\r{self.description}: [{bar}] {percent:.1f}% "
            f"({self.current}/{self.total}) ETA: {eta:.0f}s"
        )
        sys.stdout.flush()

    def complete(self) -> None:
        """Mark progress as complete."""
        elapsed = time.time() - self.start_time
        print(f"\n{self.description}: Completed in {elapsed:.1f}s")


# =============================================================================
# STAGE EXECUTORS
# =============================================================================


def get_project_root() -> Path:
    """Get the project root directory."""
    # Navigate from scripts/orchestrate/ to project root
    current_file = Path(__file__).resolve()
    return current_file.parent.parent.parent


def run_extraction(
    config: PipelineConfig,
    state_manager: StateManager,
) -> StageResult:
    """
    Execute the extraction stage.

    Note: Extraction is typically handled by source-specific extractors.
    This stage coordinates their execution and updates state.
    """
    start_time = datetime.now(timezone.utc)
    result = StageResult(
        stage="extract",
        success=True,
        started_at=start_time.isoformat(),
        completed_at="",
        duration_seconds=0.0,
    )

    logger.info(f"Starting extraction for sources: {config.sources}")

    if config.dry_run:
        logger.info("[DRY RUN] Would extract from sources: %s", config.sources)
        result.details["dry_run"] = True
        result.completed_at = datetime.now(timezone.utc).isoformat()
        result.duration_seconds = (
            datetime.now(timezone.utc) - start_time
        ).total_seconds()
        return result

    items_processed = 0
    items_failed = 0

    for source in config.sources:
        source_status = state_manager.get_source_status(source)

        if source_status.get("status") == "blocked":
            logger.warning(
                f"Skipping blocked source: {source} - "
                f"{source_status.get('blocked_reason', 'No reason specified')}"
            )
            continue

        logger.info(f"Extracting from source: {source}")

        # For now, extraction is a placeholder since actual extractors
        # are source-specific scripts that need to be run separately
        # This updates the state to track what was processed

        pending = source_status.get("pending_items", 0)
        if pending > 0:
            # Simulate extraction tracking (actual extraction would happen here)
            state_manager.update_source_status(
                source,
                status="active",
                last_extraction=datetime.now(timezone.utc).isoformat(),
            )
            items_processed += pending
            result.details[source] = {"items_extracted": pending}
        else:
            result.details[source] = {"status": "no_pending_items"}

    result.items_processed = items_processed
    result.items_failed = items_failed
    result.completed_at = datetime.now(timezone.utc).isoformat()
    result.duration_seconds = (
        datetime.now(timezone.utc) - start_time
    ).total_seconds()

    state_manager.update_pipeline_status(
        last_extraction=result.completed_at,
    )

    return result


def run_normalization(
    config: PipelineConfig,
    state_manager: StateManager,
) -> StageResult:
    """
    Execute the normalization stage.

    Imports and runs the normalizer module to transform raw data.
    """
    start_time = datetime.now(timezone.utc)
    result = StageResult(
        stage="normalize",
        success=True,
        started_at=start_time.isoformat(),
        completed_at="",
        duration_seconds=0.0,
    )

    logger.info(f"Starting normalization for sources: {config.sources}")

    if config.dry_run:
        logger.info("[DRY RUN] Would normalize sources: %s", config.sources)
        result.details["dry_run"] = True
        result.completed_at = datetime.now(timezone.utc).isoformat()
        result.duration_seconds = (
            datetime.now(timezone.utc) - start_time
        ).total_seconds()
        return result

    # Import normalizer module
    project_root = get_project_root()
    normalizer_path = project_root / "scripts" / "transform" / "normalizer.py"

    if not normalizer_path.exists():
        result.success = False
        result.errors.append(f"Normalizer script not found: {normalizer_path}")
        result.completed_at = datetime.now(timezone.utc).isoformat()
        result.duration_seconds = (
            datetime.now(timezone.utc) - start_time
        ).total_seconds()
        return result

    # Add scripts directory to path for imports
    sys.path.insert(0, str(project_root / "scripts" / "transform"))

    try:
        # Import the normalizer module
        import importlib.util

        spec = importlib.util.spec_from_file_location("normalizer", normalizer_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load normalizer from {normalizer_path}")

        normalizer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(normalizer)

        total_processed = 0
        total_failed = 0

        def process_source(source: str) -> dict[str, Any]:
            """Process a single source for normalization."""
            source_raw_dir = config.raw_dir / source
            if not source_raw_dir.exists():
                logger.warning(f"Raw directory not found for {source}: {source_raw_dir}")
                return {"source": source, "status": "skipped", "reason": "no_raw_dir"}

            logger.info(f"Normalizing source: {source}")

            stats = normalizer.process_source(
                source=source,
                input_dir=source_raw_dir,
                output_dir=config.normalized_dir,
                dry_run=False,
            )

            return {
                "source": source,
                "files_processed": stats.get("files_processed", 0),
                "files_failed": stats.get("files_failed", 0),
                "errors": stats.get("errors", []),
            }

        if config.parallel and len(config.sources) > 1:
            # Parallel execution
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=config.max_workers
            ) as executor:
                future_to_source = {
                    executor.submit(process_source, source): source
                    for source in config.sources
                }

                for future in concurrent.futures.as_completed(future_to_source):
                    source = future_to_source[future]
                    try:
                        source_result = future.result()
                        result.details[source] = source_result
                        total_processed += source_result.get("files_processed", 0)
                        total_failed += source_result.get("files_failed", 0)
                    except Exception as e:
                        logger.error(f"Error normalizing {source}: {e}")
                        result.details[source] = {"error": str(e)}
                        result.errors.append(f"{source}: {e}")
        else:
            # Sequential execution
            for source in config.sources:
                try:
                    source_result = process_source(source)
                    result.details[source] = source_result
                    total_processed += source_result.get("files_processed", 0)
                    total_failed += source_result.get("files_failed", 0)
                except Exception as e:
                    logger.error(f"Error normalizing {source}: {e}")
                    result.details[source] = {"error": str(e)}
                    result.errors.append(f"{source}: {e}")

        result.items_processed = total_processed
        result.items_failed = total_failed

        if total_failed > 0:
            result.success = False

        state_manager.update_pipeline_status(
            last_normalization=datetime.now(timezone.utc).isoformat(),
            documents_normalized=total_processed,
        )

    except Exception as e:
        logger.exception(f"Normalization failed: {e}")
        result.success = False
        result.errors.append(str(e))

    finally:
        # Clean up sys.path
        if str(project_root / "scripts" / "transform") in sys.path:
            sys.path.remove(str(project_root / "scripts" / "transform"))

    result.completed_at = datetime.now(timezone.utc).isoformat()
    result.duration_seconds = (
        datetime.now(timezone.utc) - start_time
    ).total_seconds()

    return result


def run_chunking(
    config: PipelineConfig,
    state_manager: StateManager,
) -> StageResult:
    """
    Execute the chunking stage.

    Imports and runs the chunker module to create RAG chunks.
    """
    start_time = datetime.now(timezone.utc)
    result = StageResult(
        stage="chunk",
        success=True,
        started_at=start_time.isoformat(),
        completed_at="",
        duration_seconds=0.0,
    )

    logger.info("Starting chunking stage")

    if config.dry_run:
        logger.info("[DRY RUN] Would create chunks from normalized documents")
        result.details["dry_run"] = True
        result.completed_at = datetime.now(timezone.utc).isoformat()
        result.duration_seconds = (
            datetime.now(timezone.utc) - start_time
        ).total_seconds()
        return result

    project_root = get_project_root()
    chunker_path = project_root / "scripts" / "transform" / "chunker.py"

    if not chunker_path.exists():
        result.success = False
        result.errors.append(f"Chunker script not found: {chunker_path}")
        result.completed_at = datetime.now(timezone.utc).isoformat()
        result.duration_seconds = (
            datetime.now(timezone.utc) - start_time
        ).total_seconds()
        return result

    sys.path.insert(0, str(project_root / "scripts" / "transform"))

    try:
        import importlib.util

        spec = importlib.util.spec_from_file_location("chunker", chunker_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load chunker from {chunker_path}")

        chunker = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(chunker)

        # Create chunk configuration
        chunk_config = chunker.ChunkConfig()

        logger.info(f"Processing documents from: {config.normalized_dir}")
        logger.info(f"Output directory: {config.chunks_dir}")

        stats = chunker.process_documents(
            input_dir=config.normalized_dir,
            output_dir=config.chunks_dir,
            config=chunk_config,
        )

        result.items_processed = stats.get("documents_processed", 0)
        result.details["total_chunks"] = stats.get("total_chunks", 0)
        result.details["chunks_per_document"] = stats.get("chunks_per_document", {})

        if stats.get("errors"):
            result.errors.extend(stats["errors"])
            result.items_failed = len(stats["errors"])

        state_manager.update_pipeline_status(
            last_chunking=datetime.now(timezone.utc).isoformat(),
            chunks_created=stats.get("total_chunks", 0),
        )

    except Exception as e:
        logger.exception(f"Chunking failed: {e}")
        result.success = False
        result.errors.append(str(e))

    finally:
        if str(project_root / "scripts" / "transform") in sys.path:
            sys.path.remove(str(project_root / "scripts" / "transform"))

    result.completed_at = datetime.now(timezone.utc).isoformat()
    result.duration_seconds = (
        datetime.now(timezone.utc) - start_time
    ).total_seconds()

    return result


def run_validation(
    config: PipelineConfig,
    state_manager: StateManager,
) -> StageResult:
    """
    Execute the validation stage.

    Imports and runs the validator module to validate documents.
    """
    start_time = datetime.now(timezone.utc)
    result = StageResult(
        stage="validate",
        success=True,
        started_at=start_time.isoformat(),
        completed_at="",
        duration_seconds=0.0,
    )

    logger.info("Starting validation stage")

    if config.dry_run:
        logger.info("[DRY RUN] Would validate normalized documents")
        result.details["dry_run"] = True
        result.completed_at = datetime.now(timezone.utc).isoformat()
        result.duration_seconds = (
            datetime.now(timezone.utc) - start_time
        ).total_seconds()
        return result

    project_root = get_project_root()
    validator_path = project_root / "scripts" / "validate" / "validator.py"

    if not validator_path.exists():
        result.success = False
        result.errors.append(f"Validator script not found: {validator_path}")
        result.completed_at = datetime.now(timezone.utc).isoformat()
        result.duration_seconds = (
            datetime.now(timezone.utc) - start_time
        ).total_seconds()
        return result

    sys.path.insert(0, str(project_root / "scripts" / "validate"))

    try:
        import importlib.util

        spec = importlib.util.spec_from_file_location("validator", validator_path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load validator from {validator_path}")

        validator_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(validator_module)

        # Create validator instance
        validator = validator_module.DocumentValidator()

        logger.info(f"Validating documents in: {config.normalized_dir}")

        # Run validation
        report = validator.validate_directory(config.normalized_dir)

        # Write report
        report_path = validator_module.write_report(report, config.reports_dir)

        result.items_processed = report.total_documents
        result.items_failed = report.failed
        result.details["passed"] = report.passed
        result.details["failed"] = report.failed
        result.details["pass_rate"] = (
            round(report.passed / report.total_documents * 100, 2)
            if report.total_documents > 0
            else 0
        )
        result.details["duplicates_detected"] = len(report.duplicates)
        result.details["quality_distribution"] = report.quality_distribution
        result.details["report_path"] = str(report_path)

        if report.failed > 0:
            # Collect first few error messages for the result
            for doc in report.documents[:5]:
                if not doc.valid:
                    for error in doc.errors[:2]:
                        result.errors.append(
                            f"{doc.document_id}: [{error.code}] {error.message}"
                        )

        state_manager.update_pipeline_status(
            last_validation=datetime.now(timezone.utc).isoformat(),
        )

    except Exception as e:
        logger.exception(f"Validation failed: {e}")
        result.success = False
        result.errors.append(str(e))

    finally:
        if str(project_root / "scripts" / "validate") in sys.path:
            sys.path.remove(str(project_root / "scripts" / "validate"))

    result.completed_at = datetime.now(timezone.utc).isoformat()
    result.duration_seconds = (
        datetime.now(timezone.utc) - start_time
    ).total_seconds()

    return result


# =============================================================================
# PIPELINE ORCHESTRATOR
# =============================================================================


class PipelineOrchestrator:
    """Orchestrates the data centralization pipeline."""

    STAGE_ORDER = [
        PipelineStage.EXTRACT,
        PipelineStage.NORMALIZE,
        PipelineStage.CHUNK,
        PipelineStage.VALIDATE,
    ]

    STAGE_EXECUTORS: dict[PipelineStage, Callable] = {
        PipelineStage.EXTRACT: run_extraction,
        PipelineStage.NORMALIZE: run_normalization,
        PipelineStage.CHUNK: run_chunking,
        PipelineStage.VALIDATE: run_validation,
    }

    def __init__(self, config: PipelineConfig):
        self.config = config
        self.state_manager = StateManager(config.state_file)
        self.report = PipelineReport(
            started_at=datetime.now(timezone.utc).isoformat(),
            config_used={
                "stage": config.stage.value,
                "sources": config.sources,
                "skip_blocked": config.skip_blocked,
                "parallel": config.parallel,
                "dry_run": config.dry_run,
            },
        )

    def run(self) -> PipelineReport:
        """Execute the pipeline stages."""
        logger.info("=" * 60)
        logger.info("PIPELINE EXECUTION STARTED")
        logger.info("=" * 60)
        logger.info(f"Stage: {self.config.stage.value}")
        logger.info(f"Sources: {', '.join(self.config.sources)}")
        logger.info(f"Parallel: {self.config.parallel}")
        logger.info(f"Dry run: {self.config.dry_run}")

        start_time = time.time()

        try:
            if self.config.stage == PipelineStage.ALL:
                self._run_all_stages()
            else:
                self._run_single_stage(self.config.stage)

            # Clear checkpoint on successful completion
            if self.report.overall_success:
                self.state_manager.clear_checkpoint()

        except KeyboardInterrupt:
            logger.warning("Pipeline interrupted by user")
            self.report.overall_success = False

        except Exception as e:
            logger.exception(f"Pipeline failed with error: {e}")
            self.report.overall_success = False

        finally:
            self.report.completed_at = datetime.now(timezone.utc).isoformat()
            self.report.total_duration_seconds = time.time() - start_time

            # Save final state
            self.state_manager.save_state()

            # Write pipeline report
            self._write_report()

            self._print_summary()

        return self.report

    def _run_all_stages(self) -> None:
        """Run all pipeline stages in order."""
        # Check for resume from checkpoint
        last_checkpoint = self.state_manager.get_last_checkpoint()
        start_index = 0

        if last_checkpoint:
            logger.info(f"Resuming from checkpoint: {last_checkpoint}")
            self.report.checkpoint = last_checkpoint

            for i, stage in enumerate(self.STAGE_ORDER):
                if stage.value == last_checkpoint:
                    start_index = i + 1
                    break

        for stage in self.STAGE_ORDER[start_index:]:
            result = self._run_single_stage(stage)

            if not result.success:
                logger.error(f"Stage {stage.value} failed, stopping pipeline")
                self.report.overall_success = False
                break

            # Set checkpoint after each successful stage
            self.state_manager.set_checkpoint(stage.value)

    def _run_single_stage(self, stage: PipelineStage) -> StageResult:
        """Run a single pipeline stage."""
        logger.info("-" * 60)
        logger.info(f"EXECUTING STAGE: {stage.value.upper()}")
        logger.info("-" * 60)

        executor = self.STAGE_EXECUTORS.get(stage)
        if executor is None:
            result = StageResult(
                stage=stage.value,
                success=False,
                started_at=datetime.now(timezone.utc).isoformat(),
                completed_at=datetime.now(timezone.utc).isoformat(),
                duration_seconds=0.0,
            )
            result.errors.append(f"No executor found for stage: {stage.value}")
            self.report.stages_executed.append(result)
            return result

        result = executor(self.config, self.state_manager)
        self.report.stages_executed.append(result)

        if result.success:
            logger.info(
                f"Stage {stage.value} completed successfully "
                f"({result.items_processed} items processed)"
            )
        else:
            logger.error(
                f"Stage {stage.value} failed "
                f"({result.items_failed} items failed)"
            )
            self.report.overall_success = False

        return result

    def _write_report(self) -> None:
        """Write the pipeline execution report to file."""
        self.config.reports_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.config.reports_dir / f"pipeline_report_{timestamp}.json"

        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(self.report.to_dict(), f, indent=2, ensure_ascii=False)

        logger.info(f"Pipeline report written to: {report_file}")

    def _print_summary(self) -> None:
        """Print a summary of the pipeline execution."""
        print("\n" + "=" * 60)
        print("PIPELINE EXECUTION SUMMARY")
        print("=" * 60)
        print(f"Overall Status: {'SUCCESS' if self.report.overall_success else 'FAILED'}")
        print(f"Total Duration: {self.report.total_duration_seconds:.1f} seconds")
        print(f"Stages Executed: {len(self.report.stages_executed)}")

        print("\nStage Results:")
        for stage in self.report.stages_executed:
            status = "PASS" if stage.success else "FAIL"
            print(
                f"  {stage.stage.upper():12} [{status}] - "
                f"{stage.items_processed} processed, "
                f"{stage.items_failed} failed, "
                f"{stage.duration_seconds:.1f}s"
            )
            if stage.errors:
                for error in stage.errors[:3]:
                    print(f"    - {error}")
                if len(stage.errors) > 3:
                    print(f"    ... and {len(stage.errors) - 3} more errors")

        print("=" * 60)


# =============================================================================
# CLI
# =============================================================================


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Data Centralization Pipeline Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Stages:
  extract   - Run extraction for specified sources
  normalize - Transform raw data to unified schema
  chunk     - Create RAG chunks from normalized documents
  validate  - Validate documents and generate reports
  all       - Run full pipeline (extract -> normalize -> chunk -> validate)

Examples:
  python pipeline.py --stage all
  python pipeline.py --stage normalize --sources youtube,blog
  python pipeline.py --stage all --skip-blocked --parallel
  python pipeline.py --stage chunk --dry-run
        """,
    )

    parser.add_argument(
        "--stage",
        type=str,
        choices=["extract", "normalize", "chunk", "validate", "all"],
        default="all",
        help="Pipeline stage to execute (default: all)",
    )

    parser.add_argument(
        "--sources",
        type=str,
        default="youtube,blog,podcast,media",
        help="Comma-separated list of sources to process (default: youtube,blog,podcast,media)",
    )

    parser.add_argument(
        "--skip-blocked",
        action="store_true",
        default=True,
        help="Skip blocked sources (linkedin, book, deal_academy) - enabled by default",
    )

    parser.add_argument(
        "--include-blocked",
        action="store_true",
        help="Include blocked sources in processing",
    )

    parser.add_argument(
        "--parallel",
        action="store_true",
        help="Enable parallel execution where possible",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )

    parser.add_argument(
        "--max-workers",
        type=int,
        default=4,
        help="Maximum parallel workers (default: 4)",
    )

    parser.add_argument(
        "--state-file",
        type=Path,
        default=DEFAULT_STATE_FILE,
        help=f"Path to state file (default: {DEFAULT_STATE_FILE})",
    )

    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=DEFAULT_RAW_DIR,
        help=f"Raw data directory (default: {DEFAULT_RAW_DIR})",
    )

    parser.add_argument(
        "--normalized-dir",
        type=Path,
        default=DEFAULT_NORMALIZED_DIR,
        help=f"Normalized documents directory (default: {DEFAULT_NORMALIZED_DIR})",
    )

    parser.add_argument(
        "--chunks-dir",
        type=Path,
        default=DEFAULT_CHUNKS_DIR,
        help=f"Chunks output directory (default: {DEFAULT_CHUNKS_DIR})",
    )

    parser.add_argument(
        "--reports-dir",
        type=Path,
        default=DEFAULT_REPORTS_DIR,
        help=f"Reports directory (default: {DEFAULT_REPORTS_DIR})",
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    return parser.parse_args()


def main() -> int:
    """Main entry point for the pipeline CLI."""
    args = parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Parse sources
    sources = [s.strip() for s in args.sources.split(",") if s.strip()]

    # Determine skip_blocked setting
    skip_blocked = not args.include_blocked

    try:
        # Create configuration
        config = PipelineConfig(
            stage=PipelineStage(args.stage),
            sources=sources,
            skip_blocked=skip_blocked,
            parallel=args.parallel,
            dry_run=args.dry_run,
            max_workers=args.max_workers,
            state_file=Path(args.state_file).resolve(),
            raw_dir=Path(args.raw_dir).resolve(),
            normalized_dir=Path(args.normalized_dir).resolve(),
            chunks_dir=Path(args.chunks_dir).resolve(),
            reports_dir=Path(args.reports_dir).resolve(),
            verbose=args.verbose,
        )
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        return 1

    # Run pipeline
    orchestrator = PipelineOrchestrator(config)
    report = orchestrator.run()

    # Return appropriate exit code
    return 0 if report.overall_success else 1


if __name__ == "__main__":
    sys.exit(main())
