"""PDF validation — magic bytes, size, text extraction, multi-account detection."""
from __future__ import annotations
from pathlib import Path
from utils.logger import log


def is_valid_pdf(file_path: str | Path) -> bool:
    """Check if file has valid PDF magic bytes and minimum size.

    Args:
        file_path: Path to the downloaded file

    Returns:
        True if file looks like a valid PDF (magic bytes + size > 1KB)
    """
    path = Path(file_path)
    if not path.exists():
        log.warning(f"PDF file not found: {path}")
        return False

    # Size check (> 1KB)
    size = path.stat().st_size
    if size < 1024:
        log.warning(f"PDF too small ({size} bytes): {path}")
        return False

    # Magic bytes check
    with open(path, "rb") as f:
        header = f.read(5)

    if not header.startswith(b"%PDF"):
        log.warning(f"Invalid PDF magic bytes: {path}")
        return False

    return True


def extract_pdf_text(file_path: str | Path, max_pages: int = 5) -> str:
    """Extract text from a PDF file using pdfplumber.

    Args:
        file_path: Path to the PDF
        max_pages: Maximum number of pages to extract (default 5, enough for validation)

    Returns:
        Extracted text as a string. Empty string if extraction fails.
    """
    import pdfplumber

    path = Path(file_path)
    text_parts = []

    try:
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages):
                if i >= max_pages:
                    break
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        log.warning(f"PDF text extraction failed for {path}: {e}")
        return ""

    return "\n\n".join(text_parts)


def detect_multi_account(pdf_text: str) -> list[str]:
    """Detect if a PDF contains statements for multiple accounts.

    Scans for patterns like "Account ending in XXXX" or "Account #...XXXX".

    Args:
        pdf_text: Extracted text from the PDF

    Returns:
        List of last-4 digits found. If len > 1, it's a combined statement.
    """
    import re

    # Common patterns for account numbers in statements
    patterns = [
        r'(?:account|acct)[\s#:]*(?:ending\s+in\s+|\.{3,}|x{3,}|[\*]{3,})(\d{4})',
        r'(?:account|acct)\s+(?:number|#|no\.?)\s*[:\s].*?(\d{4})\b',
        r'x{3,}(\d{4})',
        r'\*{3,}(\d{4})',
        r'\.{3,}(\d{4})',
    ]

    found: set[str] = set()
    for pattern in patterns:
        matches = re.findall(pattern, pdf_text, re.IGNORECASE)
        found.update(matches)

    return sorted(found)
