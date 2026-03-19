"""File manager — rename, organize, and sanitize downloaded statements."""
from __future__ import annotations
import re
import shutil
import time
from pathlib import Path
from utils.logger import log
from config import OUTPUT_DIR, OUTPUT_FILENAME_TEMPLATE


def sanitize_filename(name: str) -> str:
    """Remove or replace characters that are unsafe for filenames.

    Keeps alphanumeric, spaces, hyphens, underscores, dots, and #.
    Replaces & with 'and', removes apostrophes, strips other specials.
    """
    name = name.replace("&", "and")
    name = name.replace("'", "")
    name = re.sub(r"[^a-zA-Z0-9 \-_.#]", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def build_output_filename(
    client_name: str,
    bank_name: str,
    account_last4: str,
    target_month: str,
) -> str:
    """Build the standardized output filename.

    Format: "ClientName__Bank Name #xxxx yyyy-mm.pdf"

    Args:
        client_name: The file_safe_name from the spreadsheet
        bank_name: Bank name
        account_last4: Last 4 digits of account
        target_month: "yyyy-mm" format
    """
    safe_client = sanitize_filename(client_name)
    safe_bank = sanitize_filename(bank_name)

    return OUTPUT_FILENAME_TEMPLATE.format(
        client=safe_client,
        bank=safe_bank,
        last4=account_last4,
        year_month=target_month,
    )


def organize_statement(
    source_path: str | Path,
    client_name: str,
    bank_name: str,
    account_last4: str,
    target_month: str,
) -> Path:
    """Move a downloaded PDF to the organized output directory.

    Creates: output/yyyy-mm/ClientName__Bank Name #xxxx yyyy-mm.pdf

    Args:
        source_path: Path to the downloaded PDF in the temp download dir
        client_name: file_safe_name
        bank_name: Bank name
        account_last4: Last 4 digits
        target_month: "yyyy-mm"

    Returns:
        Path to the final organized file
    """
    source = Path(source_path)
    if not source.exists():
        raise FileNotFoundError(f"Source PDF not found: {source}")

    # Create output directory: output/yyyy-mm/
    month_dir = OUTPUT_DIR / target_month
    month_dir.mkdir(parents=True, exist_ok=True)

    # Build filename
    filename = build_output_filename(client_name, bank_name, account_last4, target_month)
    dest = month_dir / filename

    # If file already exists, don't overwrite — add suffix
    if dest.exists():
        stem = dest.stem
        for i in range(1, 100):
            alt = month_dir / f"{stem} ({i}).pdf"
            if not alt.exists():
                dest = alt
                break

    shutil.move(str(source), str(dest))
    log.info(f"Statement saved: {dest.relative_to(OUTPUT_DIR.parent)}")
    return dest


def organize_combined_statement(
    source_path: str | Path,
    client_name: str,
    bank_name: str,
    account_last4s: list[str],
    target_month: str,
) -> list[Path]:
    """Handle a combined PDF that contains multiple accounts.

    Creates a copy for each account in the standard naming format.

    Args:
        source_path: Path to the combined PDF
        client_name: file_safe_name
        bank_name: Bank name
        account_last4s: List of last-4 digits found in the PDF
        target_month: "yyyy-mm"

    Returns:
        List of paths to all created files
    """
    source = Path(source_path)
    results = []

    month_dir = OUTPUT_DIR / target_month
    month_dir.mkdir(parents=True, exist_ok=True)

    for last4 in account_last4s:
        filename = build_output_filename(client_name, bank_name, last4, target_month)
        dest = month_dir / filename

        if dest.exists():
            stem = dest.stem
            for i in range(1, 100):
                alt = month_dir / f"{stem} ({i}).pdf"
                if not alt.exists():
                    dest = alt
                    break

        shutil.copy2(str(source), str(dest))
        log.info(f"Combined statement copy: {dest.relative_to(OUTPUT_DIR.parent)}")
        results.append(dest)

    # Remove the original temp file
    source.unlink(missing_ok=True)

    return results


def clear_download_dir(download_dir: str | Path) -> None:
    """Clear all files from a download directory (before starting a new job)."""
    path = Path(download_dir)
    if not path.exists():
        return
    for f in path.iterdir():
        if f.is_file():
            f.unlink()


def find_downloaded_pdf(download_dir: str | Path, timeout_seconds: int = 30) -> Path | None:
    """Wait for a PDF to appear in the download directory.

    Args:
        download_dir: Directory to watch
        timeout_seconds: How long to wait

    Returns:
        Path to the PDF, or None if timeout
    """
    path = Path(download_dir)
    start = time.time()

    while time.time() - start < timeout_seconds:
        # Look for PDF files (ignore .crdownload, .tmp, .part)
        pdfs = [f for f in path.iterdir()
                if f.is_file() and f.suffix.lower() == ".pdf" and f.stat().st_size > 0]
        if pdfs:
            # Return the most recently modified one
            return max(pdfs, key=lambda f: f.stat().st_mtime)
        time.sleep(1)

    log.warning(f"No PDF found in {path} after {timeout_seconds}s")
    return None
