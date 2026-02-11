import sys, os
# 1) Make sure the repo root is on the import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pandas as pd
import pytest
from pathlib import Path

from data_processor import DataProcessor
from master_red_flag_analyzer import MasterRedFlagAnalyzer

def test_account_mapping_sheet(tmp_path):
    """
    Verify that the Account Mapping sheet:
      - exists
      - has exactly the four expected columns
      - has unique original_account_number entries
    """
    # 2) Point to your sample files
    gl_path = Path("data/gl_sample.xlsx")
    ar_path = Path("data/ar_sample.xlsx")

    # 3) Load & map via DataProcessor
    dp = DataProcessor()
    dp.load_and_validate(str(gl_path), str(ar_path))

    # 4) Build the monthly_financials dict
    monthly_financials = dp.rebuild_monthly_financials(dp.gl_data)

    # 5) Instantiate the analyzer with all six args
    analyzer = MasterRedFlagAnalyzer(
        dp.gl_data,
        dp.ar_data,
        monthly_financials,
        dp.unmapped_accounts,
        dp.validation_issues,
        dp
    )

    # 6) Run the five phases
    analyzer.run_all_phases()

    # 7) Export to a temp file
    out_file = tmp_path / "out.xlsx"
    analyzer.export_comprehensive_report(filename=str(out_file))

    # 8) Load it and assert
    xls = pd.ExcelFile(str(out_file))
    assert "Account Mapping" in xls.sheet_names

    df = pd.read_excel(xls, sheet_name="Account Mapping")
    expected = [
        "original_account_number",
        "original_account_name",
        "mapped_account_number",
        "mapped_account_name",
    ]
    assert list(df.columns) == expected
    assert df["original_account_number"].is_unique
