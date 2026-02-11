import pandas as pd
import pytest

def test_unmapped_accounts_raises_error():
    from utils.mapping_utils import validate_all_accounts_mapped
    df_gl = pd.DataFrame({
        "account_number": [1010],
        "account_name": ["Foo Income"]
    })
    df_mapped = df_gl.copy()
    df_mapped["standard_category"] = [None]
    with pytest.raises(Exception, match="Unmapped accounts found"):
        validate_all_accounts_mapped(df_gl, df_mapped)
