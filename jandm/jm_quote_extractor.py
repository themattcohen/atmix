#!/usr/bin/env python3
"""
J&M Aircraft Quotation PDF Extractor
Converts J&M Aircraft quotation PDFs to CSV and Markdown formats.

Usage:
    python jm_quote_extractor.py "path/to/quotation.pdf"
    python jm_quote_extractor.py "path/to/quotation.pdf" --format csv
    python jm_quote_extractor.py "path/to/quotation.pdf" --format md
    python jm_quote_extractor.py "path/to/quotation.pdf" --format all
"""

import re
import csv
import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

try:
    import pdfplumber
except ImportError:
    print("pdfplumber not installed. Install with: pip install pdfplumber")
    exit(1)


@dataclass
class LineItem:
    """Represents a single line item from the quotation."""
    item_num: int
    part_number: str
    description: str
    cd: str  # Condition code (NE, OH, SV, etc.)
    qty: float
    unit_price: float
    line_amt: float
    delivery_terms: str = ""
    notes: str = ""


@dataclass
class QuoteHeader:
    """Represents the quotation header information."""
    quote_number: str
    date: str
    time: str
    items_count: int
    page_count: int
    prepared_by: str
    code: str = ""
    ref: str = ""
    terms: str = ""


@dataclass
class Address:
    """Represents an address block."""
    attention: str = ""
    company: str = ""
    address_lines: list = field(default_factory=list)
    phone: str = ""
    fax: str = ""
    email: str = ""
    contact: str = ""


@dataclass
class QuoteTotals:
    """Represents the quotation totals."""
    subtotal: float = 0.0
    misc_charge: float = 0.0
    freight: float = 0.0
    total: float = 0.0


@dataclass
class Quotation:
    """Complete quotation data structure."""
    header: QuoteHeader
    from_address: Address
    to_address: Address
    ship_to_address: Address
    line_items: list  # List[LineItem]
    totals: QuoteTotals


class JMQuoteExtractor:
    """Extracts data from J&M Aircraft quotation PDFs."""

    # From address is always J&M Aircraft
    JM_FROM = Address(
        company="J and M Aircraft",
        address_lines=["7021 RADFORD AVE", "NORTH HOLLYWOOD, CA 91605", "USA"],
        phone="818-982-9030",
        fax="818-503-9247",
        email="QUOTES@JANDM-AIRCRAFT.COM"
    )

    def __init__(self, pdf_path: str):
        self.pdf_path = Path(pdf_path)
        self.raw_text = ""
        self.pages_text = []

    def extract(self) -> Quotation:
        """Main extraction method."""
        with pdfplumber.open(self.pdf_path) as pdf:
            self.pages_text = [page.extract_text() or "" for page in pdf.pages]
            self.raw_text = "\n".join(self.pages_text)

        header = self._parse_header()
        to_address = self._parse_to_address()
        ship_to = self._parse_ship_to_address()
        line_items = self._parse_line_items()
        totals = self._parse_totals()

        return Quotation(
            header=header,
            from_address=self.JM_FROM,
            to_address=to_address,
            ship_to_address=ship_to,
            line_items=line_items,
            totals=totals
        )

    def _parse_header(self) -> QuoteHeader:
        """Extract header information from the first page."""
        text = self.pages_text[0] if self.pages_text else self.raw_text

        # Quote number
        quote_match = re.search(r'Quote\s*#?:?\s*(\d+)', text, re.IGNORECASE)
        quote_number = quote_match.group(1) if quote_match else ""

        # Date - look for the date in header section
        date_match = re.search(r'Date:\s*(\d{1,2}/\d{1,2}/\d{4})', text)
        date = date_match.group(1) if date_match else ""

        # Time
        time_match = re.search(r'Time:\s*(\d{1,2}:\d{2}:\d{2}\s*[AP]M)', text)
        time = time_match.group(1) if time_match else ""

        # Items count
        items_match = re.search(r'#\s*of\s*Items:\s*(\d+)', text)
        items_count = int(items_match.group(1)) if items_match else 0

        # Page count (from last page)
        page_count = len(self.pages_text)

        # Prepared by - get initials/name after "Prepared By:"
        prep_match = re.search(r'Prepared\s*By:\s*([A-Z][A-Z\s]{0,20}?)(?:\n|$)', text)
        prepared_by = prep_match.group(1).strip() if prep_match else ""

        # Code
        code_match = re.search(r'Code:\s*(\d+)', text)
        code = code_match.group(1) if code_match else ""

        # Reference
        ref_match = re.search(r'Ref\s*#:\s*(\w+)', text)
        ref = ref_match.group(1) if ref_match else ""

        # Terms
        terms_match = re.search(r'Terms:\s*([A-Z0-9\s]+?)(?:Email|$)', text)
        terms = terms_match.group(1).strip() if terms_match else ""

        return QuoteHeader(
            quote_number=quote_number,
            date=date,
            time=time,
            items_count=items_count,
            page_count=page_count,
            prepared_by=prepared_by,
            code=code,
            ref=ref,
            terms=terms
        )

    def _parse_to_address(self) -> Address:
        """Extract the 'To:' address block."""
        text = self.pages_text[0] if self.pages_text else self.raw_text

        attention = ""
        company = ""
        address_lines = []

        # The PDF has "To: Ship To:" on same line, then addresses in columns
        # Pattern: ATTN: NAME NAME\n COMPANY COMPANY\n ...
        # We need to extract the left column (To:) address

        # Find ATTN line - format is "ATTN: NAME ATTN: NAME" for both columns
        attn_match = re.search(r'ATTN:\s*([A-Z][A-Z\s]+?)(?:\s+ATTN:|$)', text)
        if attn_match:
            attention = attn_match.group(1).strip()

        # Find the address block between "To:" and "Quote Date:"
        # The text shows lines like "AIR FRANCE AIR FRANCE" where left is To, right is Ship To
        address_block = re.search(
            r'To:\s*Ship\s*To:\s*\n(.*?)(?=Quote\s*Date:)',
            text,
            re.DOTALL | re.IGNORECASE
        )

        if address_block:
            lines = address_block.group(1).strip().split('\n')
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                # Skip ATTN lines
                if line.startswith('ATTN:'):
                    continue
                # For two-column layout, take first half of long lines
                # or recognize known patterns
                parts = line.split()
                if len(parts) >= 2:
                    # Check if it's a duplicated company name like "AIR FRANCE AIR FRANCE"
                    mid = len(parts) // 2
                    left_part = ' '.join(parts[:mid])
                    right_part = ' '.join(parts[mid:])
                    if left_part == right_part:
                        # Duplicated - use just the left
                        if not company:
                            company = left_part
                        else:
                            address_lines.append(left_part)
                    else:
                        # Not duplicated - might be single column or different data
                        # Take the whole line as To address
                        if not company:
                            company = line
                        else:
                            address_lines.append(line)

        # Extract contact info from header area
        contact_match = re.search(r'Contact:\s*([^\n]+)', text)
        contact = contact_match.group(1).strip() if contact_match else ""

        email_match = re.search(r'Email:\s*([^\s]+@[^\s]+)', text)
        email = email_match.group(1).strip() if email_match else ""

        phone_match = re.search(r'Phone\s*#:\s*([\d\s-]+)', text)
        phone = phone_match.group(1).strip() if phone_match else ""

        fax_match = re.search(r'Fax\s*#:\s*([\d\s-]+)', text)
        fax = fax_match.group(1).strip() if fax_match else ""

        return Address(
            attention=attention,
            company=company,
            address_lines=address_lines[:5],
            phone=phone,
            fax=fax,
            email=email,
            contact=contact
        )

    def _parse_ship_to_address(self) -> Address:
        """Extract the 'Ship To:' address block."""
        text = self.pages_text[0] if self.pages_text else self.raw_text

        # Find Ship To: section
        ship_match = re.search(
            r'Ship\s*To:\s*\n?(ATTN:?\s*([^\n]+)\n)?([^\n]+)\n(.*?)(?=Quote\s*Date:|Ref\s*#:|$)',
            text,
            re.DOTALL | re.IGNORECASE
        )

        if not ship_match:
            return Address()

        attention = ship_match.group(2).strip() if ship_match.group(2) else ""
        company = ship_match.group(3).strip() if ship_match.group(3) else ""

        remaining = ship_match.group(4) if ship_match.group(4) else ""
        address_lines = [line.strip() for line in remaining.split('\n')
                        if line.strip() and not line.strip().startswith('ATTN')]

        return Address(
            attention=attention,
            company=company,
            address_lines=address_lines[:5]
        )

    def _parse_line_items(self) -> list:
        """Extract all line items from all pages."""
        items = []

        # Pattern to match line items
        # Format: Item# PartNumber Description CD Qty UnitPrice LineAmt
        # Example: 1 2ASPPSV08 SLEEVE NE 5.00 $50.00EA $250.00
        item_pattern = re.compile(
            r'^(\d+)\s+'  # Item number
            r'(\S+)\s+'   # Part number
            r'([A-Z][A-Z\s\-/]+?)\s+'  # Description (uppercase words)
            r'(NE|OH|SV|NS|AR|FN|RP|OV)\s+'  # Condition code
            r'([\d,]+\.?\d*)\s+'  # Quantity
            r'\$([\d,]+\.?\d*)EA\s+'  # Unit price
            r'\$([\d,]+\.?\d*)',  # Line amount
            re.MULTILINE
        )

        for page_text in self.pages_text:
            # Find all matches on this page
            for match in item_pattern.finditer(page_text):
                item_num = int(match.group(1))
                part_number = match.group(2).strip()
                description = match.group(3).strip()
                cd = match.group(4).strip()
                qty = float(match.group(5).replace(',', ''))
                unit_price = float(match.group(6).replace(',', ''))
                line_amt = float(match.group(7).replace(',', ''))

                # Try to get delivery terms (usually follows the item)
                delivery_terms = ""
                delivery_match = re.search(
                    rf'{re.escape(match.group(0))}.*?Delivery\s*Terms:\s*([^\n]+)',
                    page_text,
                    re.DOTALL
                )
                if delivery_match:
                    delivery_terms = delivery_match.group(1).strip()

                items.append(LineItem(
                    item_num=item_num,
                    part_number=part_number,
                    description=description,
                    cd=cd,
                    qty=qty,
                    unit_price=unit_price,
                    line_amt=line_amt,
                    delivery_terms=delivery_terms
                ))

        # Sort by item number and deduplicate
        items = sorted(items, key=lambda x: x.item_num)
        seen = set()
        unique_items = []
        for item in items:
            if item.item_num not in seen:
                seen.add(item.item_num)
                unique_items.append(item)

        return unique_items

    def _parse_totals(self) -> QuoteTotals:
        """Extract totals from the last page."""
        text = self.pages_text[-1] if self.pages_text else self.raw_text

        def parse_amount(pattern):
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return float(match.group(1).replace(',', ''))
            return 0.0

        return QuoteTotals(
            subtotal=parse_amount(r'Sub\s*Total:\s*\$([\d,]+\.?\d*)'),
            misc_charge=parse_amount(r'Misc\s*Charge:\s*\$([\d,]+\.?\d*)'),
            freight=parse_amount(r'Freight:\s*\$([\d,]+\.?\d*)'),
            total=parse_amount(r'Total:\s*\$([\d,]+\.?\d*)')
        )


class QuoteFormatter:
    """Formats extracted quotation data into various output formats."""

    @staticmethod
    def to_csv(quote: Quotation, output_path: str):
        """Export to CSV with one row per line item."""
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)

            # Header row
            writer.writerow([
                'Quote_Number', 'Date', 'Time', 'Items_Count', 'Prepared_By',
                'To_Company', 'To_Contact', 'To_Email',
                'Item', 'Part_Number', 'Description', 'CD', 'Qty',
                'Unit_Price', 'Line_Amt', 'Delivery_Terms',
                'Sub_Total', 'Misc_Charge', 'Freight', 'Total'
            ])

            # Data rows
            for item in quote.line_items:
                writer.writerow([
                    quote.header.quote_number,
                    quote.header.date,
                    quote.header.time,
                    quote.header.items_count,
                    quote.header.prepared_by,
                    quote.to_address.company,
                    quote.to_address.contact or quote.to_address.attention,
                    quote.to_address.email,
                    item.item_num,
                    item.part_number,
                    item.description,
                    item.cd,
                    item.qty,
                    item.unit_price,
                    item.line_amt,
                    item.delivery_terms,
                    quote.totals.subtotal,
                    quote.totals.misc_charge,
                    quote.totals.freight,
                    quote.totals.total
                ])

        return output_path

    @staticmethod
    def to_markdown(quote: Quotation, output_path: str = None) -> str:
        """Export to Markdown format suitable for Claude artifacts."""
        lines = []

        # Title
        lines.append(f"# J&M Aircraft Quotation #{quote.header.quote_number}")
        lines.append("")

        # Header info
        lines.append(f"**Date:** {quote.header.date} | **Time:** {quote.header.time} | **Items:** {quote.header.items_count} | **Prepared By:** {quote.header.prepared_by}")
        lines.append("")

        # To address
        to_name = quote.to_address.contact or quote.to_address.attention
        lines.append(f"**To:** {quote.to_address.company}" + (f" - {to_name}" if to_name else ""))
        if quote.to_address.email:
            lines.append(f"**Email:** {quote.to_address.email}")
        lines.append("")

        # Line items table
        lines.append("## Line Items")
        lines.append("")
        lines.append("| Item | Part Number | Description | CD | Qty | Unit Price | Line Amt |")
        lines.append("|------|-------------|-------------|----|----|------------|----------|")

        for item in quote.line_items:
            lines.append(
                f"| {item.item_num} | {item.part_number} | {item.description} | "
                f"{item.cd} | {item.qty:.2f} | ${item.unit_price:.2f} | ${item.line_amt:.2f} |"
            )

        lines.append("")

        # Totals
        lines.append("## Totals")
        lines.append("")
        lines.append(f"| | Amount |")
        lines.append("|---|---:|")
        lines.append(f"| Sub Total | ${quote.totals.subtotal:,.2f} |")
        lines.append(f"| Misc Charge | ${quote.totals.misc_charge:,.2f} |")
        lines.append(f"| Freight | ${quote.totals.freight:,.2f} |")
        lines.append(f"| **Total** | **${quote.totals.total:,.2f}** |")
        lines.append("")

        # Footer note
        lines.append("---")
        lines.append("*From: J and M Aircraft, 7021 Radford Ave, North Hollywood, CA 91605*")

        md_content = "\n".join(lines)

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(md_content)

        return md_content

    @staticmethod
    def to_json(quote: Quotation, output_path: str = None) -> str:
        """Export to JSON format."""
        data = {
            'header': asdict(quote.header),
            'from': asdict(quote.from_address),
            'to': asdict(quote.to_address),
            'ship_to': asdict(quote.ship_to_address),
            'line_items': [asdict(item) for item in quote.line_items],
            'totals': asdict(quote.totals)
        }

        json_content = json.dumps(data, indent=2)

        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(json_content)

        return json_content


def main():
    parser = argparse.ArgumentParser(
        description='Extract data from J&M Aircraft quotation PDFs',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python jm_quote_extractor.py "Quotation #265998.pdf"
    python jm_quote_extractor.py "Quotation #265998.pdf" --format csv
    python jm_quote_extractor.py "Quotation #265998.pdf" --format md --output quote.md
    python jm_quote_extractor.py "Quotation #265998.pdf" --format all
        """
    )

    parser.add_argument('pdf_path', help='Path to the PDF quotation file')
    parser.add_argument('--format', '-f',
                       choices=['csv', 'md', 'json', 'all'],
                       default='all',
                       help='Output format (default: all)')
    parser.add_argument('--output', '-o',
                       help='Output file path (auto-generated if not specified)')
    parser.add_argument('--print-md', '-p',
                       action='store_true',
                       help='Print markdown to stdout (for copy-paste to Claude)')

    args = parser.parse_args()

    # Validate input
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"Error: File not found: {pdf_path}")
        return 1

    # Extract data
    print(f"Extracting data from: {pdf_path.name}")
    extractor = JMQuoteExtractor(str(pdf_path))
    quote = extractor.extract()

    print(f"  Quote #: {quote.header.quote_number}")
    print(f"  Date: {quote.header.date}")
    print(f"  Items: {len(quote.line_items)} line items extracted")
    print(f"  Total: ${quote.totals.total:,.2f}")
    print()

    # Generate output filename base
    base_name = args.output or f"quote_{quote.header.quote_number}"
    base_path = Path(base_name).with_suffix('')

    # Output based on format
    formatter = QuoteFormatter()

    if args.format in ['csv', 'all']:
        csv_path = str(base_path) + '.csv'
        formatter.to_csv(quote, csv_path)
        print(f"CSV saved: {csv_path}")

    if args.format in ['md', 'all']:
        md_path = str(base_path) + '.md'
        md_content = formatter.to_markdown(quote, md_path)
        print(f"Markdown saved: {md_path}")

        if args.print_md or args.format == 'md':
            print("\n" + "="*60)
            print("MARKDOWN OUTPUT (copy below for Claude):")
            print("="*60 + "\n")
            print(md_content)

    if args.format in ['json', 'all']:
        json_path = str(base_path) + '.json'
        formatter.to_json(quote, json_path)
        print(f"JSON saved: {json_path}")

    return 0


if __name__ == '__main__':
    exit(main())
