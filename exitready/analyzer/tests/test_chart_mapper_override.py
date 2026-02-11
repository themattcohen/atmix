import pandas as pd
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from chart_mapper import ChartMapper

from chart_mapper import ChartMapper

def test_override_applies_correctly():
    gl = pd.DataFrame({
        "account_number": ["1200"],
        "account_name": ["Accounts Receivable"],
    })
    mapper = ChartMapper()
    result = mapper.map_to_standard(gl)
    assert "1200" in result
    mapped = result["1200"]
    assert mapped["standard_name"].lower() == "accounts receivable - trade"
    assert mapped["category"].lower() == "current assets"
