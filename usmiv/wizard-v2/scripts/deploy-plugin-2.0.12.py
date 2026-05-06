#!/usr/bin/env python
"""
Deploy wizard-of-iv plugin files v2.0.12 via FTPS.
Run with: doppler run -p atmix -c prd_usmiv -- python scripts/deploy-plugin-2.0.12.py
"""
import ftplib, ssl, os, sys, hashlib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

UPLOADS = [
    # (local_path, remote_path)
    (
        os.path.join(BASE_DIR, "wordpress", "wizard-of-iv.php"),
        "wp-content/plugins/wizard-of-iv/wizard-of-iv.php",
    ),
    (
        os.path.join(BASE_DIR, "dist", "wizard.js"),
        "wp-content/plugins/wizard-of-iv/wizard.js",
    ),
    (
        os.path.join(BASE_DIR, "dist", "wizard.css"),
        "wp-content/plugins/wizard-of-iv/wizard.css",
    ),
    (
        os.path.join(BASE_DIR, "dist", "admin-dashboard.js"),
        "wp-content/plugins/wizard-of-iv/admin-dashboard.js",
    ),
    (
        os.path.join(BASE_DIR, "dist", "admin-dashboard.css"),
        "wp-content/plugins/wizard-of-iv/admin-dashboard.css",
    ),
    (
        os.path.join(BASE_DIR, "wordpress", "assets", "treatments-detail.json"),
        "wp-content/plugins/wizard-of-iv/assets/treatments-detail.json",
    ),
]


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def main():
    host = os.environ.get("RKT_SFTP_HOST", "").strip()
    user = os.environ.get("RKT_SFTP_USER", "").strip()
    password = os.environ.get("RKT_SFTP_PASS", "").strip()

    if not host or not user or not password:
        print("ERROR: Missing credentials. Need RKT_SFTP_HOST, RKT_SFTP_USER, RKT_SFTP_PASS.")
        sys.exit(1)

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    print(f"Connecting to {host}:21 via FTPS...")
    ftps = ftplib.FTP_TLS(host, context=ctx, timeout=60)
    ftps.login(user, password)
    ftps.prot_p()
    print("Connected and TLS data channel active.\n")

    results = []
    for local_path, remote_path in UPLOADS:
        if not os.path.exists(local_path):
            print(f"ERROR: Local file not found: {local_path}")
            results.append((remote_path, False, "file not found"))
            continue

        local_hash = sha256_file(local_path)
        local_size = os.path.getsize(local_path)
        print(f"Uploading {os.path.basename(local_path)} ({local_size:,} bytes)...")
        print(f"  -> {remote_path}")

        with open(local_path, "rb") as f:
            ftps.storbinary(f"STOR {remote_path}", f)

        # Verify
        buf = bytearray()
        ftps.retrbinary(f"RETR {remote_path}", buf.extend)
        remote_hash = sha256_bytes(bytes(buf))

        if remote_hash == local_hash:
            print(f"  OK (SHA-256 verified)\n")
            results.append((remote_path, True, "ok"))
        else:
            print(f"  ERROR: SHA-256 mismatch!\n")
            results.append((remote_path, False, "hash mismatch"))

    ftps.quit()
    print("FTP connection closed.\n")

    print("=== Upload Summary ===")
    all_ok = True
    for remote_path, ok, msg in results:
        status = "OK" if ok else "FAIL"
        print(f"  [{status}] {os.path.basename(remote_path)} -> {remote_path} ({msg})")
        if not ok:
            all_ok = False

    if not all_ok:
        print("\nSome uploads failed.")
        sys.exit(1)
    else:
        print("\nAll files uploaded and verified.")


if __name__ == "__main__":
    main()
