"""1Password credential store — standalone module.

Provides CredentialStore for hydrating bank credentials from a 1Password
vault into a shape that matches AccountJob's credential fields.

Usage:
    from onepassword_store import CredentialStore, HydratedCredentials

    store = CredentialStore()
    creds = await store.hydrate("Acme Corp - Chase Business")

CLI testing:
    python -m onepassword_store.cli lookup "Acme Corp - Chase Business"
    python -m onepassword_store.cli list
    python -m onepassword_store.cli test-all

---

Future plug-in steps (not built yet):

1. Add `op_item` column to ACCOUNTS_COLUMNS in excel_reader.py
2. In read_accounts(), if op_item is set, call CredentialStore.hydrate()
   and map the result onto AccountJob fields:
       creds = await store.hydrate(row["op_item"])
       job.username = creds.username
       job.password = creds.password
       job.tfa_detail = creds.totp_secret or ""
       job.security_questions = creds.security_questions
3. Add OP_SERVICE_ACCOUNT_TOKEN / OP_VAULT to config.py
4. Add onepassword-sdk to requirements.txt
"""

from .models import HydratedCredentials
from .store import CredentialError, CredentialStore

__all__ = ["CredentialStore", "CredentialError", "HydratedCredentials"]
