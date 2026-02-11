import os
import pandas as pd
from phase1_revenue_analysis  import RevenueAnalyzer
from phase2_client_analysis   import ClientAnalyzer
from phase3_collection_analysis import CollectionAnalyzer
from phase4_operational_analysis import OperationalAnalyzer
from phase5_fraud_analysis    import FraudAnalyzer

# ---------- NEW ----------
from core.flag_details import build_flag_details
# -------------------------

# --- Wave‑0 detail_ref de‑dupe ---
def _dedupe_detail_ref(df):
    """Keep first detail_ref column if duplicates were created."""
    cols = list(df.columns)
    first = None
    dupes = []
    for i, c in enumerate(cols):
        if c == "detail_ref":
            if first is None:
                first = i
            else:
                dupes.append(c + f"_DUP{i}")
    if dupes:
        df = df.loc[:, ~df.columns.duplicated(keep="first")]
    return df


class MasterRedFlagAnalyzer:
    """
    Orchestrates all five analysis phases, builds detail tabs,
    and writes all output to Excel as required.
    """

    # ---------------- NEW ----------------
    _DETAIL_CAP = 100  # max rows per phase
    # -------------------------------------

    def __init__(
        self,
        gl_data,
        ar_data,
        monthly_financials,
        unmapped_df=None,
        validation_issues=None,
        data_processor=None,
    ):
        self.gl_data = gl_data
        self.ar_data = ar_data
        self.monthly_financials = monthly_financials
        self.unmapped_df = unmapped_df
        self.validation_issues = validation_issues or []
        self.all_red_flags = []
        self.data_processor = data_processor  # pass in DataProcessor for matrices

        # Initialize phase analyzers
        self.revenue_analyzer = RevenueAnalyzer(
            gl_data, ar_data, monthly_financials
        )
        self.client_analyzer = ClientAnalyzer(
            gl_data, ar_data, monthly_financials
        )
        self.collection_analyzer = CollectionAnalyzer(
            gl_data, ar_data, monthly_financials
        )
        self.operational_analyzer = OperationalAnalyzer(
            gl_data, ar_data, monthly_financials
        )
        self.fraud_analyzer = FraudAnalyzer(
            gl_data, ar_data, monthly_financials
        )

        # ---------- NEW ----------
        self._flag_details_df = pd.DataFrame()
        # -------------------------

    def _add_flags(self, flag_list, category):
        """Append flags to the master list, tagging each with its phase/category."""
        for flag in flag_list:
            flag["category"] = category
            self.all_red_flags.append(flag)

    def run_all_phases(self):
        """Execute each analysis phase in order and collect flags"""
        print(" Running COMPREHENSIVE analysis (all 5 phases)")

        print("\n PHASE 1: Revenue Quality Analysis")
        phase1_flags = self.revenue_analyzer.analyze_all()
        self._add_flags(phase1_flags, "Revenue Quality")

        print("\n PHASE 2: Client Risk Analysis")
        phase2_flags = self.client_analyzer.analyze_all()
        self._add_flags(phase2_flags, "Client Risk")

        print("\n PHASE 3: Collection & Cash Flow Analysis")
        phase3_flags = self.collection_analyzer.analyze_all()
        self._add_flags(phase3_flags, "Collection & Cash Flow")

        print("\n PHASE 4: Operational Risk Analysis")
        phase4_flags = self.operational_analyzer.analyze_all()
        self._add_flags(phase4_flags, "Operational Risk")

        print("\n PHASE 5: Fraud & Compliance Analysis")
        phase5_flags = self.fraud_analyzer.analyze_all()
        self._add_flags(phase5_flags, "Fraud & Compliance")

        # Sort flags by severity and amount
        severity_order = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}
        self.all_red_flags.sort(
            key=lambda f: (
                severity_order.get(f.get("severity", "Low"), 0),
                abs(f.get("amount", 0)),
            ),
            reverse=True,
        )

    # (run_all_phases, _add_flags, get_summary_stats, print_executive_summary
    #  remain unchanged)

    # ---------- NEW ----------
    def _build_and_cache_flag_details(self):
        """Create (or return cached) consolidated detail DataFrame."""
        if not self._flag_details_df.empty:
            return self._flag_details_df
        self._flag_details_df = build_flag_details(
            self.all_red_flags,
            self.gl_data,
            self.ar_data,
            self.monthly_financials,
            cap=self._DETAIL_CAP
        )
        return self._flag_details_df
    # -------------------------

    def export_comprehensive_report(self, filename="comprehensive_red_flags.xlsx"):
        """Write all outputs into an Excel workbook with multiple sheets"""
        if not self.all_red_flags:
            print("   No red flags to export.")
            return None

        os.makedirs("output", exist_ok=True)
        path = os.path.join("output", filename)

        # ---- Build P&L, BS, and Client Collections ---- #
        pnl_df = (
            self.data_processor.build_pnl_matrix()
            if self.data_processor
            else pd.DataFrame()
        )
        bs_df = (
            self.data_processor.build_bs_matrix()
            if self.data_processor
            else pd.DataFrame()
        )
        client_coll_df = (
            self.data_processor.build_client_collections_matrix()
            if self.data_processor
            else pd.DataFrame()
        )

        # ---- Master flags dataframe ---- #
        df_flags = pd.DataFrame(self.all_red_flags)
        cols = [
            "category",
            "flag",
            "severity",
            "detail",
            "impact",
            "action",
            "amount",
            "period",
            "detail_ref",
        ]
        df_flags = df_flags.reindex(columns=cols, fill_value="")
        df_flags.insert(0, "priority", range(1, len(df_flags) + 1))

        # ---- Data-quality sheet ---- #
        if self.validation_issues and len(self.validation_issues) > 0:
            # Ensure validation_issues is a proper list
            issues_list = list(self.validation_issues) if not isinstance(self.validation_issues, list) else self.validation_issues
            dq = pd.DataFrame({"Issue": issues_list})
        else:
            dq = pd.DataFrame({"Issue": ["No issues detected"]})

        # ---------- NEW ----------
        detail_df = self._build_and_cache_flag_details()
        # -------------------------

        # ---- Write workbook ---- #
        with pd.ExcelWriter(path, engine="openpyxl") as writer:
            # original GL / mapping / financial‑matrix logic …
            if hasattr(self, "gl_data") and self.gl_data is not None and not self.gl_data.empty:
                self.gl_data.to_excel(writer, sheet_name="General Ledger", index=False)
                mapping_df = self.data_processor.gl_data[
                    [
                        "account_number",
                        "account_name",
                        "standard_account",
                        "standard_name",
                    ]
                ].drop_duplicates()
                mapping_df = mapping_df.rename(
                    columns={
                        "account_number": "original_account_number",
                        "account_name": "original_account_name",
                        "standard_account": "mapped_account_number",
                        "standard_name": "mapped_account_name",
                    }
                )
                # Ensure original_account_number has no NaN values and is string type
                mapping_df["original_account_number"] = mapping_df["original_account_number"].fillna("").astype(str)
                mapping_df.to_excel(writer, sheet_name="Account Mapping", index=False)

            if not pnl_df.empty:
                pnl_df.to_excel(writer, sheet_name="Profit & Loss", index=False)
            if not bs_df.empty:
                bs_df.to_excel(writer, sheet_name="Balance Sheet", index=False)
            if not client_coll_df.empty:
                client_coll_df.to_excel(
                    writer, sheet_name="Client Collections", index=False
                )

            # Flags
            df_flags.to_excel(writer, sheet_name="All Red Flags", index=False)
            # Critical/high flags
            df_flags[df_flags["severity"].isin(["Critical", "High"])].to_excel(
                writer, sheet_name="Critical Flags", index=False
            )
            # Individual category sheets
            for cat in df_flags["category"].unique():
                safe = str(cat)[:31]
                df_flags[df_flags["category"] == cat].to_excel(
                    writer, sheet_name=safe, index=False
                )
            # Unmapped accounts
            if self.unmapped_df is not None and not self.unmapped_df.empty:
                self.unmapped_df.to_excel(
                    writer, sheet_name="Unmapped_ACCT", index=False
                )

            dq.to_excel(writer, sheet_name="Data_Quality", index=False)

            # ---------- NEW ----------
            if not detail_df.empty:
                detail_df.to_excel(writer, sheet_name="Flag Details", index=False)
            # -------------------------
            
            # Churn Details sheet
            if hasattr(self.client_analyzer, 'churn_analyzer'):
                churn_details = self.client_analyzer.churn_analyzer.get_churn_details()
                if not churn_details.empty:
                    churn_details.to_excel(writer, sheet_name="Churn Details", index=False)

        print(f"   Comprehensive report exported to {path}")
        return path


def run_comprehensive_analysis(
    gl_df, ar_df, monthly_snapshots, unmapped_df=None, validation_issues=None, data_processor=None
):
    analyzer = MasterRedFlagAnalyzer(
        gl_df, ar_df, monthly_snapshots, unmapped_df, validation_issues, data_processor
    )
    analyzer.run_all_phases()
    analyzer.export_comprehensive_report()
    return analyzer
if __name__ == "__main__":
    from data_processor import DataProcessor

    print("COMPREHENSIVE RED FLAG ANALYSIS - MANUAL RUN")

    # Load example data
    processor = DataProcessor()
    gl_df, ar_df = processor.load_and_validate("data/gl_sample.xlsx", "data/ar_sample.xlsx")
    monthly_snapshots = processor.rebuild_monthly_financials(gl_df)
    try:
        unmapped_df = processor.unmapped_accounts
    except Exception:
        unmapped_df = None

    # Run all phases & export workbook
    run_comprehensive_analysis(
        gl_df,
        ar_df,
        monthly_snapshots,
        unmapped_df=unmapped_df,
        validation_issues=processor.validation_issues,
        data_processor=processor,
    )

    print("Analysis complete - see output/comprehensive_red_flags.xlsx")
