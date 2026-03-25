"""CredentialStore — 1Password SDK wrapper with caching and notes parsing."""

from __future__ import annotations

import logging
import os
import re

from .models import HydratedCredentials

log = logging.getLogger(__name__)

DEFAULT_VAULT = "BankCredentials"


class CredentialError(Exception):
    """Any failure fetching or parsing credentials from 1Password."""


class CredentialStore:
    """Singleton-style wrapper around the 1Password SDK.

    Lazily initialises the SDK client on first use.  All items are
    cached in-memory (never written to disk) keyed by (vault, item).
    """

    _instance: CredentialStore | None = None
    _client = None  # onepassword.Client

    def __new__(cls) -> CredentialStore:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._cache: dict[tuple[str, str], HydratedCredentials] = {}
        return cls._instance

    # ------------------------------------------------------------------
    # SDK bootstrap
    # ------------------------------------------------------------------

    async def _get_client(self):
        """Lazy-init the 1Password SDK client."""
        if self._client is not None:
            return self._client

        token = os.getenv("OP_SERVICE_ACCOUNT_TOKEN")
        if not token:
            raise CredentialError(
                "OP_SERVICE_ACCOUNT_TOKEN environment variable is not set. "
                "Create a service account at https://my.1password.com/ and "
                "export the token."
            )

        try:
            from onepassword import Client  # type: ignore[import-untyped]

            self._client = await Client.authenticate(
                auth=token,
                integration_name="bank-puller",
                integration_version="1.0.0",
            )
        except Exception as exc:
            raise CredentialError(
                f"Failed to authenticate with 1Password: {exc}"
            ) from exc

        return self._client

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def hydrate(
        self, op_item: str, vault: str | None = None
    ) -> HydratedCredentials:
        """Fetch credentials for a 1Password item.

        Args:
            op_item: Item title, e.g. "Acme Corp - Chase Business".
            vault:   Vault name.  Defaults to OP_VAULT env var or
                     "BankCredentials".

        Returns:
            HydratedCredentials with username, password, optional TOTP
            secret, and parsed security Q&A from the Notes field.

        Raises:
            CredentialError on any failure.
        """
        vault = vault or os.getenv("OP_VAULT", DEFAULT_VAULT)
        cache_key = (vault, op_item)

        if cache_key in self._cache:
            log.debug("Cache hit for %s/%s", vault, op_item)
            return self._cache[cache_key]

        log.info("Hydrating credentials for %s/%s", vault, op_item)
        client = await self._get_client()

        prefix = f"op://{vault}/{op_item}"

        # -- username & password (required) ----------------------------
        username = await self._resolve(client, f"{prefix}/username", op_item)
        password = await self._resolve(client, f"{prefix}/password", op_item)

        # -- TOTP (optional) -------------------------------------------
        totp_secret: str | None = None
        try:
            otp_uri = await client.secrets.resolve(
                f"{prefix}/one-time password"
            )
            totp_secret = self._parse_totp_secret(otp_uri)
        except Exception:
            log.debug("No OTP field for %s (this is fine)", op_item)

        # -- Security Q&A from Notes (optional) ------------------------
        security_questions: list[tuple[str, str]] = []
        try:
            notes = await client.secrets.resolve(f"{prefix}/notesPlain")
            security_questions = self._parse_notes_qa(notes)
        except Exception:
            log.debug("No notes for %s (this is fine)", op_item)

        creds = HydratedCredentials(
            username=username,
            password=password,
            totp_secret=totp_secret,
            security_questions=security_questions,
        )

        self._cache[cache_key] = creds
        log.info(
            "Hydrated %s: totp=%s, qa=%d",
            op_item,
            "yes" if totp_secret else "no",
            len(security_questions),
        )
        return creds

    async def list_items(self, vault: str | None = None) -> list[str]:
        """Return titles of all items in the vault."""
        vault = vault or os.getenv("OP_VAULT", DEFAULT_VAULT)
        client = await self._get_client()

        try:
            vaults = await client.vaults.list_all()
            vault_id = None
            async for v in vaults:
                if v.title == vault:
                    vault_id = v.id
                    break

            if vault_id is None:
                raise CredentialError(f"Vault '{vault}' not found")

            items = await client.items.list_all(vault_id)
            titles: list[str] = []
            async for item in items:
                titles.append(item.title)
            return sorted(titles)
        except CredentialError:
            raise
        except Exception as exc:
            raise CredentialError(
                f"Failed to list items in vault '{vault}': {exc}"
            ) from exc

    def clear_cache(self) -> None:
        """Drop the in-memory credential cache."""
        self._cache.clear()
        log.info("Credential cache cleared")

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    async def _resolve(client, reference: str, item_name: str) -> str:
        """Resolve a secret reference, raising CredentialError on failure."""
        try:
            return await client.secrets.resolve(reference)
        except Exception as exc:
            raise CredentialError(
                f"Failed to resolve '{reference}' for item '{item_name}': {exc}"
            ) from exc

    @staticmethod
    def _parse_totp_secret(otp_uri: str) -> str | None:
        """Extract the base32 secret from an otpauth:// URI.

        Returns None if the URI doesn't contain a recognisable secret.
        """
        match = re.search(r"secret=([A-Z2-7]+)", otp_uri, re.IGNORECASE)
        if not match:
            log.warning("Could not extract TOTP secret from URI: %s", otp_uri)
            return None
        return match.group(1).upper()

    @staticmethod
    def _parse_notes_qa(notes: str) -> list[tuple[str, str]]:
        """Parse security Q&A from the Notes field.

        Format: one pair per line as ``keyword: answer``.
        Lines starting with ``#`` and blank lines are ignored.
        Keywords are lowercased; answers are case-preserved.
        """
        pairs: list[tuple[str, str]] = []
        for line in notes.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" not in line:
                continue
            keyword, _, answer = line.partition(":")
            keyword = keyword.strip().lower()
            answer = answer.strip()
            if keyword and answer:
                pairs.append((keyword, answer))
        return pairs
