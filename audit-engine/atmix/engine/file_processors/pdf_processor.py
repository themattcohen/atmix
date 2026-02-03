"""PDF file processor with text extraction, OCR, and document type detection."""

import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from rich.console import Console

from .base import (
    ContextDocument,
    FileMetadata,
    FileProcessor,
    ProcessedFile,
    infer_content_type,
)

console = Console()

# Optional dependency flags
PDFPLUMBER_AVAILABLE = False
PYPDF_AVAILABLE = False
PYTESSERACT_AVAILABLE = False
PDF2IMAGE_AVAILABLE = False
OPENAI_AVAILABLE = False

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    pass

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    pass

try:
    import pytesseract
    PYTESSERACT_AVAILABLE = True
except ImportError:
    pass

try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    pass

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    pass


class PDFProcessor(FileProcessor):
    """Processor for PDF files with text extraction, OCR, and document analysis."""

    EXTENSIONS = [".pdf"]
    LARGE_PAGE_THRESHOLD = 20
    MIN_TEXT_PER_PAGE = 50  # Chars per page to consider it has text

    def __init__(self):
        """Initialize PDF processor and check dependencies."""
        self._log_dependencies()

    def _log_dependencies(self):
        """Log which dependencies are available."""
        missing = []
        if not PDFPLUMBER_AVAILABLE:
            missing.append("pdfplumber")
        if not PYPDF_AVAILABLE:
            missing.append("pypdf")
        if not PYTESSERACT_AVAILABLE:
            missing.append("pytesseract")
        if not PDF2IMAGE_AVAILABLE:
            missing.append("pdf2image")
        if not OPENAI_AVAILABLE:
            missing.append("openai")

        if missing:
            console.print(f"[dim]PDF processor optional dependencies missing: {', '.join(missing)}[/dim]")

    def can_process(self, file_path: Path) -> bool:
        """Check if this processor can handle the file."""
        return file_path.suffix.lower() in self.EXTENSIONS

    def process(
        self, file_path: Path, password: Optional[str] = None
    ) -> ProcessedFile:
        """Process a PDF file and extract content.

        Args:
            file_path: Path to the PDF file
            password: Optional password for encrypted PDFs

        Returns:
            ProcessedFile with context documents and metadata
        """
        metadata = FileMetadata(
            filename=file_path.name,
            file_type="pdf",
            inferred_content=infer_content_type(file_path.name),
            size_bytes=file_path.stat().st_size if file_path.exists() else 0,
        )

        if not file_path.exists():
            metadata.is_corrupted = True
            metadata.error_message = f"File not found: {file_path}"
            return ProcessedFile(metadata=metadata)

        # Check for encryption
        is_encrypted, page_count = self._check_pdf(file_path)

        if is_encrypted and not password:
            metadata.requires_password = True
            metadata.error_message = "PDF is password-protected"
            return ProcessedFile(metadata=metadata)

        metadata.page_count = page_count

        # Extract text
        extracted_text = self._extract_text(file_path, password)

        if not extracted_text or len(extracted_text.strip()) < 50:
            # Try OCR if native extraction fails
            if PYTESSERACT_AVAILABLE and PDF2IMAGE_AVAILABLE:
                extracted_text = self._run_ocr(file_path)

        if not extracted_text:
            metadata.error_message = "Could not extract text from PDF"
            return ProcessedFile(metadata=metadata)

        # Detect document type
        doc_type = self._detect_document_type(extracted_text)
        metadata.inferred_content = self._doc_type_to_display(doc_type)

        # Parse structured data for known types
        structured_data = {}
        if doc_type == "quickbooks_health_report":
            structured_data = self._parse_qb_health_report(extracted_text)

        # Create context document
        context_doc = ContextDocument(
            filename=file_path.name,
            document_type=doc_type,
            extracted_text=extracted_text,
            structured_data=structured_data,
            confidence=0.8 if doc_type != "unknown_document" else 0.5,
        )

        return ProcessedFile(
            tabular_data={},  # PDFs typically don't have tabular data
            context_documents=[context_doc],
            metadata=metadata,
        )

    def get_sample(self, file_path: Path, max_rows: int = 50) -> str:
        """Get a text sample from the PDF (first few pages)."""
        text = self._extract_text(file_path, password=None)
        if not text:
            return "[Could not extract text from PDF]"
        # Return first ~3000 chars
        if len(text) > 3000:
            return text[:3000] + "\n... [truncated]"
        return text

    def _check_pdf(self, file_path: Path) -> tuple:
        """Check if PDF is encrypted and get page count."""
        if not PYPDF_AVAILABLE:
            return False, 0

        try:
            with open(file_path, "rb") as f:
                reader = pypdf.PdfReader(f)
                is_encrypted = reader.is_encrypted
                page_count = len(reader.pages) if not is_encrypted else 0
                return is_encrypted, page_count
        except Exception:
            return False, 0

    def _extract_text(self, file_path: Path, password: Optional[str]) -> str:
        """Extract text from PDF using available libraries."""
        text_parts = []

        # Try pdfplumber first (best quality)
        if PDFPLUMBER_AVAILABLE:
            try:
                with pdfplumber.open(file_path, password=password) as pdf:
                    for page in pdf.pages[:50]:  # Limit pages
                        page_text = page.extract_text()
                        if page_text:
                            text_parts.append(page_text)
                if text_parts:
                    return "\n\n".join(text_parts)
            except Exception:
                pass

        # Fall back to pypdf
        if PYPDF_AVAILABLE:
            try:
                with open(file_path, "rb") as f:
                    reader = pypdf.PdfReader(f)
                    if reader.is_encrypted and password:
                        reader.decrypt(password)
                    for page in reader.pages[:50]:
                        page_text = page.extract_text()
                        if page_text:
                            text_parts.append(page_text)
                if text_parts:
                    return "\n\n".join(text_parts)
            except Exception:
                pass

        return ""

    def _run_ocr(self, file_path: Path) -> str:
        """Run OCR on PDF pages."""
        if not (PYTESSERACT_AVAILABLE and PDF2IMAGE_AVAILABLE):
            return ""

        try:
            images = convert_from_path(file_path, first_page=1, last_page=10)
            text_parts = []
            for img in images:
                text = pytesseract.image_to_string(img)
                if text.strip():
                    text_parts.append(text)
            return "\n\n".join(text_parts)
        except Exception as e:
            console.print(f"  [yellow]![/yellow] OCR failed: {e}")
            return ""

    def _detect_document_type(self, text: str) -> str:
        """Detect document type from extracted text."""
        text_lower = text.lower()

        # QuickBooks health report
        if "quickbooks" in text_lower and (
            "banking activity" in text_lower
            or "company setup" in text_lower
            or "opening balance equity" in text_lower
        ):
            return "quickbooks_health_report"

        # Bank statement
        if "account statement" in text_lower or "bank statement" in text_lower:
            return "bank_statement"

        # Invoice
        if "invoice" in text_lower and (
            "amount due" in text_lower or "total due" in text_lower
        ):
            return "invoice"

        # Tax forms
        if any(
            pattern in text_lower
            for pattern in ["form 1099", "form w-2", "form w-9", "1099-misc", "1099-nec"]
        ):
            return "tax_form"

        return "unknown_document"

    def _doc_type_to_display(self, doc_type: str) -> str:
        """Convert internal doc type to display name."""
        display_names = {
            "quickbooks_health_report": "QuickBooks Health Report",
            "bank_statement": "Bank Statement",
            "invoice": "Invoice",
            "tax_form": "Tax Form",
            "unknown_document": "Document",
        }
        return display_names.get(doc_type, "Document")

    def _parse_qb_health_report(self, text: str) -> Dict[str, Any]:
        """Parse structured data from QuickBooks health report."""
        data: Dict[str, Any] = {
            "accounts": [],
            "issues": [],
            "reconciliation_status": {},
        }

        # Opening balance equity
        match = re.search(
            r"opening\s+balance\s+equity[:\s]*\$?([\d,]+\.?\d*)",
            text,
            re.IGNORECASE,
        )
        if match:
            try:
                data["opening_balance_equity"] = float(
                    match.group(1).replace(",", "")
                )
            except ValueError:
                pass

        # Check for reconciliation issues
        if "never reconciled" in text.lower():
            data["reconciliation_status"]["has_unreconciled"] = True

        # Check for negative balances
        if "negative" in text.lower() and (
            "asset" in text.lower() or "liability" in text.lower()
        ):
            data["issues"].append("negative_balances")

        # Uncategorized items
        if "uncategorized" in text.lower():
            data["issues"].append("uncategorized_transactions")

        # Extract account names mentioned
        account_patterns = [
            r"(checking|savings|paypal|amazon|credit card|business prime)",
        ]
        for pattern in account_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for m in matches:
                if m.lower() not in [a.lower() for a in data["accounts"]]:
                    data["accounts"].append(m)

        return data
