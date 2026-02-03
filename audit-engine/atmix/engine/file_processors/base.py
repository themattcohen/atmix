"""Base classes and data structures for file processing.

This module provides the abstract base class for file processors and
common data structures used across different file type processors.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd


@dataclass
class FileMetadata:
    """Metadata about a processed file.

    Attributes:
        filename: Original filename.
        file_type: File extension type (csv, xlsx, pdf).
        inferred_content: Inferred content type based on filename and content.
        row_count: Number of rows for tabular data.
        sheet_names: List of sheet names for Excel files.
        page_count: Number of pages for PDF files.
        size_bytes: File size in bytes.
        requires_password: Whether file requires password to open.
        is_corrupted: Whether file appears corrupted or unreadable.
        error_message: Error message if processing failed.
    """

    filename: str
    file_type: str
    inferred_content: str
    row_count: Optional[int] = None
    sheet_names: List[str] = field(default_factory=list)
    page_count: Optional[int] = None
    size_bytes: int = 0
    requires_password: bool = False
    is_corrupted: bool = False
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert metadata to dictionary for serialization."""
        return {
            "filename": self.filename,
            "file_type": self.file_type,
            "inferred_content": self.inferred_content,
            "row_count": self.row_count,
            "sheet_names": self.sheet_names,
            "page_count": self.page_count,
            "size_bytes": self.size_bytes,
            "requires_password": self.requires_password,
            "is_corrupted": self.is_corrupted,
            "error_message": self.error_message,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "FileMetadata":
        """Create FileMetadata from dictionary."""
        return cls(**data)


@dataclass
class ContextDocument:
    """A document providing context for analysis.

    Context documents are extracted from PDFs or other non-tabular files
    that provide supporting information for the audit.

    Attributes:
        filename: Source filename.
        document_type: Type classification (quickbooks_health, bank_statement, etc.).
        extracted_text: Raw text extracted from document.
        structured_data: Any structured data extracted (key-value pairs, tables).
        confidence: Confidence score for document classification (0.0-1.0).
    """

    filename: str
    document_type: str
    extracted_text: str
    structured_data: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.5

    def to_dict(self) -> Dict[str, Any]:
        """Convert context document to dictionary for serialization."""
        return {
            "filename": self.filename,
            "document_type": self.document_type,
            "extracted_text": self.extracted_text,
            "structured_data": self.structured_data,
            "confidence": self.confidence,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ContextDocument":
        """Create ContextDocument from dictionary."""
        return cls(**data)


@dataclass
class ProcessedFile:
    """Result of processing a file.

    Contains both tabular data (DataFrames) and context documents
    extracted from the file.

    Attributes:
        tabular_data: Dictionary mapping sheet/table names to DataFrames.
        context_documents: List of context documents extracted from file.
        metadata: File metadata including type, size, and inferred content.
    """

    tabular_data: Dict[str, pd.DataFrame] = field(default_factory=dict)
    context_documents: List[ContextDocument] = field(default_factory=list)
    metadata: Optional[FileMetadata] = None

    def has_tabular_data(self) -> bool:
        """Check if any tabular data was extracted."""
        return bool(self.tabular_data)

    def has_context(self) -> bool:
        """Check if any context documents were extracted."""
        return bool(self.context_documents)

    def total_rows(self) -> int:
        """Get total row count across all tabular data."""
        return sum(len(df) for df in self.tabular_data.values())

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization (excludes DataFrames)."""
        return {
            "tabular_data_keys": list(self.tabular_data.keys()),
            "context_documents": [doc.to_dict() for doc in self.context_documents],
            "metadata": self.metadata.to_dict() if self.metadata else None,
        }


class FileProcessor(ABC):
    """Abstract base class for file processors.

    File processors handle specific file types and extract both tabular
    data and context documents from files.
    """

    @abstractmethod
    def can_process(self, file_path: Path) -> bool:
        """Check if this processor can handle the given file.

        Args:
            file_path: Path to the file to check.

        Returns:
            True if this processor can handle the file type.
        """
        pass

    @abstractmethod
    def process(
        self, file_path: Path, password: Optional[str] = None
    ) -> ProcessedFile:
        """Process a file and extract data.

        Args:
            file_path: Path to the file to process.
            password: Optional password for encrypted files.

        Returns:
            ProcessedFile containing extracted data and metadata.

        Raises:
            FileNotFoundError: If file does not exist.
            PermissionError: If file requires password and none provided.
            ValueError: If file is corrupted or unreadable.
        """
        pass

    @abstractmethod
    def get_sample(self, file_path: Path, max_rows: int = 50) -> str:
        """Get a sample of file contents for preview.

        Args:
            file_path: Path to the file.
            max_rows: Maximum rows to include in sample.

        Returns:
            String representation of file sample.
        """
        pass


# Content type inference patterns
_CONTENT_TYPE_PATTERNS: Dict[str, List[str]] = {
    # Financial statements
    "profit_and_loss": [
        "profit", "loss", "p&l", "pl_", "income_statement",
        "income statement", "p and l", "pnl",
    ],
    "balance_sheet": [
        "balance_sheet", "balance sheet", "bs_", "statement_of_position",
    ],
    "cash_flow": [
        "cash_flow", "cash flow", "cashflow", "statement_of_cash",
    ],
    "trial_balance": [
        "trial_balance", "trial balance", "tb_", "trialbalance",
    ],

    # QuickBooks reports
    "quickbooks_health": [
        "health", "qb_health", "quickbooks_health", "company_health",
    ],
    "general_ledger": [
        "general_ledger", "general ledger", "gl_", "ledger",
    ],
    "accounts_receivable": [
        "ar_", "accounts_receivable", "accounts receivable", "receivables",
        "aging_ar", "ar aging",
    ],
    "accounts_payable": [
        "ap_", "accounts_payable", "accounts payable", "payables",
        "aging_ap", "ap aging", "bills",
    ],
    "journal_entries": [
        "journal", "journal_entries", "journal entries", "je_",
    ],

    # Banking
    "bank_statement": [
        "bank_statement", "bank statement", "bank_", "statement_",
        "checking", "savings", "account_statement",
    ],
    "bank_reconciliation": [
        "reconcil", "bank_rec", "reconciliation",
    ],

    # Tax
    "tax_return": [
        "tax_return", "tax return", "1040", "1120", "1065", "990",
        "schedule_c", "schedule c",
    ],
    "1099": [
        "1099", "contractor", "vendor_payments",
    ],

    # Payroll
    "payroll": [
        "payroll", "wages", "salary", "salaries", "pay_", "paycheck",
        "employee_comp", "compensation",
    ],
    "payroll_tax": [
        "941", "940", "payroll_tax", "payroll tax", "fica", "futa",
    ],

    # Inventory
    "inventory": [
        "inventory", "stock", "sku", "products", "item_list",
    ],
    "cogs": [
        "cogs", "cost_of_goods", "cost of goods", "cost_of_sales",
    ],

    # Other
    "vendor_list": [
        "vendor_list", "vendor list", "vendors", "supplier",
    ],
    "customer_list": [
        "customer_list", "customer list", "customers", "client",
    ],
    "transaction_list": [
        "transaction", "transactions", "txn_", "trans_",
    ],
    "sales": [
        "sales", "revenue", "invoices", "invoice_",
    ],
    "expenses": [
        "expense", "expenses", "spend", "spending", "costs",
    ],
}

# Column patterns that help identify content type
_COLUMN_PATTERNS: Dict[str, List[str]] = {
    "profit_and_loss": [
        "revenue", "income", "expense", "net income", "gross profit",
        "operating", "total income", "total expenses",
    ],
    "balance_sheet": [
        "assets", "liabilities", "equity", "current assets",
        "fixed assets", "retained earnings", "total assets",
    ],
    "general_ledger": [
        "debit", "credit", "account", "memo", "journal",
    ],
    "bank_statement": [
        "deposit", "withdrawal", "balance", "cleared",
    ],
    "accounts_receivable": [
        "invoice", "due date", "days past due", "aging", "customer",
    ],
    "accounts_payable": [
        "bill", "vendor", "due date", "days past due", "aging",
    ],
    "payroll": [
        "employee", "wages", "hours", "rate", "gross pay", "net pay",
    ],
    "inventory": [
        "sku", "quantity", "on hand", "unit cost", "item",
    ],
}


def infer_content_type(
    filename: str, df: Optional[pd.DataFrame] = None
) -> str:
    """Infer the content type from filename and optional DataFrame.

    Uses filename patterns and DataFrame column names to determine
    what type of financial document the file contains.

    Args:
        filename: The filename to analyze.
        df: Optional DataFrame to analyze column names.

    Returns:
        Inferred content type string (e.g., "Profit & Loss", "General Ledger").
        Returns "Unknown" if no pattern matches.

    Examples:
        >>> infer_content_type("profit_loss_2024.csv")
        'Profit & Loss'
        >>> infer_content_type("general_ledger_q1.xlsx")
        'General Ledger'
    """
    filename_lower = filename.lower()

    # First, check filename patterns
    best_match: Optional[str] = None
    best_match_len = 0

    for content_type, patterns in _CONTENT_TYPE_PATTERNS.items():
        for pattern in patterns:
            if pattern in filename_lower:
                # Prefer longer pattern matches
                if len(pattern) > best_match_len:
                    best_match = content_type
                    best_match_len = len(pattern)

    # If we have a DataFrame, also check column patterns
    if df is not None and best_match is None:
        columns_lower = [str(col).lower() for col in df.columns]
        columns_text = " ".join(columns_lower)

        for content_type, patterns in _COLUMN_PATTERNS.items():
            matches = sum(1 for p in patterns if p in columns_text)
            # Require at least 2 column pattern matches
            if matches >= 2:
                best_match = content_type
                break

    if best_match is None:
        return "Unknown"

    # Convert internal type to display name
    display_names = {
        "profit_and_loss": "Profit & Loss",
        "balance_sheet": "Balance Sheet",
        "cash_flow": "Cash Flow Statement",
        "trial_balance": "Trial Balance",
        "quickbooks_health": "QuickBooks Health Report",
        "general_ledger": "General Ledger",
        "accounts_receivable": "Accounts Receivable",
        "accounts_payable": "Accounts Payable",
        "journal_entries": "Journal Entries",
        "bank_statement": "Bank Statement",
        "bank_reconciliation": "Bank Reconciliation",
        "tax_return": "Tax Return",
        "1099": "1099 Forms",
        "payroll": "Payroll",
        "payroll_tax": "Payroll Tax",
        "inventory": "Inventory",
        "cogs": "Cost of Goods Sold",
        "vendor_list": "Vendor List",
        "customer_list": "Customer List",
        "transaction_list": "Transaction List",
        "sales": "Sales",
        "expenses": "Expenses",
    }

    return display_names.get(best_match, best_match.replace("_", " ").title())
