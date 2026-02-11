import pandas as pd
from core.flag_details import build_flag_details

def test_cap_and_columns():
    gl = pd.DataFrame({
        "transaction_id": range(200),
        "account_number": ["4000"] * 200,
        "net_amount": [1.0] * 200,
    })
    flags = [
        {"category": "Revenue Quality", "flag": "Spike", "detail": "EoM spike", "detail_ref": list(range(150))},
        {"category": "Client Risk", "flag": "Churn", "detail": "High churn", "detail_ref": None, "period": "2024‑03"},
    ]
    df = build_flag_details(flags, gl, cap=100)
    # 100 rows cap per phase
    assert (df["phase"] == "Revenue Quality").sum() == 100
    # stub row exists
    assert (df["phase"] == "Client Risk").sum() == 1
    # mandatory columns
    for col in ["phase", "analysis_name", "reason"]:
        assert col in df.columns
