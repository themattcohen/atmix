"""
Extract ground truth balances from RBC bank statement PDFs for FBAR reporting.

Reads 24 PDFs (12 chequing, 12 savings) from the Downloads/frye folder
and extracts:
  - Account numbers
  - Closing balance for each month
  - All intra-period daily running balances from transaction details
  - Maximum account value across all 12 months (for FBAR max value)

Usage: python extract-pdf-ground-truth.py
"""

import os
import re
import pdfplumber
from collections import defaultdict

PDF_DIR = r"C:\Users\1matt\Downloads\frye"


def extract_all_text(pdf_path: str) -> str:
    """Extract all text from all pages of a PDF."""
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
    return full_text


def parse_account_number(text: str) -> str | None:
    """Extract account number like '06550-5448030' from statement text."""
    # Pattern: "Youraccountnumber: XXXXX-XXXXXXX" (text is concatenated)
    match = re.search(r"Youraccountnumber:\s*(\d{5}-\d{7})", text)
    if match:
        return match.group(1)
    # Fallback: look in summary section
    match = re.search(r"(\d{5}-\d{7})", text)
    return match.group(1) if match else None


def parse_closing_balance(text: str) -> float | None:
    """Extract closing balance from the summary section."""
    # Pattern: "YourclosingbalanceonXXX =$ X,XXX.XX" or "ClosingBalance $X,XXX.XX"
    # The text has no spaces, so look for patterns like:
    # "YourclosingbalanceonJanuary9,2025 =$1,265.54"
    # "ClosingBalance $1,265.54"

    # Try the summary line first
    match = re.search(r"Yourclosingbalanceon[A-Za-z0-9,]+\s*=\$([0-9,]+\.\d{2})", text)
    if match:
        return parse_dollar(match.group(1))

    # Try the detail section closing balance
    match = re.search(r"ClosingBalance\s*\$([0-9,]+\.\d{2})", text)
    if match:
        return parse_dollar(match.group(1))

    return None


def parse_opening_balance(text: str) -> float | None:
    """Extract opening balance from the summary section."""
    match = re.search(r"YouropeningbalanceonDecember\S+\s*\$([0-9,]+\.\d{2})", text)
    if not match:
        match = re.search(r"Youropeningbalanceon\S+\s*\$([0-9,]+\.\d{2})", text)
    if match:
        return parse_dollar(match.group(1))
    return None


def parse_dollar(s: str) -> float:
    """Convert a dollar string like '1,265.54' to float."""
    return float(s.replace(",", ""))


def extract_all_balances(text: str) -> list[float]:
    """
    Extract all running balance values from the transaction detail section.

    In the RBC statement, the transaction table has columns:
      Date | Description | Withdrawals($) | Deposits($) | Balance($)

    The balance column appears as the last dollar amount on lines that
    show a running balance. We need to find ALL such balance values
    to determine the maximum account value during each statement period.

    RBC statement layout (confirmed by analysis):
    - Lines with 2 dollar amounts: first = withdrawal/deposit, last = running balance
    - Lines with 1 dollar amount: just a transaction amount (no balance shown)
    - Lines with 0 amounts: description continuation or non-financial text
    - "OpeningBalance" line: single amount = the opening balance
    - Max amounts per line: 2 (never 3+)

    We ONLY extract balances from lines with 2 amounts (last = balance)
    or the OpeningBalance line. Lines with 1 amount are transaction values,
    not running balances.
    """
    balances = []

    lines = text.split("\n")
    in_detail_section = False

    for line in lines:
        # Detect start of detail section
        if "Detailsofyouraccountactivity" in line:
            in_detail_section = True
            continue

        # Detect end of detail section
        if "Importantinformationaboutyouraccount" in line:
            in_detail_section = False
            continue

        if "ClosingBalance" in line:
            in_detail_section = False
            continue

        if not in_detail_section:
            continue

        # Skip header lines
        if "Date" in line and "Description" in line and "Balance" in line:
            continue

        if "Noactivityforthisperiod" in line:
            continue

        # Find all dollar amounts in the line
        amounts = re.findall(r"(\d{1,3}(?:,\d{3})*\.\d{2})", line)

        if not amounts:
            continue

        # OpeningBalance line: single amount is the opening running balance
        if "OpeningBalance" in line:
            balances.append(parse_dollar(amounts[-1]))
            continue

        # Lines with 2 amounts: transaction amount + running balance
        # The last amount is always the running balance
        if len(amounts) >= 2:
            balances.append(parse_dollar(amounts[-1]))

        # Lines with 1 amount: just a transaction value (withdrawal or deposit)
        # NOT a running balance - skip these

    return balances


def parse_statement_period(text: str) -> str:
    """Extract the statement period from the text."""
    match = re.search(r"From([A-Z][a-z]+\d{1,2},\d{4})to([A-Z][a-z]+\d{1,2},\d{4})", text)
    if match:
        return f"{match.group(1)} to {match.group(2)}"
    # Try with spaces
    match = re.search(r"From\s*(\w+\s*\d{1,2}\s*,\s*\d{4})\s*to\s*(\w+\s*\d{1,2}\s*,\s*\d{4})", text)
    if match:
        return f"{match.group(1)} to {match.group(2)}"
    return "Unknown period"


def determine_account_type(filename: str) -> str:
    """Determine account type from filename."""
    if "Chequing" in filename:
        return "Chequing"
    elif "Savings" in filename:
        return "Savings"
    return "Unknown"


def main():
    print("=" * 80)
    print("RBC Bank Statement Ground Truth Extraction for FBAR Reporting")
    print("=" * 80)
    print()

    # Collect all PDF files
    pdf_files = sorted([f for f in os.listdir(PDF_DIR) if f.endswith(".pdf")])
    print(f"Found {len(pdf_files)} PDF files\n")

    # Data structure: account_number -> { type, balances_by_month, all_balances }
    accounts = defaultdict(lambda: {
        "type": "",
        "account_number": "",
        "months": [],
        "closing_balances": [],
        "all_running_balances": [],
        "opening_balances": [],
    })

    for filename in pdf_files:
        filepath = os.path.join(PDF_DIR, filename)
        account_type = determine_account_type(filename)

        print(f"Processing: {filename}")

        text = extract_all_text(filepath)

        # Extract account number
        acct_num = parse_account_number(text)
        if not acct_num:
            print(f"  WARNING: Could not extract account number from {filename}")
            continue

        # Extract period
        period = parse_statement_period(text)

        # Extract closing balance
        closing = parse_closing_balance(text)

        # Extract opening balance
        opening = parse_opening_balance(text)

        # Extract all running balances from transaction details
        running_balances = extract_all_balances(text)

        # Find the max balance in this statement
        all_period_balances = running_balances.copy()
        if closing is not None:
            all_period_balances.append(closing)
        if opening is not None:
            all_period_balances.append(opening)

        max_in_period = max(all_period_balances) if all_period_balances else 0.0

        # Store data
        key = acct_num
        accounts[key]["type"] = account_type
        accounts[key]["account_number"] = acct_num
        accounts[key]["months"].append(period)
        accounts[key]["closing_balances"].append(closing if closing else 0.0)
        accounts[key]["all_running_balances"].extend(all_period_balances)
        if opening is not None:
            accounts[key]["opening_balances"].append(opening)

        print(f"  Account: {acct_num} ({account_type})")
        print(f"  Period: {period}")
        print(f"  Opening: ${opening:,.2f}" if opening else "  Opening: N/A")
        print(f"  Closing: ${closing:,.2f}" if closing else "  Closing: N/A")
        print(f"  Running balances found: {len(running_balances)}")
        print(f"  Max balance in period: ${max_in_period:,.2f}")
        print()

    # Summary
    print("=" * 80)
    print("FBAR GROUND TRUTH SUMMARY")
    print("=" * 80)
    print()

    for acct_num, data in sorted(accounts.items()):
        acct_type = data["type"]
        closing_balances = data["closing_balances"]
        all_balances = data["all_running_balances"]

        max_closing = max(closing_balances) if closing_balances else 0.0
        max_overall = max(all_balances) if all_balances else 0.0

        print(f"Bank Name:        Royal Bank of Canada (RBC)")
        print(f"Account Number:   {acct_num}")
        print(f"Account Type:     {acct_type}")
        print(f"Currency:         CAD (Canadian Dollar)")
        print(f"Country:          Canada")
        print(f"Statements:       {len(data['months'])} months")
        print(f"Max Closing Bal:  ${max_closing:,.2f}")
        print(f"MAX ACCOUNT VALUE (FBAR): ${max_overall:,.2f}")
        print()

        # Show monthly closing balances
        print(f"  Monthly Closing Balances:")
        for i, (period, closing) in enumerate(zip(data["months"], closing_balances)):
            marker = " <-- MAX CLOSING" if closing == max_closing else ""
            print(f"    {period}: ${closing:,.2f}{marker}")
        print()

        # Show the top 5 highest intra-period balances
        if all_balances:
            top_balances = sorted(set(all_balances), reverse=True)[:5]
            print(f"  Top 5 Highest Balances (any point during year):")
            for b in top_balances:
                marker = " <-- FBAR MAX" if b == max_overall else ""
                print(f"    ${b:,.2f}{marker}")
        print()
        print("-" * 60)
        print()


if __name__ == "__main__":
    main()
