"""CSV file processor with robust encoding and error handling."""

from pathlib import Path
from typing import List, Optional, Tuple

import pandas as pd
from rich.console import Console

from .base import FileMetadata, FileProcessor, ProcessedFile, infer_content_type

console = Console()


class CSVProcessor(FileProcessor):
    """Processor for CSV files with robust encoding detection and error handling."""

    EXTENSIONS: List[str] = [".csv"]

    # Encodings to try in order of preference
    ENCODING_FALLBACKS: List[str] = ["utf-8", "latin-1", "cp1252", "iso-8859-1"]

    def can_process(self, file_path: Path) -> bool:
        """Check if this processor can handle the given file."""
        return file_path.suffix.lower() in self.EXTENSIONS

    def process(
        self, file_path: Path, password: Optional[str] = None
    ) -> ProcessedFile:
        """Process a CSV file and return structured data with metadata.

        Args:
            file_path: Path to the CSV file
            password: Ignored for CSV files (no encryption support)

        Returns:
            ProcessedFile containing DataFrame and metadata
        """
        # Create base metadata
        metadata = FileMetadata(
            filename=file_path.name,
            file_type="csv",
            inferred_content=infer_content_type(file_path.name),
            size_bytes=file_path.stat().st_size if file_path.exists() else 0,
        )

        # Check if file exists
        if not file_path.exists():
            metadata.is_corrupted = True
            metadata.error_message = f"File not found: {file_path}"
            return ProcessedFile(metadata=metadata)

        # Check for empty file
        if file_path.stat().st_size == 0:
            metadata.is_corrupted = True
            metadata.error_message = "Empty file"
            return ProcessedFile(metadata=metadata)

        # Try to read the CSV with encoding fallbacks
        df, encoding_used, error = self._read_csv_with_fallback(file_path)

        if df is None:
            metadata.is_corrupted = True
            metadata.error_message = error or "Failed to parse CSV"
            return ProcessedFile(metadata=metadata)

        # Successfully read - populate metadata
        metadata.row_count = len(df)
        metadata.inferred_content = infer_content_type(file_path.name, df)

        # Return ProcessedFile with tabular_data
        return ProcessedFile(
            tabular_data={file_path.stem: df},
            context_documents=[],
            metadata=metadata,
        )

    def get_sample(self, file_path: Path, max_rows: int = 50) -> str:
        """Get the first N rows of a CSV file as a string."""
        df, _, error = self._read_csv_with_fallback(file_path)
        if df is None:
            return f"Error reading file: {error}"
        if df.empty:
            return ""
        return df.head(max_rows).to_csv(index=False)

    def _read_csv_with_fallback(
        self, file_path: Path
    ) -> Tuple[Optional[pd.DataFrame], str, Optional[str]]:
        """Attempt to read a CSV file with multiple encoding fallbacks."""
        last_error = None

        for encoding in self.ENCODING_FALLBACKS:
            try:
                df = pd.read_csv(
                    file_path,
                    encoding=encoding,
                    on_bad_lines="warn",
                    engine="python",
                )
                return df, encoding, None

            except UnicodeDecodeError:
                last_error = f"Encoding error with {encoding}"
                continue

            except pd.errors.EmptyDataError:
                return pd.DataFrame(), encoding, None

            except pd.errors.ParserError as e:
                # Try with skip bad lines
                try:
                    df = pd.read_csv(
                        file_path,
                        encoding=encoding,
                        on_bad_lines="skip",
                        engine="python",
                    )
                    return df, encoding, None
                except Exception:
                    last_error = f"Parser error: {str(e)[:100]}"
                    continue

            except Exception as e:
                last_error = f"Unexpected error: {str(e)[:100]}"
                continue

        return None, "", last_error
