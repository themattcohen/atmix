#!/usr/bin/env python3
"""
Document Validator
==================
Validates normalized documents against the unified schema for RAG pipelines.

Features:
- Schema validation with required field checking
- Format validation (URLs, dates, IDs)
- Content quality assessment (word count, minimum thresholds)
- Duplicate detection via content similarity
- Comprehensive reporting with error codes

Error Codes:
- E010: Schema violation (malformed document structure)
- E011: Missing required field
- E012: Content too short (below minimum word count)
- E013: Content too long (exceeds maximum word count)
- E020: Below minimum quality score
- E021: Duplicate detected

Usage:
    python validator.py --input-dir PATH --report-dir PATH --strict
"""

import argparse
import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse


# =============================================================================
# CONFIGURATION
# =============================================================================

DEFAULT_CONFIG = {
    "min_word_count": 50,
    "max_word_count": 50000,
    "min_quality_score": 0.3,
    "similarity_threshold": 0.85,
    "id_pattern": r"^[a-zA-Z0-9_-]+$",
    "date_pattern": r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$",
}

REQUIRED_FIELDS = [
    "id",
    "source",
    "source_type",
    "title",
    "content.text",
    "extraction.extracted_at",
]


# =============================================================================
# DATA CLASSES
# =============================================================================


@dataclass
class ValidationError:
    """Represents a single validation error."""

    code: str
    message: str
    field: Optional[str] = None
    severity: str = "error"

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "message": self.message,
            "field": self.field,
            "severity": self.severity,
        }


@dataclass
class DocumentResult:
    """Validation result for a single document."""

    document_id: str
    file_path: str
    valid: bool
    errors: list[ValidationError] = field(default_factory=list)
    warnings: list[ValidationError] = field(default_factory=list)
    quality_score: float = 0.0
    word_count: int = 0

    def to_dict(self) -> dict:
        return {
            "document_id": self.document_id,
            "file_path": self.file_path,
            "valid": self.valid,
            "quality_score": self.quality_score,
            "word_count": self.word_count,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
        }


@dataclass
class ValidationReport:
    """Complete validation report for all documents."""

    total_documents: int = 0
    passed: int = 0
    failed: int = 0
    documents: list[DocumentResult] = field(default_factory=list)
    duplicates: list[dict] = field(default_factory=list)
    quality_distribution: dict = field(default_factory=dict)
    validation_timestamp: str = field(
        default_factory=lambda: datetime.now().isoformat()
    )
    config_used: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "summary": {
                "total_documents": self.total_documents,
                "passed": self.passed,
                "failed": self.failed,
                "pass_rate": (
                    round(self.passed / self.total_documents * 100, 2)
                    if self.total_documents > 0
                    else 0
                ),
            },
            "quality_distribution": self.quality_distribution,
            "duplicates_detected": len(self.duplicates),
            "duplicates": self.duplicates,
            "documents": [d.to_dict() for d in self.documents],
            "validation_timestamp": self.validation_timestamp,
            "config_used": self.config_used,
        }


# =============================================================================
# VALIDATOR CLASS
# =============================================================================


class DocumentValidator:
    """Validates normalized documents against the unified schema."""

    def __init__(
        self,
        config: Optional[dict] = None,
        strict: bool = False,
    ):
        """
        Initialize the validator.

        Args:
            config: Override default configuration values
            strict: If True, treat warnings as errors
        """
        self.config = {**DEFAULT_CONFIG, **(config or {})}
        self.strict = strict
        self._content_hashes: dict[str, str] = {}
        self._content_texts: dict[str, str] = {}

    def validate_directory(self, input_dir: Path) -> ValidationReport:
        """
        Validate all JSON documents in a directory.

        Args:
            input_dir: Directory containing normalized JSON documents

        Returns:
            ValidationReport with results for all documents
        """
        report = ValidationReport(config_used=self.config)

        if not input_dir.exists():
            raise FileNotFoundError(f"Input directory not found: {input_dir}")

        json_files = list(input_dir.rglob("*.json"))
        report.total_documents = len(json_files)

        if report.total_documents == 0:
            return report

        # First pass: validate each document and collect content for duplicate detection
        for json_file in json_files:
            result = self._validate_file(json_file)
            report.documents.append(result)

        # Second pass: detect duplicates across all documents
        duplicates = self._detect_duplicates()
        report.duplicates = duplicates

        # Mark documents with duplicates as having errors
        duplicate_ids = set()
        for dup in duplicates:
            duplicate_ids.add(dup["document_id"])
            duplicate_ids.add(dup["duplicate_of"])

        for doc in report.documents:
            if doc.document_id in duplicate_ids:
                dup_error = ValidationError(
                    code="E021",
                    message="Duplicate content detected",
                    field="content.text",
                )
                doc.errors.append(dup_error)
                doc.valid = False

        # Calculate final statistics
        report.passed = sum(1 for d in report.documents if d.valid)
        report.failed = report.total_documents - report.passed

        # Calculate quality distribution
        report.quality_distribution = self._calculate_quality_distribution(
            report.documents
        )

        return report

    def _validate_file(self, file_path: Path) -> DocumentResult:
        """Validate a single JSON document file."""
        result = DocumentResult(
            document_id="unknown",
            file_path=str(file_path),
            valid=True,
        )

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                document = json.load(f)
        except json.JSONDecodeError as e:
            result.valid = False
            result.errors.append(
                ValidationError(
                    code="E010",
                    message=f"Invalid JSON: {e}",
                )
            )
            return result
        except Exception as e:
            result.valid = False
            result.errors.append(
                ValidationError(
                    code="E010",
                    message=f"Failed to read file: {e}",
                )
            )
            return result

        # Handle list of documents (batch file)
        if isinstance(document, list):
            # For batch files, validate each document
            # Return combined result
            if len(document) == 0:
                result.valid = False
                result.errors.append(
                    ValidationError(
                        code="E010",
                        message="Empty document array",
                    )
                )
                return result
            # For now, validate first document as representative
            document = document[0]

        # Validate the document
        return self._validate_document(document, file_path)

    def _validate_document(self, document: dict, file_path: Path) -> DocumentResult:
        """Validate a single document against the schema."""
        doc_id = document.get("id", "unknown")
        result = DocumentResult(
            document_id=doc_id,
            file_path=str(file_path),
            valid=True,
        )

        errors = []
        warnings = []

        # 1. Validate required fields
        for field_path in REQUIRED_FIELDS:
            if not self._has_field(document, field_path):
                errors.append(
                    ValidationError(
                        code="E011",
                        message=f"Missing required field: {field_path}",
                        field=field_path,
                    )
                )

        # 2. Validate field formats
        format_errors, format_warnings = self._validate_formats(document)
        errors.extend(format_errors)
        warnings.extend(format_warnings)

        # 3. Validate content quality
        content_text = self._get_nested(document, "content.text", "")
        if not isinstance(content_text, str):
            content_text = str(content_text) if content_text else ""

        word_count = len(content_text.split())
        result.word_count = word_count

        if word_count < self.config["min_word_count"]:
            errors.append(
                ValidationError(
                    code="E012",
                    message=f"Content too short: {word_count} words (minimum: {self.config['min_word_count']})",
                    field="content.text",
                )
            )

        if word_count > self.config["max_word_count"]:
            errors.append(
                ValidationError(
                    code="E013",
                    message=f"Content too long: {word_count} words (maximum: {self.config['max_word_count']})",
                    field="content.text",
                )
            )

        # 4. Calculate quality score
        quality_score = self._calculate_quality_score(document, word_count)
        result.quality_score = quality_score

        if quality_score < self.config["min_quality_score"]:
            errors.append(
                ValidationError(
                    code="E020",
                    message=f"Below minimum quality score: {quality_score:.2f} (minimum: {self.config['min_quality_score']})",
                )
            )

        # 5. Store content for duplicate detection
        if content_text and doc_id != "unknown":
            content_hash = hashlib.md5(content_text.encode()).hexdigest()
            self._content_hashes[doc_id] = content_hash
            self._content_texts[doc_id] = content_text

        # Determine validity
        result.errors = errors
        result.warnings = warnings

        if self.strict:
            result.valid = len(errors) == 0 and len(warnings) == 0
        else:
            result.valid = len(errors) == 0

        return result

    def _has_field(self, document: dict, field_path: str) -> bool:
        """Check if a nested field exists and is not None/empty."""
        value = self._get_nested(document, field_path)
        if value is None:
            return False
        if isinstance(value, str) and value.strip() == "":
            return False
        return True

    def _get_nested(
        self, document: dict, field_path: str, default: Any = None
    ) -> Any:
        """Get a nested field value using dot notation."""
        parts = field_path.split(".")
        current = document
        for part in parts:
            if not isinstance(current, dict):
                return default
            current = current.get(part)
            if current is None:
                return default
        return current

    def _validate_formats(
        self, document: dict
    ) -> tuple[list[ValidationError], list[ValidationError]]:
        """Validate field formats (URLs, dates, IDs)."""
        errors = []
        warnings = []

        # Validate ID format
        doc_id = document.get("id", "")
        if doc_id and not re.match(self.config["id_pattern"], doc_id):
            errors.append(
                ValidationError(
                    code="E010",
                    message=f"Invalid ID format: '{doc_id}' (must match pattern: {self.config['id_pattern']})",
                    field="id",
                )
            )

        # Validate URL format (if present)
        url = document.get("url") or self._get_nested(document, "source_url")
        if url:
            if not self._is_valid_url(url):
                warnings.append(
                    ValidationError(
                        code="E010",
                        message=f"Malformed URL: '{url}'",
                        field="url",
                        severity="warning",
                    )
                )

        # Validate date format
        extracted_at = self._get_nested(document, "extraction.extracted_at")
        if extracted_at:
            if not self._is_valid_iso8601(extracted_at):
                errors.append(
                    ValidationError(
                        code="E010",
                        message=f"Invalid ISO8601 date format: '{extracted_at}'",
                        field="extraction.extracted_at",
                    )
                )

        # Validate optional date fields
        for date_field in ["published_date", "created_at", "updated_at"]:
            date_value = document.get(date_field)
            if date_value and not self._is_valid_iso8601(date_value):
                warnings.append(
                    ValidationError(
                        code="E010",
                        message=f"Invalid ISO8601 date format: '{date_value}'",
                        field=date_field,
                        severity="warning",
                    )
                )

        return errors, warnings

    def _is_valid_url(self, url: str) -> bool:
        """Check if a URL is well-formed."""
        try:
            parsed = urlparse(url)
            return all([parsed.scheme in ("http", "https"), parsed.netloc])
        except Exception:
            return False

    def _is_valid_iso8601(self, date_str: str) -> bool:
        """Check if a string is a valid ISO8601 date."""
        if re.match(self.config["date_pattern"], date_str):
            return True
        # Try parsing as fallback
        try:
            datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return True
        except (ValueError, AttributeError):
            return False

    def _calculate_quality_score(self, document: dict, word_count: int) -> float:
        """
        Calculate a quality score for the document (0.0 - 1.0).

        Factors:
        - Field completeness
        - Content length (normalized)
        - Metadata presence
        """
        score = 0.0
        max_score = 0.0

        # Required fields present (40%)
        max_score += 0.4
        required_count = sum(
            1 for f in REQUIRED_FIELDS if self._has_field(document, f)
        )
        score += 0.4 * (required_count / len(REQUIRED_FIELDS))

        # Content length quality (30%)
        max_score += 0.3
        if word_count >= self.config["min_word_count"]:
            if word_count <= 500:
                length_score = 0.5
            elif word_count <= 2000:
                length_score = 1.0
            elif word_count <= self.config["max_word_count"]:
                length_score = 0.8
            else:
                length_score = 0.3
            score += 0.3 * length_score

        # Optional metadata presence (30%)
        max_score += 0.3
        optional_fields = [
            "url",
            "published_date",
            "author",
            "tags",
            "summary",
            "content.word_count",
            "extraction.method",
        ]
        optional_count = sum(1 for f in optional_fields if self._has_field(document, f))
        score += 0.3 * (optional_count / len(optional_fields))

        return round(score / max_score if max_score > 0 else 0.0, 3)

    def _detect_duplicates(self) -> list[dict]:
        """Detect duplicate documents based on content similarity."""
        duplicates = []
        doc_ids = list(self._content_hashes.keys())

        # Check for exact duplicates first (by hash)
        hash_to_ids: dict[str, list[str]] = defaultdict(list)
        for doc_id, content_hash in self._content_hashes.items():
            hash_to_ids[content_hash].append(doc_id)

        for content_hash, ids in hash_to_ids.items():
            if len(ids) > 1:
                primary = ids[0]
                for dup_id in ids[1:]:
                    duplicates.append(
                        {
                            "document_id": dup_id,
                            "duplicate_of": primary,
                            "similarity": 1.0,
                            "method": "exact_hash",
                        }
                    )

        # Check for similar content (expensive, only if needed)
        if len(doc_ids) <= 100:  # Only for smaller datasets
            checked_pairs: set[tuple[str, str]] = set()
            for i, doc_id1 in enumerate(doc_ids):
                for doc_id2 in doc_ids[i + 1 :]:
                    # Skip if already detected as exact duplicate
                    pair = (
                        (doc_id1, doc_id2) if doc_id1 < doc_id2 else (doc_id2, doc_id1)
                    )
                    if pair in checked_pairs:
                        continue
                    checked_pairs.add(pair)

                    if self._content_hashes.get(doc_id1) == self._content_hashes.get(
                        doc_id2
                    ):
                        continue

                    text1 = self._content_texts.get(doc_id1, "")
                    text2 = self._content_texts.get(doc_id2, "")

                    if not text1 or not text2:
                        continue

                    # Use quick length check first
                    len_ratio = min(len(text1), len(text2)) / max(len(text1), len(text2))
                    if len_ratio < 0.5:
                        continue

                    # Calculate similarity (expensive)
                    similarity = self._calculate_similarity(text1, text2)
                    if similarity >= self.config["similarity_threshold"]:
                        duplicates.append(
                            {
                                "document_id": doc_id2,
                                "duplicate_of": doc_id1,
                                "similarity": round(similarity, 3),
                                "method": "content_similarity",
                            }
                        )

        return duplicates

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity ratio between two texts."""
        # Use a sample for large texts to improve performance
        if len(text1) > 5000:
            text1 = text1[:2500] + text1[-2500:]
        if len(text2) > 5000:
            text2 = text2[:2500] + text2[-2500:]

        return SequenceMatcher(None, text1, text2).ratio()

    def _calculate_quality_distribution(
        self, documents: list[DocumentResult]
    ) -> dict:
        """Calculate quality score distribution across documents."""
        if not documents:
            return {}

        scores = [d.quality_score for d in documents]
        distribution = {
            "min": round(min(scores), 3),
            "max": round(max(scores), 3),
            "mean": round(sum(scores) / len(scores), 3),
            "buckets": {
                "excellent (0.8-1.0)": sum(1 for s in scores if s >= 0.8),
                "good (0.6-0.8)": sum(1 for s in scores if 0.6 <= s < 0.8),
                "fair (0.4-0.6)": sum(1 for s in scores if 0.4 <= s < 0.6),
                "poor (0.0-0.4)": sum(1 for s in scores if s < 0.4),
            },
        }
        return distribution


# =============================================================================
# REPORT WRITER
# =============================================================================


def write_report(report: ValidationReport, report_dir: Path) -> Path:
    """
    Write the validation report to a JSON file.

    Args:
        report: ValidationReport object
        report_dir: Directory to write the report

    Returns:
        Path to the written report file
    """
    report_dir.mkdir(parents=True, exist_ok=True)

    date_str = datetime.now().strftime("%Y%m%d")
    report_filename = f"quality_report_{date_str}.json"
    report_path = report_dir / report_filename

    # If file exists, add timestamp to avoid overwriting
    if report_path.exists():
        timestamp = datetime.now().strftime("%H%M%S")
        report_filename = f"quality_report_{date_str}_{timestamp}.json"
        report_path = report_dir / report_filename

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report.to_dict(), f, indent=2, ensure_ascii=False)

    return report_path


def print_summary(report: ValidationReport) -> None:
    """Print a summary of the validation results to stdout."""
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    print(f"Total documents: {report.total_documents}")
    print(f"Passed: {report.passed}")
    print(f"Failed: {report.failed}")
    if report.total_documents > 0:
        pass_rate = report.passed / report.total_documents * 100
        print(f"Pass rate: {pass_rate:.1f}%")

    if report.duplicates:
        print(f"\nDuplicates detected: {len(report.duplicates)}")

    if report.quality_distribution:
        print("\nQuality distribution:")
        for bucket, count in report.quality_distribution.get("buckets", {}).items():
            print(f"  {bucket}: {count}")

    # Print errors by document
    failed_docs = [d for d in report.documents if not d.valid]
    if failed_docs:
        print("\n" + "-" * 60)
        print("VALIDATION ERRORS")
        print("-" * 60)
        for doc in failed_docs[:10]:  # Limit to first 10
            print(f"\n{doc.document_id} ({doc.file_path}):")
            for error in doc.errors:
                print(f"  [{error.code}] {error.message}")
        if len(failed_docs) > 10:
            print(f"\n... and {len(failed_docs) - 10} more failed documents")

    print()


# =============================================================================
# CLI
# =============================================================================


def main() -> int:
    """Main entry point for the validator CLI."""
    parser = argparse.ArgumentParser(
        description="Validate normalized documents against the unified schema",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Error Codes:
  E010  Schema violation (malformed document structure)
  E011  Missing required field
  E012  Content too short (below minimum word count)
  E013  Content too long (exceeds maximum word count)
  E020  Below minimum quality score
  E021  Duplicate detected

Examples:
  python validator.py --input-dir ./data/normalized --report-dir ./reports
  python validator.py --input-dir ./data/normalized --strict
  python validator.py --input-dir ./docs --min-words 100 --max-words 10000
        """,
    )

    parser.add_argument(
        "--input-dir",
        type=Path,
        required=True,
        help="Directory containing normalized JSON documents",
    )
    parser.add_argument(
        "--report-dir",
        type=Path,
        default=Path("./reports"),
        help="Directory to write the validation report (default: ./reports)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as errors",
    )
    parser.add_argument(
        "--min-words",
        type=int,
        default=DEFAULT_CONFIG["min_word_count"],
        help=f"Minimum word count (default: {DEFAULT_CONFIG['min_word_count']})",
    )
    parser.add_argument(
        "--max-words",
        type=int,
        default=DEFAULT_CONFIG["max_word_count"],
        help=f"Maximum word count (default: {DEFAULT_CONFIG['max_word_count']})",
    )
    parser.add_argument(
        "--min-quality",
        type=float,
        default=DEFAULT_CONFIG["min_quality_score"],
        help=f"Minimum quality score (default: {DEFAULT_CONFIG['min_quality_score']})",
    )
    parser.add_argument(
        "--similarity-threshold",
        type=float,
        default=DEFAULT_CONFIG["similarity_threshold"],
        help=f"Similarity threshold for duplicate detection (default: {DEFAULT_CONFIG['similarity_threshold']})",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress console output (only write report file)",
    )

    args = parser.parse_args()

    # Build configuration
    config = {
        "min_word_count": args.min_words,
        "max_word_count": args.max_words,
        "min_quality_score": args.min_quality,
        "similarity_threshold": args.similarity_threshold,
    }

    # Run validation
    try:
        validator = DocumentValidator(config=config, strict=args.strict)
        report = validator.validate_directory(args.input_dir)
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Validation failed: {e}", file=sys.stderr)
        return 1

    # Write report
    try:
        report_path = write_report(report, args.report_dir)
        if not args.quiet:
            print(f"\nReport written to: {report_path}")
    except Exception as e:
        print(f"Failed to write report: {e}", file=sys.stderr)
        return 1

    # Print summary
    if not args.quiet:
        print_summary(report)

    # Return exit code based on validation results
    if report.failed > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
