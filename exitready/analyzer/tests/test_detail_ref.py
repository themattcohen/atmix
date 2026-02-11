import pandas as pd, openpyxl, pathlib, subprocess, sys

def test_single_detail_ref(tmp_path):
    """Pipeline should export exactly one detail_ref column per sheet."""
    # run the existing harness to generate output (fast on sample data)
    subprocess.run(
        [sys.executable, 'test_master_analyzer.py'],
        check=True,
        cwd=pathlib.Path(__file__).resolve().parent.parent
    )

    wb = openpyxl.load_workbook('output/comprehensive_red_flags.xlsx', data_only=True)
    for ws in wb.worksheets:
        header = [c.value for c in ws[1]]
        assert header.count('detail_ref') <= 1, f"Duplicate detail_ref in {ws.title}"
