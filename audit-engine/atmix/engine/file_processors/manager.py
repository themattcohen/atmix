"""File ingestion manager coordinating all file processors."""

from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Union

import pandas as pd
from rich.console import Console
from rich.prompt import Confirm, Prompt

from .base import ContextDocument, FileMetadata, ProcessedFile, infer_content_type
from .csv_processor import CSVProcessor
from .pdf_processor import PDFProcessor
from .xlsx_processor import XLSXProcessor

console = Console()

# Size thresholds for user confirmation
LARGE_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
LARGE_PDF_PAGE_COUNT = 20


class FileIngestionManager:
    """Coordinates file processing across all supported formats.

    Handles:
    - Automatic processor selection based on file extension
    - Duplicate file handling (XLSX preferred over CSV with same stem)
    - Password-protected file prompting
    - Large file confirmation
    - Corrupted file warnings

    The manager processes files in priority order (XLSX first, then CSV, then PDF)
    to ensure that when both foo.xlsx and foo.csv exist, the XLSX version is
    preferred as it may contain multiple sheets.
    """

    def __init__(self, interactive: bool = True):
        """Initialize the file ingestion manager.

        Args:
            interactive: If True, prompt user for passwords and large file
                confirmation. If False, skip password-protected files and
                process all files without confirmation.
        """
        self.interactive = interactive
        self.processors: List[Union[XLSXProcessor, CSVProcessor, PDFProcessor]] = [
            XLSXProcessor(),  # Check XLSX first (higher priority than CSV)
            CSVProcessor(),
            PDFProcessor(),
        ]
        self._processed_stems: Set[str] = set()
        self._stem_to_processed_file: Dict[str, ProcessedFile] = {}
        self._stem_to_extension: Dict[str, str] = {}

    def process_directory(
        self, directory: Path
    ) -> Tuple[Dict[str, str], Dict[str, str], List[ContextDocument]]:
        """Process all supported files in directory.

        Scans the directory for supported files and processes them in order
        of processor priority. Handles duplicates (e.g., foo.xlsx and foo.csv)
        by preferring XLSX files.

        Args:
            directory: Path to the directory to process

        Returns:
            Tuple of:
                - data_files: Dict mapping filename to inferred content type
                - data_samples: Dict mapping filename to sample data string
                - context_documents: List of ContextDocument from PDFs
        """
        data_files: Dict[str, str] = {}
        data_samples: Dict[str, str] = {}
        context_documents: List[ContextDocument] = []

        if not directory.exists():
            console.print(f"[red]Directory not found:[/red] {directory}")
            return data_files, data_samples, context_documents

        if not directory.is_dir():
            console.print(f"[red]Not a directory:[/red] {directory}")
            return data_files, data_samples, context_documents

        # Reset tracking for this directory scan
        self._processed_stems.clear()
        self._stem_to_processed_file.clear()
        self._stem_to_extension.clear()

        # Collect all supported files
        supported_files = self._collect_supported_files(directory)

        if not supported_files:
            console.print(f"[yellow]No supported files found in:[/yellow] {directory}")
            return data_files, data_samples, context_documents

        console.print(
            f"\n[bold]Processing {len(supported_files)} files from:[/bold] {directory}"
        )

        # Sort files: XLSX first, then CSV, then PDF (processor priority)
        sorted_files = self._sort_by_priority(supported_files)

        for file_path in sorted_files:
            # Check for duplicates before processing
            if self._handle_duplicate(file_path):
                continue

            result = self.process_file(file_path)
            if result is None:
                continue

            # Check if processing was successful (no corruption/errors)
            if result.metadata and not result.metadata.is_corrupted:
                filename = file_path.name

                # Get inferred content type
                content_type = result.metadata.inferred_content
                data_files[filename] = content_type

                # Generate sample from tabular data
                sample = self._generate_sample(result)
                data_samples[filename] = sample

                # Track processed stem for duplicate detection
                normalized_stem = self._normalize_stem(file_path.stem)
                self._processed_stems.add(normalized_stem)
                self._stem_to_processed_file[normalized_stem] = result
                self._stem_to_extension[normalized_stem] = file_path.suffix.lower()

                # Extract context documents from PDFs
                if result.context_documents:
                    context_documents.extend(result.context_documents)

        return data_files, data_samples, context_documents

    def process_file(
        self, file_path: Path, password: Optional[str] = None
    ) -> Optional[ProcessedFile]:
        """Process a single file with appropriate processor.

        Args:
            file_path: Path to the file to process
            password: Optional password for protected files

        Returns:
            ProcessedFile if successful, None if skipped or failed
        """
        if not file_path.exists():
            console.print(f"  [red]x[/red] File not found: {file_path.name}")
            return None

        # Find appropriate processor
        processor = self._get_processor(file_path)
        if processor is None:
            console.print(
                f"  [yellow]?[/yellow] No processor for: {file_path.name}"
            )
            return None

        # Pre-processing checks using metadata probe
        metadata = self._probe_metadata(file_path)

        # Handle corrupted files
        if metadata.is_corrupted:
            self._handle_corrupted(file_path, metadata)
            return None

        # Handle password-protected files
        if metadata.requires_password:
            if password is None:
                password = self._handle_password_protected(file_path, metadata)
            if password is None:
                return None

        # Handle large files
        if not self._handle_large_file(file_path, metadata):
            return None

        # Process the file
        try:
            result = processor.process(file_path, password=password)

            # Log success
            if result.metadata and not result.metadata.is_corrupted:
                row_info = ""
                if result.has_tabular_data():
                    row_info = f" ({result.total_rows():,} rows)"
                console.print(
                    f"  [green]+[/green] Loaded {file_path.name}: "
                    f"{result.metadata.inferred_content}{row_info}"
                )

            return result

        except PermissionError as e:
            console.print(
                f"  [yellow]![/yellow] Password required: {file_path.name}"
            )
            if self.interactive and password is None:
                password = self._handle_password_protected(file_path, metadata)
                if password:
                    return self.process_file(file_path, password=password)
            return None
        except ValueError as e:
            console.print(
                f"  [red]x[/red] Invalid file {file_path.name}: {e}"
            )
            return None
        except Exception as e:
            console.print(
                f"  [red]x[/red] Error processing {file_path.name}: {e}"
            )
            return None

    def _collect_supported_files(self, directory: Path) -> List[Path]:
        """Collect all files with supported extensions.

        Args:
            directory: Directory to scan

        Returns:
            List of file paths with supported extensions
        """
        supported_files = []
        all_extensions: Set[str] = set()

        # Collect extensions from all processors
        for processor in self.processors:
            if hasattr(processor, "EXTENSIONS"):
                all_extensions.update(processor.EXTENSIONS)

        for file_path in directory.iterdir():
            if file_path.is_file():
                if file_path.suffix.lower() in all_extensions:
                    supported_files.append(file_path)

        return supported_files

    def _sort_by_priority(self, files: List[Path]) -> List[Path]:
        """Sort files by processor priority (XLSX > CSV > PDF).

        XLSX files are processed first because they may contain multiple
        sheets with richer data than a simple CSV export.

        Args:
            files: List of file paths

        Returns:
            Sorted list with XLSX files first
        """
        priority_map = {".xlsx": 0, ".xls": 0, ".csv": 1, ".pdf": 2}

        def get_priority(path: Path) -> int:
            return priority_map.get(path.suffix.lower(), 99)

        return sorted(files, key=get_priority)

    def _get_processor(
        self, file_path: Path
    ) -> Optional[Union[XLSXProcessor, CSVProcessor, PDFProcessor]]:
        """Get the appropriate processor for a file.

        Args:
            file_path: Path to the file

        Returns:
            Processor instance or None
        """
        for processor in self.processors:
            if processor.can_process(file_path):
                return processor
        return None

    def _probe_metadata(self, file_path: Path) -> FileMetadata:
        """Probe file for metadata without full processing.

        This allows checking for issues (password, corruption, size)
        before committing to full processing.

        Args:
            file_path: Path to the file

        Returns:
            FileMetadata with basic info and any detected issues
        """
        suffix = file_path.suffix.lower()
        file_type = suffix.lstrip(".")

        metadata = FileMetadata(
            filename=file_path.name,
            file_type=file_type,
            inferred_content=infer_content_type(file_path.name),
            size_bytes=file_path.stat().st_size if file_path.exists() else 0,
        )

        # Check for PDF page count and encryption
        if suffix == ".pdf":
            try:
                import pypdf

                with open(file_path, "rb") as f:
                    reader = pypdf.PdfReader(f)
                    if reader.is_encrypted:
                        metadata.requires_password = True
                    else:
                        metadata.page_count = len(reader.pages)
            except Exception as e:
                error_msg = str(e).lower()
                if "password" in error_msg or "encrypted" in error_msg:
                    metadata.requires_password = True
                else:
                    metadata.is_corrupted = True
                    metadata.error_message = str(e)[:100]

        # Check for XLSX password protection
        elif suffix in [".xlsx", ".xls"]:
            try:
                import openpyxl

                # Try to open the workbook
                wb = openpyxl.load_workbook(
                    file_path, read_only=True, data_only=True
                )
                metadata.sheet_names = wb.sheetnames
                wb.close()
            except Exception as e:
                error_msg = str(e).lower()
                if "password" in error_msg or "encrypted" in error_msg:
                    metadata.requires_password = True
                elif "corrupt" in error_msg or "invalid" in error_msg:
                    metadata.is_corrupted = True
                    metadata.error_message = str(e)[:100]
                # Some other error - file might still be processable
                # Don't mark as corrupted yet

        return metadata

    def _normalize_stem(self, stem: str) -> str:
        """Normalize file stem for duplicate detection.

        Handles variations like:
        - 'Chandradez_General Ledger' vs 'chandradez_general_ledger'
        - 'profit_and_loss' vs 'profit-and-loss' vs 'Profit and Loss'
        """
        import re
        # Lowercase
        normalized = stem.lower()
        # Replace spaces, hyphens, underscores with single underscore
        normalized = re.sub(r'[\s\-_]+', '_', normalized)
        # Remove company prefixes if present (e.g., "chandradez_")
        # Keep this simple - just normalize separators
        return normalized

    def _handle_duplicate(self, file_path: Path) -> bool:
        """Check if file should be skipped due to duplicate.

        Rules:
        - If we've processed an XLSX, skip the CSV with same stem
        - If we've processed a CSV, and find XLSX, process XLSX and mark CSV
          data as superseded (handled by processing order)

        Since we process XLSX before CSV (via _sort_by_priority), we only
        need to check if an XLSX was already processed when encountering CSV.

        Args:
            file_path: Path to the file being considered

        Returns:
            True if file should be skipped, False to proceed
        """
        stem = self._normalize_stem(file_path.stem)
        suffix = file_path.suffix.lower()

        # If this stem was already processed
        if stem in self._processed_stems:
            existing_ext = self._stem_to_extension.get(stem, "")

            # If we already have an XLSX and this is a CSV, skip
            if suffix == ".csv" and existing_ext in [".xlsx", ".xls"]:
                existing_file = self._stem_to_processed_file.get(stem)
                if existing_file and existing_file.metadata:
                    console.print(
                        f"  [dim]Skipping {file_path.name} "
                        f"(superseded by {existing_file.metadata.filename})[/dim]"
                    )
                else:
                    console.print(
                        f"  [dim]Skipping {file_path.name} "
                        f"(superseded by XLSX version)[/dim]"
                    )
                return True

        return False

    def _handle_password_protected(
        self, file_path: Path, metadata: FileMetadata
    ) -> Optional[str]:
        """Prompt user for password if interactive mode.

        Args:
            file_path: Path to the password-protected file
            metadata: File metadata

        Returns:
            Password string if provided, None to skip the file
        """
        if not self.interactive:
            console.print(
                f"  [yellow]![/yellow] Skipping password-protected file "
                f"(non-interactive): {file_path.name}"
            )
            return None

        console.print(
            f"\n[yellow]Password required for:[/yellow] {file_path.name}"
        )
        password = Prompt.ask(
            "Enter password (or press Enter to skip)",
            password=True,
            default="",
        )

        if not password:
            console.print(f"  [dim]Skipping {file_path.name}[/dim]")
            return None

        return password

    def _handle_large_file(
        self, file_path: Path, metadata: FileMetadata
    ) -> bool:
        """Ask user before processing large files.

        Large file criteria:
        - PDFs with > 20 pages
        - Any file > 10MB

        Args:
            file_path: Path to the file
            metadata: File metadata

        Returns:
            True to proceed with processing, False to skip
        """
        is_large = False
        size_info = ""

        # Check file size
        if metadata.size_bytes > LARGE_FILE_SIZE_BYTES:
            is_large = True
            size_mb = metadata.size_bytes / (1024 * 1024)
            size_info = f"{size_mb:.1f} MB"

        # Check PDF page count
        if metadata.page_count and metadata.page_count > LARGE_PDF_PAGE_COUNT:
            is_large = True
            size_info = f"{metadata.page_count} pages"

        if not is_large:
            return True

        if not self.interactive:
            console.print(
                f"  [yellow]![/yellow] Processing large file ({size_info}): "
                f"{file_path.name}"
            )
            return True

        return Confirm.ask(
            f"[yellow]Large file detected[/yellow]: {file_path.name} ({size_info}). "
            "Process this file?",
            default=True,
        )

    def _handle_corrupted(
        self, file_path: Path, metadata: FileMetadata
    ) -> None:
        """Warn user about corrupted files.

        Args:
            file_path: Path to the corrupted file
            metadata: File metadata with corruption details
        """
        reason = metadata.error_message or "Unknown error"
        console.print(
            f"  [red]x[/red] Corrupted file skipped: {file_path.name} - {reason}"
        )

    def _generate_sample(
        self, result: ProcessedFile, max_rows: int = 30
    ) -> str:
        """Generate a text sample from processed file data.

        Args:
            result: ProcessedFile with tabular data
            max_rows: Maximum rows to include in sample

        Returns:
            String representation of sample data
        """
        if not result.has_tabular_data():
            # For context-only documents, return text excerpt
            if result.context_documents:
                text = result.context_documents[0].extracted_text
                return text[:2000] + "..." if len(text) > 2000 else text
            return ""

        samples = []
        for name, df in result.tabular_data.items():
            if isinstance(df, pd.DataFrame) and not df.empty:
                sample_df = df.head(max_rows)
                csv_str = sample_df.to_csv(index=False)
                if len(result.tabular_data) > 1:
                    samples.append(f"--- {name} ---\n{csv_str}")
                else:
                    samples.append(csv_str)

        return "\n\n".join(samples)
