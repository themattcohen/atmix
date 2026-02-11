from utils.mapping_utils import validate_all_accounts_mapped
import pandas as pd
TRANSACTION_COLUMNS = [
    'transaction_id',      # unique integer assigned on ingest
    'transaction_date',    # YYYY‑MM‑DD
    'account_name',        # original GL account name
    'description',         # GL memo / description text
    'debit',               # debit amount (signed or absolute per loader)
    'credit',              # credit amount
]

from datetime import datetime
from chart_mapper import ChartMapper

class DataProcessor:
    """
    Loads GL & AR files → auto-creates net_amount → maps to standard CoA →
    runs basic QC → rebuilds monthly financial snapshots →
    builds detailed P&L, B/S, and Client Collections matrices.
    """

    MANDATORY_GL_COLUMNS = [
        "transaction_date",
        "account_name",
        "debit_amount",
        "credit_amount",
    ]

    REQUIRED_AR_COLUMNS = [
        "month_end_date",
        "client_name",
        "invoice_number",
        "invoice_date",
        "original_amount",
        "current_balance",
        "days_outstanding",
    ]

    def __init__(self, mapping_file: str = "coa_mapping_review.xlsx"):
        self.gl_data: pd.DataFrame | None = None
        self.ar_data: pd.DataFrame | None = None
        self.unmapped_accounts: pd.DataFrame | None = None
        self.validation_issues: list[str] = []
        self.mapping_file = mapping_file
        self._mapper = ChartMapper()

    def load_and_validate(self, gl_file: str, ar_file: str):
        self.gl_data = self._load_gl_data(gl_file)
        # Ensure account_number is present and filled
        if "account_number" not in self.gl_data.columns:
            self.gl_data["account_number"] = ""
        self.gl_data["account_number"] = self.gl_data["account_number"].fillna("").astype(str)
        # Ensure unique transaction_id is present
        if "transaction_id" not in self.gl_data.columns:
            self.gl_data["transaction_id"] = self.gl_data.index.astype(str)
        self.ar_data = self._load_ar_data(ar_file)
        self._apply_coa_mapping()
        self._validate_data()
        return self.gl_data, self.ar_data

    def rebuild_monthly_financials(self, gl_df: pd.DataFrame):
        monthly_financials = {}
        start_date = gl_df["transaction_date"].min()
        end_date = gl_df["transaction_date"].max()

        for month_end in pd.date_range(
            start=start_date.replace(day=1), end=end_date, freq="ME"
        ):
            label = month_end
            month_start = month_end.replace(day=1)

            month_data = gl_df[
                (gl_df["transaction_date"] >= month_start)
                & (gl_df["transaction_date"] <= month_end)
            ]
            ytd_data = gl_df[gl_df["transaction_date"] <= month_end]

            def sum_if(data, starts):
                return data[
                    data["standard_account"].astype(str).str.startswith(starts)
                ]["net_amount"].sum()

            # P&L calculations (period-specific)
            # Revenue and income accounts have credit balances (negative net_amount)
            # Expense accounts have debit balances (positive net_amount)
            p_and_l = {
                "revenue": -sum_if(month_data, "4"),  # Reverse sign for revenue (credit balance)
                "cogs": sum_if(month_data, "5"),     # Keep sign for expenses (debit balance)
                "operating_expenses": sum_if(month_data, ("6", "7")),  # Keep sign for expenses
                "other_income": -sum_if(month_data, "8"),  # Reverse sign for income (credit balance)
                "other_expenses": sum_if(month_data, "9"),  # Keep sign for expenses
            }
            # Calculate net income properly
            p_and_l['gross_profit'] = p_and_l.get('revenue', 0) - p_and_l.get('cogs', 0)
            p_and_l['net_income'] = (p_and_l.get('revenue', 0) - p_and_l.get('cogs', 0) - 
                                   p_and_l.get('operating_expenses', 0) + p_and_l.get('other_income', 0) - 
                                   p_and_l.get('other_expenses', 0))

            # Balance Sheet calculations (cumulative YTD)
            # In our data: net_amount = debit_amount - credit_amount
            # Assets (normal debit balance): positive when debits > credits
            assets = sum_if(ytd_data, "1")
            
            # Liabilities (normal credit balance): positive when credits > debits
            # Since net_amount = debit - credit, we need to reverse the sign
            liabilities = -sum_if(ytd_data, "2")
            
            # Equity (normal credit balance): positive when credits > debits  
            # Since net_amount = debit - credit, we need to reverse the sign
            equity_base = -sum_if(ytd_data, "3")
            
            # Calculate retained earnings (cumulative net income)
            # Net income should be added to equity
            cumulative_net_income = 0
            for prior_date, prior_financials in monthly_financials.items():
                if prior_date < label:
                    cumulative_net_income += prior_financials['p_and_l']['net_income']
            
            # Add current period net income
            cumulative_net_income += p_and_l['net_income']
            
            # Total equity = base equity + retained earnings
            total_equity = equity_base + cumulative_net_income
            
            balance_sheet = {
                "assets": assets,
                "liabilities": liabilities,
                "equity_base": equity_base,
                "retained_earnings": cumulative_net_income,
                "total_equity": total_equity,
                "total_assets": assets,
                "total_liabilities_and_equity": liabilities + total_equity,
            }
            
            # Validate accounting equation: A = L + E
            balance_difference = abs(balance_sheet['total_assets'] - balance_sheet['total_liabilities_and_equity'])
            balance_sheet['balance_check'] = balance_difference
            balance_sheet['is_balanced'] = balance_difference < 1.0  # Allow for rounding differences
            
            if not balance_sheet['is_balanced']:
                print(f"WARNING: Balance sheet not balanced for {label}")
                print(f"  Assets: ${balance_sheet['total_assets']:,.2f}")
                print(f"  Liabilities + Equity: ${balance_sheet['total_liabilities_and_equity']:,.2f}")
                print(f"  Difference: ${balance_difference:,.2f}")

            monthly_financials[label] = {
                "p_and_l": p_and_l,
                "balance_sheet": balance_sheet,
            }

        return monthly_financials

    def build_pnl_matrix(self):
        # P&L accounts via standardized COA prefixes: 4*,5*,6*/7*,8*,9*
        pnl = self.gl_data[self.gl_data["standard_account"].astype(str).str.startswith(
            ("4","5","6","7","8","9")
        )].copy()
        pnl["month"] = pnl["transaction_date"].dt.to_period("M").astype(str)
        pivot = pnl.pivot_table(
            index=["standard_account","standard_name"],
            columns="month",
            values="net_amount",
            aggfunc="sum",
            fill_value=0
        ).sort_index()
        pivot["Total"] = pivot.sum(axis=1)
        df = pivot.reset_index()
        # rename back for Excel writer
        df = df.rename(columns={
            "standard_account": "account_number",
            "standard_name":    "account_name"
        })
        return df

    def build_bs_matrix(self):
        # B/S accounts via standardized COA prefixes: 1*,2*,3*
        bs = self.gl_data[self.gl_data["standard_account"].astype(str).str.startswith(
            ("1","2","3")
        )].copy()
        bs["month"] = bs["transaction_date"].dt.to_period("M").astype(str)
        
        # Create pivot table with cumulative balances (YTD)
        pivot = bs.pivot_table(
            index=["standard_account","standard_name"],
            columns="month",
            values="net_amount",
            aggfunc="sum",
            fill_value=0
        ).sort_index()
        
        # Convert to cumulative balances for balance sheet accounts
        pivot = pivot.cumsum(axis=1)
        
        # Apply proper accounting signs
        # Assets (1xxx): Keep as-is (debits are positive)
        # Liabilities (2xxx): Reverse sign (credits should be positive)
        # Equity (3xxx): Reverse sign (credits should be positive)
        for idx in pivot.index:
            account_num = str(idx[0])
            if account_num.startswith('2') or account_num.startswith('3'):
                pivot.loc[idx] = -pivot.loc[idx]
        
        pivot["Total"] = pivot.iloc[:, -1]  # Use last month as total
        df = pivot.reset_index()
        
        # Add category column for better organization
        df['category'] = df['standard_account'].astype(str).apply(
            lambda x: 'Assets' if x.startswith('1') 
                     else 'Liabilities' if x.startswith('2') 
                     else 'Equity'
        )
        
        # Rename columns for Excel output
        df = df.rename(columns={
            "standard_account": "account_number",
            "standard_name":    "account_name"
        })
        
        # Add retained earnings line and summary validation (only for Total column)
        if not df.empty:
            months = [col for col in df.columns if col not in ['account_number', 'account_name', 'category', 'Total']]
            
            # Calculate retained earnings from P&L data
            monthly_financials = self.rebuild_monthly_financials(self.gl_data)
            if monthly_financials:
                latest_date = max(monthly_financials.keys())
                retained_earnings = monthly_financials[latest_date]['balance_sheet']['retained_earnings']
                
                # Add retained earnings line
                retained_earnings_row = {
                    'account_number': '3200', 
                    'account_name': 'Retained Earnings (Net Income)', 
                    'category': 'Equity',
                    'Total': retained_earnings
                }
                # Fill month columns with cumulative retained earnings
                for month in months:
                    month_period = pd.Period(month)
                    # Find the retained earnings for this specific month
                    month_retained_earnings = 0
                    for date, financials in monthly_financials.items():
                        if date.to_period('M') == month_period:
                            month_retained_earnings = financials['balance_sheet']['retained_earnings']
                            break
                    retained_earnings_row[month] = month_retained_earnings
                
                # Add the retained earnings row
                retained_df = pd.DataFrame([retained_earnings_row])
                for col in df.columns:
                    if col not in retained_df.columns:
                        retained_df[col] = 0
                retained_df = retained_df[df.columns]
                df = pd.concat([df, retained_df], ignore_index=True)
            
            # Create summary rows structure first
            summary_rows = [
                {'account_number': '', 'account_name': '', 'category': ''},  # Blank row
                {'account_number': 'TOTAL_ASSETS', 'account_name': 'Total Assets', 'category': 'Summary'},
                {'account_number': 'TOTAL_LIABILITIES', 'account_name': 'Total Liabilities', 'category': 'Summary'},
                {'account_number': 'TOTAL_EQUITY', 'account_name': 'Total Equity', 'category': 'Summary'},
                {'account_number': 'LIAB_PLUS_EQUITY', 'account_name': 'Total Liabilities + Equity', 'category': 'Summary'},
                {'account_number': 'BALANCE_CHECK', 'account_name': 'Balance Check (A - (L+E))', 'category': 'Validation'}
            ]
            
            # Calculate totals for each month and overall
            for month in months + ['Total']:
                assets_total = df[df['category'] == 'Assets'][month].sum()
                liabilities_total = df[df['category'] == 'Liabilities'][month].sum()
                equity_total = df[df['category'] == 'Equity'][month].sum()
                
                # Fill in the values for this month
                summary_rows[0][month] = ''  # Blank row
                summary_rows[1][month] = assets_total  # TOTAL_ASSETS
                summary_rows[2][month] = liabilities_total  # TOTAL_LIABILITIES  
                summary_rows[3][month] = equity_total  # TOTAL_EQUITY
                summary_rows[4][month] = liabilities_total + equity_total  # LIAB_PLUS_EQUITY
                summary_rows[5][month] = assets_total - (liabilities_total + equity_total)  # BALANCE_CHECK
            
            summary_df = pd.DataFrame(summary_rows)
            for col in df.columns:
                if col not in summary_df.columns:
                    summary_df[col] = 0
            summary_df = summary_df[df.columns]
            df = pd.concat([df, summary_df], ignore_index=True)
        
        return df

    def build_client_collections_matrix(self):
        # Use all revenue transactions (standard_account starts with '4')
        revenue_data = self.gl_data[self.gl_data['standard_account'].astype(str).str.startswith('4')].copy()
        # Use client_name if present, else fallback to name
        client_col = 'client_name' if 'client_name' in revenue_data.columns else 'name'
        if client_col not in revenue_data.columns:
            return pd.DataFrame()  # No client info available
        revenue_data = revenue_data[revenue_data[client_col].notna()]
        revenue_data['month'] = revenue_data['transaction_date'].dt.to_period('M').astype(str)
        pivot = revenue_data.pivot_table(
            index=client_col,
            columns='month',
            values='net_amount',
            aggfunc='sum',
            fill_value=0
        ).sort_index()
        pivot['Total'] = pivot.sum(axis=1)
        return pivot.reset_index()

    # --- Internal helpers below (no changes needed) --- #

    def _load_gl_data(self, path: str) -> pd.DataFrame:
        df = (
            pd.read_excel(path)
            if path.lower().endswith((".xlsx", ".xls"))
            else pd.read_csv(path)
        )
        missing = [c for c in self.MANDATORY_GL_COLUMNS if c not in df.columns]
        if missing:
            raise ValueError(f"Missing required GL columns: {missing}")
        # Make account_number optional: fill with empty strings if missing
        if "account_number" not in df.columns:
            df["account_number"] = ""
        df["account_number"] = df["account_number"].fillna("").astype(str)
        # If all account numbers are empty, generate unique ones per account name
        if (df["account_number"] == "").all():
            unique_names = df["account_name"].unique()
            name_to_num = {name: f"ACC{str(i+1).zfill(4)}" for i, name in enumerate(unique_names)}
            df["account_number"] = df["account_name"].map(name_to_num)
        df["transaction_date"] = pd.to_datetime(df["transaction_date"])
        df["debit_amount"] = pd.to_numeric(df["debit_amount"], errors="coerce").fillna(0)
        df["credit_amount"] = pd.to_numeric(df["credit_amount"], errors="coerce").fillna(0)
        if "net_amount" not in df.columns:
            df["net_amount"] = df["debit_amount"] - df["credit_amount"]

        if "account_number" not in df.columns:
            df["account_number"] = ""
        else:
            df["account_number"] = df["account_number"].astype(str).str.strip()
        for col in ("account_name", "name", "description"):
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip()
        df = df.sort_values("transaction_date").reset_index(drop=True)
        # Ensure every row has a unique transaction_id
        if "transaction_id" not in df.columns:
            df["transaction_id"] = df.index.astype(str)
        return df

    def _load_ar_data(self, path: str) -> pd.DataFrame:
        df = (
            pd.read_excel(path)
            if path.lower().endswith((".xlsx", ".xls"))
            else pd.read_csv(path)
        )
        if "month_end_date" in df.columns:
            df["month_end_date"] = pd.to_datetime(df["month_end_date"])
        return df

    def _apply_coa_mapping(self):
        mapping_dict = self._mapper.map_to_standard(self.gl_data)
        mapping_df = (
            pd.DataFrame.from_dict(mapping_dict, orient="index")
            .reset_index()
            .rename(columns={"index": "account_number"})
        )
        # Ensure account numbers are strings and have no NaN values
        mapping_df["account_number"] = mapping_df["account_number"].fillna("").astype(str)
        self.gl_data["account_number"] = self.gl_data["account_number"].fillna("").astype(str)
        print('DEBUG: self.gl_data["account_number"] sample:', self.gl_data["account_number"].unique()[:10])
        print('DEBUG: mapping_df["account_number"] sample:', mapping_df["account_number"].unique()[:10])
        self.gl_data = self.gl_data.merge(
            mapping_df,
            on="account_number",
            how="left",
        )
        self.unmapped_accounts = mapping_df[mapping_df["standard_account"].isna()]

    def _validate_data(self):
        issues = []
        if self.gl_data["transaction_date"].isna().any():
            issues.append("GL data contains missing transaction dates")
        debits = self.gl_data["debit_amount"].sum()
        credits = self.gl_data["credit_amount"].sum()
        if abs(debits - credits) > 100:
            issues.append("GL debits do not equal credits")
        if (
            self.ar_data is not None
            and not self.ar_data.empty
            and "month_end_date" in self.ar_data.columns
        ):
            ar_gl_balance = self.gl_data[
                self.gl_data["account_number"].str.startswith("120")
            ]["net_amount"].sum()
            latest_ar = self.ar_data[
                self.ar_data["month_end_date"] == self.ar_data["month_end_date"].max()
            ]["current_balance"].sum()
            if abs(ar_gl_balance - latest_ar) > 1:
                issues.append("AR aging total does not tie to GL control account")
        
        # Validate balance sheet equation
        balance_issues = self._validate_balance_sheet()
        issues.extend(balance_issues)
        
        self.validation_issues = issues

    def _validate_balance_sheet(self):
        """Validate that the balance sheet follows A = L + E (including retained earnings)"""
        issues = []
        
        if self.gl_data is None or self.gl_data.empty:
            return issues
        
        # Check if we have standard_account mapping
        if 'standard_account' not in self.gl_data.columns:
            issues.append("Standard account mapping not available for balance sheet validation")
            return issues
        
        # Use the monthly financials approach which properly handles retained earnings
        monthly_financials = self.rebuild_monthly_financials(self.gl_data)
        
        if not monthly_financials:
            issues.append("No monthly financial data available for balance sheet validation")
            return issues
        
        # Check the most recent period
        latest_date = max(monthly_financials.keys())
        latest_bs = monthly_financials[latest_date]['balance_sheet']
        
        if not latest_bs['is_balanced']:
            issues.append(
                f"Balance sheet equation not balanced for {latest_date.strftime('%Y-%m')}: "
                f"Assets ${latest_bs['total_assets']:,.2f} ≠ Liabilities + Equity ${latest_bs['total_liabilities_and_equity']:,.2f} "
                f"(Difference: ${latest_bs['balance_check']:,.2f})"
            )
        
        # Check if we have any balance sheet accounts
        total_assets = latest_bs['total_assets']
        total_liabilities = latest_bs['liabilities']
        total_equity = latest_bs['total_equity']
        
        if total_assets == 0 and total_liabilities == 0 and total_equity == 0:
            issues.append("Balance sheet appears to be empty - no balance sheet accounts found")
        
        return issues
