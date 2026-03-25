"""Standalone CLI for testing the 1Password credential store.

Usage:
    python -m onepassword_store.cli lookup "Acme Corp - Chase Business"
    python -m onepassword_store.cli list
    python -m onepassword_store.cli test-all
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from .store import CredentialError, CredentialStore


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="onepassword_store",
        description="Test and validate 1Password credential lookups.",
    )
    parser.add_argument(
        "--vault", default=None, help="Vault name (default: OP_VAULT or BankCredentials)"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug logging"
    )

    sub = parser.add_subparsers(dest="command", required=True)

    # lookup
    lk = sub.add_parser("lookup", help="Hydrate a single item and display results")
    lk.add_argument("item", help='Item title, e.g. "Acme Corp - Chase Business"')

    # list
    sub.add_parser("list", help="List all items in the vault")

    # test-all
    sub.add_parser("test-all", help="Try hydrating every item in the vault")

    return parser


async def _cmd_lookup(store: CredentialStore, item: str, vault: str | None) -> int:
    try:
        creds = await store.hydrate(item, vault=vault)
    except CredentialError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"Item:     {item}")
    print(f"Username: {creds.username}")
    print(f"Password: {'*' * len(creds.password)} ({len(creds.password)} chars)")
    print(f"TOTP:     {creds.totp_secret or '(none)'}")
    if creds.security_questions:
        print("Security Q&A:")
        for kw, ans in creds.security_questions:
            print(f"  {kw}: {ans}")
    else:
        print("Security Q&A: (none)")
    return 0


async def _cmd_list(store: CredentialStore, vault: str | None) -> int:
    try:
        titles = await store.list_items(vault=vault)
    except CredentialError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if not titles:
        print("(no items found)")
        return 0

    print(f"Items in vault ({len(titles)}):")
    for t in titles:
        print(f"  - {t}")
    return 0


async def _cmd_test_all(store: CredentialStore, vault: str | None) -> int:
    try:
        titles = await store.list_items(vault=vault)
    except CredentialError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if not titles:
        print("(no items to test)")
        return 0

    passed = 0
    failed = 0
    for title in titles:
        try:
            creds = await store.hydrate(title, vault=vault)
            totp = "totp" if creds.totp_secret else "no-totp"
            qa = f"{len(creds.security_questions)}qa"
            print(f"  OK   {title}  [{totp}, {qa}]")
            passed += 1
        except CredentialError as exc:
            print(f"  FAIL {title}  — {exc}")
            failed += 1

    print(f"\n{passed} passed, {failed} failed out of {len(titles)} items")
    return 1 if failed else 0


async def _main() -> int:
    parser = _build_parser()
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)-5s %(name)s: %(message)s",
    )

    store = CredentialStore()

    if args.command == "lookup":
        return await _cmd_lookup(store, args.item, args.vault)
    elif args.command == "list":
        return await _cmd_list(store, args.vault)
    elif args.command == "test-all":
        return await _cmd_test_all(store, args.vault)
    else:
        parser.print_help()
        return 1


def main() -> None:
    sys.exit(asyncio.run(_main()))


if __name__ == "__main__":
    main()
