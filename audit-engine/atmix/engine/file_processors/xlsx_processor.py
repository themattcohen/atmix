"""Excel file processor for XLSX and XLS files."""

from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from rich.console import Console

from .base import FileMetadata, FileProcessor, ProcessedFile, infer_content_type

console = Console()


class XLSXProcessor(FileProcessor):
    """Processor for Excel files (.xlsx, .xls).

    Handles:
    - Multiple sheets (each becomes a separate DataFrame)
    - Password-protected files (detection and optional decryption)
    - Empty sheet filtering
    - Corrupted file handling
    """

    EXTENSIONS: List[str] = [".xlsx", ".xls"]

    def can_process(self, file_path: Path) -> bool:
        """Check if this processor can handle the given file."""
        return file_path.suffix.lower() in self.EXTENSIONS

    def process(
        self, file_path: Path, password: Optional[str] = None
    ) -> ProcessedFile:
        """Process an Excel file and return the result.

        Each non-empty sheet becomes a separate DataFrame with key "{filename}_{sheetname}".

        Args:
            file_path: Path to the Excel file
            password: Optional password for protected files

        Returns:
            ProcessedFile with metadata and dict of DataFrames
        """
        # Create base metadata
        metadata = FileMetadata(
            filename=file_path.name,
            file_type=file_path.suffix.lower().lstrip("."),
            inferred_content=infer_content_type(file_path.name),
            size_bytes=file_path.stat().st_size if file_path.exists() else 0,
        )

        if not file_path.exists():
            metadata.is_corrupted = True
            metadata.error_message = f"File not found: {file_path}"
            return ProcessedFile(metadata=metadata)

        try:
            # Try to open the Excel file
            excel_file = self._open_excel_file(file_path, password)

            if excel_file is None:
                # Password required
                metadata.requires_password = True
                metadata.error_message = "File is password-protected"
                return ProcessedFile(metadata=metadata)

            # Process all sheets
            tabular_data: Dict[str, pd.DataFrame] = {}
            total_rows = 0

            metadata.sheet_names = excel_file.sheet_names

            for sheet_name in excel_file.sheet_names:
                try:
                    df = excel_file.parse(sheet_name)

                    # Skip empty sheets
                    if df.empty or len(df) == 0:
                        continue

                    # Clean column names
                    df.columns = [
                        str(col).strip() if not str(col).startswith("Unnamed")
                        else f"Column_{i}"
                        for i, col in enumerate(df.columns)
                    ]

                    # Use filename_sheetname as key
                    key = f"{file_path.stem}_{sheet_name}"
                    tabular_data[key] = df
                    total_rows += len(df)

                except Exception as e:
                    console.print(f"  [yellow]![/yellow] Error reading sheet {sheet_name}: {e}")
                    continue

            excel_file.close()

            if not tabular_data:
                metadata.is_corrupted = True
                metadata.error_message = "No valid sheets found"
                return ProcessedFile(metadata=metadata)

            metadata.row_count = total_rows
            # Re-infer content from first sheet
            first_df = list(tabular_data.values())[0]
            metadata.inferred_content = infer_content_type(file_path.name, first_df)

            return ProcessedFile(
                tabular_data=tabular_data,
                context_documents=[],
                metadata=metadata,
            )

        except Exception as e:
            error_msg = str(e).lower()
            if "password" in error_msg or "encrypted" in error_msg:
                metadata.requires_password = True
                metadata.error_message = "File is password-protected"
            else:
                metadata.is_corrupted = True
                metadata.error_message = str(e)[:200]

            return ProcessedFile(metadata=metadata)

    def get_sample(self, file_path: Path, max_rows: int = 50) -> str:
        """Get a text sample from each sheet."""
        try:
            excel_file = self._open_excel_file(file_path, password=None)
            if excel_file is None:
                return "[Password-protected file]"

            samples = []
            for sheet_name in excel_file.sheet_names[:5]:
                try:
                    df = excel_file.parse(sheet_name, nrows=max_rows)
                    if not df.empty:
                        header = f"=== Sheet: {sheet_name} ==="
                        samples.append(f"{header}\n{df.to_csv(index=False)}")
                except Exception:
                    continue

            excel_file.close()
            return "\n\n".join(samples) if samples else "[No readable sheets]"

        except Exception as e:
            return f"[Error: {e}]"

    def _open_excel_file(
        self, file_path: Path, password: Optional[str] = None
    ) -> Optional[pd.ExcelFile]:
        """Open an Excel file, handling password protection."""
        suffix = file_path.suffix.lower()

        try:
            if suffix == ".xlsx":
                # Try opening with openpyxl
                from openpyxl import load_workbook

                try:
                    # Test if file is readable
                    wb = load_workbook(file_path, read_only=True, data_only=True)
                    wb.close()
                    return pd.ExcelFile(file_path, engine="openpyxl")

                except Exception as e:
                    if "password" in str(e).lower() or "encrypted" in str(e).lower():
                        if password:
                            return self._decrypt_xlsx(file_path, password)
                        return None
                    raise

            else:
                # .xls files
                return pd.ExcelFile(file_path)

        except Exception as e:
            if "password" in str(e).lower() or "encrypted" in str(e).lower():
                return None
            raise

    def _decrypt_xlsx(
        self, file_path: Path, password: str
    ) -> Optional[pd.ExcelFile]:
        """Attempt to decrypt a password-protected XLSX."""
        try:
            import msoffcrypto
            import io

            decrypted = io.BytesIO()
            with open(file_path, "rb") as f:
                office_file = msoffcrypto.OfficeFile(f)
                if office_file.is_encrypted():
                    office_file.load_key(password=password)
                    office_file.decrypt(decrypted)
                    decrypted.seek(0)
                    return pd.ExcelFile(decrypted, engine="openpyxl")
                else:
                    return pd.ExcelFile(file_path, engine="openpyxl")

        except ImportError:
            console.print("  [yellow]![/yellow] msoffcrypto not installed for decryption")
            return None
        except Exception:
            return None
