# Gap #5: SDTM SFTP Credentials

**Severity:** Blocking
**Effort:** XL (1-3 days — dominated by FinCEN registration and TCC testing turnaround, not engineering work)
**Depends on:** None (independent of Gap #3)

## Problem

The D2C app cannot submit FBARs to FinCEN. The SDTM SFTP client (`d2c/src/lib/sdtm.ts`) is fully implemented but operates in sandbox mode: it logs what it _would_ do without making any real SFTP connection. `SDTM_SANDBOX_MODE=true` in the current production `.env` means that every filing marked `PAID` triggers a fake upload and never reaches FinCEN.

Additionally, before live SFTP credentials can be obtained, the organization must complete BSA E-Filing registration, pass TCC test submission validation, and coordinate with FinCEN to configure SDTM connectivity. This is a multi-step administrative process with external dependencies.

## Current State

**`d2c/src/lib/sdtm.ts` — line 18** (sandbox flag):
```ts
const isSandbox = () => process.env.SDTM_SANDBOX_MODE === "true";
```

**`d2c/src/lib/sdtm.ts` — lines 57-61** (`submitBatch` sandbox branch):
```ts
if (isSandbox()) {
  console.warn("[SDTM SANDBOX] Would upload to:", remoteFilePath);
  console.warn("[SDTM SANDBOX] XML length:", xmlContent.length, "bytes");
  return { success: true, batchId, remoteFilePath };
}
```
This branch always returns `success: true` regardless of whether any file was actually transmitted.

**`d2c/src/lib/sdtm.ts` — lines 101-104** (`checkAcknowledgement` sandbox branch):
```ts
if (isSandbox()) {
  console.warn("[SDTM SANDBOX] Checking acknowledgement for batch:", batchId);
  return { status: "pending" };
}
```
Acknowledgement polling always returns `pending` in sandbox mode — filings never reach `SUBMITTED` or receive a BSA ID.

**`d2c/src/lib/sdtm.ts` — lines 20-46** (SFTP connection config):
```ts
function getSFTPConnectConfig(): Record<string, unknown> {
  const config: Record<string, unknown> = {
    host: process.env.SDTM_HOST,
    port: parseInt(process.env.SDTM_PORT || "22"),
    username: process.env.SDTM_USERNAME,
  };

  const keyPath = process.env.SDTM_PRIVATE_KEY_PATH;
  if (keyPath) {
    config.privateKey = fs.readFileSync(keyPath);  // line 29
  }

  const hostKey = process.env.SDTM_HOST_KEY;
  if (hostKey) {
    config.hostVerifier = (key: Buffer) => { ... };  // lines 34-39
  } else {
    console.warn("[SDTM] SFTP_HOST_KEY not set — skipping host key verification (unsafe for production)");
  }
  return config;
}
```
`SDTM_PRIVATE_KEY_PATH` is read via `fs.readFileSync` — the key file must exist at a path accessible inside the `d2c-app` container. The SSH private key cannot be passed as a string in `.env`; it must be mounted as a Docker volume or secret.

**`docker-compose.prod.yml` — lines 212-217** (environment mapping):
```yaml
- SDTM_HOST=${SDTM_HOST}
- SDTM_PORT=${SDTM_PORT}
- SDTM_USERNAME=${SDTM_USERNAME}
- SDTM_PRIVATE_KEY_PATH=${SDTM_PRIVATE_KEY_PATH}
- SDTM_REMOTE_DIR=${SDTM_REMOTE_DIR}
- SDTM_SANDBOX_MODE=${SDTM_SANDBOX_MODE}
```
All six variables are mapped, but no volume is defined for the SSH key file.

**`.env.unified.example` — lines 138-144** (current placeholder values):
```
SDTM_HOST=
SDTM_PORT=22
SDTM_USERNAME=
SDTM_PRIVATE_KEY_PATH=
SDTM_REMOTE_DIR=/upload
SDTM_SANDBOX_MODE=true
```

**`claudedocs/d2c-fbar-filing-compliance.md` — Action Items Checklist** identifies the following as blocking before live filing:
- Register as Institution on BSA E-Filing (item 1)
- Submit batch test with TCC `TBSATEST` — 25-50 FBARs (item 3)
- Receive production TCC from FinCEN — issued after successful test (item 4)
- Contact FinCEN help desk for SDTM setup (item 5)
- Configure SFTP credentials for production (item 7)

## Implementation Plan

### Step 1: Register as an Institution on BSA E-Filing

This is a prerequisite for everything else. SDTM credentials are issued only to registered institutions.

1. Navigate to `https://bsaefiling.fincen.gov/enroll`.
2. Select **Institution** (not Individual).
3. Complete the enrollment form. There is no vetting process — approval is self-service.
4. Record the **Supervisory User** credentials that are issued upon confirmation.
5. The Supervisory User can create General User accounts for staff who will monitor filing status.

### Step 2: Generate an SSH key pair for SDTM

FinCEN requires SSH key authentication for SDTM SFTP access.

On the Hetzner VPS (or locally, then copy to server):

```bash
ssh-keygen -t ed25519 -C "fbardirect-sdtm" -f /root/sdtm-key -N ""
# This creates:
#   /root/sdtm-key        (private key — never share)
#   /root/sdtm-key.pub    (public key — provide to FinCEN)
```

Move the private key to a dedicated directory with restricted permissions:

```bash
mkdir -p /etc/fbar-secrets/sdtm
mv /root/sdtm-key /etc/fbar-secrets/sdtm/id_ed25519
chmod 600 /etc/fbar-secrets/sdtm/id_ed25519
chmod 700 /etc/fbar-secrets/sdtm
```

The public key (`/root/sdtm-key.pub`) will be provided to FinCEN in Step 3.

### Step 3: Contact FinCEN to configure SDTM

This step initiates the external SFTP provisioning process. Expected turnaround: several business days.

Contact the FinCEN help desk:
- **Phone:** 1-866-346-9478
- **Email:** BSAEFilingHelp@fincen.gov

Provide the following:
1. Your BSA E-Filing institution name and Supervisory User account name (from Step 1)
2. The **server's public IP address**: `178.156.250.116`
3. Your SSH public key (`/root/sdtm-key.pub` contents)
4. Node name (any descriptive label, e.g., `FBARDIRECT-NODE-1`)

FinCEN will:
- Open firewall rules allowing your IP to reach their SFTP host
- Register your public key on their system
- Provide you the SDTM hostname, username, and host fingerprint

Record the values FinCEN returns — you will need them for `SDTM_HOST`, `SDTM_USERNAME`, and `SDTM_HOST_KEY`.

### Step 4: Run TCC test submissions

Before live filing, FinCEN requires a batch test using transmitter code `TBSATEST`:

1. Generate 25-50 sample FBAR XML files using the existing XML generator (ported from B2B at `fbar-automator/src/`).
2. Each XML file must use `<TransmitterCode>TBSATEST</TransmitterCode>` (not the production TCC).
3. Submit files via the BSA E-Filing web portal (simpler than SFTP for testing — no SDTM required at this stage).
4. Wait approximately 10 business days for FinCEN to validate.
5. Upon successful validation, FinCEN issues the **production TCC** (format: `PBSA####`). Record it.

The production TCC must be embedded in all live FBAR XML submissions. The XML generator must be updated to use the production TCC before going live.

### Step 5: Obtain the SDTM host key fingerprint

Once FinCEN has provisioned your SDTM access, obtain their host key fingerprint for `SDTM_HOST_KEY`. Without this, the code at `sdtm.ts` lines 42-43 logs a warning and skips host verification — a security risk for a financial transmission channel.

```bash
# After FinCEN provides the hostname:
ssh-keyscan -t ed25519 <SDTM_HOST_PROVIDED_BY_FINCEN> 2>/dev/null | awk '{print $3}'
# This prints the base64 host key to set as SDTM_HOST_KEY
```

### Step 6: Mount the SSH private key into the Docker container

The `d2c-app` container runs as read-only (`read_only: true` in `docker-compose.prod.yml` line 244). The SSH key must be mounted as a read-only bind volume.

Edit `docker-compose.prod.yml` to add a volume mount to the `d2c-app` service:

```yaml
d2c-app:
  # ... existing config ...
  volumes:
    - /etc/fbar-secrets/sdtm/id_ed25519:/run/secrets/sdtm_key:ro
```

Then set `SDTM_PRIVATE_KEY_PATH=/run/secrets/sdtm_key` in `.env`.

This is the only source code / compose change required.

### Step 7: Update the production `.env` on the Hetzner VPS

```bash
ssh root@178.156.250.116
nano /root/atmix/fbar-automator/.env
```

Set all SDTM variables (values from FinCEN provisioning):

```
SDTM_HOST=<hostname provided by FinCEN>
SDTM_PORT=22
SDTM_USERNAME=<username provided by FinCEN>
SDTM_PRIVATE_KEY_PATH=/run/secrets/sdtm_key
SDTM_REMOTE_DIR=/upload
SDTM_SANDBOX_MODE=false
SDTM_HOST_KEY=<base64 fingerprint from ssh-keyscan in Step 5>
```

Note: `SDTM_HOST_KEY` is not currently listed in `.env.unified.example` — add it. The variable is already read by `sdtm.ts` at lines 33-43.

### Step 8: Redeploy the D2C container

```bash
cd /root/atmix/fbar-automator
docker compose -f docker-compose.prod.yml up -d --force-recreate d2c-app
```

`--force-recreate` is required (not just `--no-build`) because the new volume mount is a compose-level configuration change that requires the container to be destroyed and recreated.

## Files to Modify

| File | Change |
|---|---|
| `docker-compose.prod.yml` | Add `volumes` block to `d2c-app` service to mount SSH private key at `/run/secrets/sdtm_key:ro` |
| `.env` (on VPS, not tracked in git) | Set `SDTM_HOST`, `SDTM_USERNAME`, `SDTM_PRIVATE_KEY_PATH`, `SDTM_HOST_KEY`, `SDTM_SANDBOX_MODE=false` |
| `.env.unified.example` | Add `SDTM_HOST_KEY=` placeholder so it appears in the template for future deployments |

No changes to `d2c/src/lib/sdtm.ts` are required — the live code path is already implemented.

## Environment / Config Changes

| Variable | Where | Value |
|---|---|---|
| `SDTM_HOST` | VPS `.env` | Hostname provided by FinCEN (e.g., `sdtm.fincen.gov`) |
| `SDTM_PORT` | VPS `.env` | `22` (default, confirm with FinCEN) |
| `SDTM_USERNAME` | VPS `.env` | Username provided by FinCEN |
| `SDTM_PRIVATE_KEY_PATH` | VPS `.env` | `/run/secrets/sdtm_key` (container-internal path) |
| `SDTM_REMOTE_DIR` | VPS `.env` | `/upload` (confirm with FinCEN — default is usually correct) |
| `SDTM_SANDBOX_MODE` | VPS `.env` | `false` |
| `SDTM_HOST_KEY` | VPS `.env` | Base64 host fingerprint from `ssh-keyscan` |

Docker compose change required:

```yaml
# In docker-compose.prod.yml, d2c-app service:
volumes:
  - /etc/fbar-secrets/sdtm/id_ed25519:/run/secrets/sdtm_key:ro
```

## Testing

### Verify sandbox mode is off

```bash
docker compose -f docker-compose.prod.yml exec d2c-app env | grep SDTM
# SDTM_SANDBOX_MODE must be "false"
# SDTM_HOST must be non-empty
# SDTM_PRIVATE_KEY_PATH must be /run/secrets/sdtm_key
```

### Verify key file is accessible inside container

```bash
docker compose -f docker-compose.prod.yml exec d2c-app ls -la /run/secrets/sdtm_key
# Should show the file with permissions 600
```

### Test SFTP connectivity from the container

```bash
docker compose -f docker-compose.prod.yml exec d2c-app \
  sh -c "ssh -i /run/secrets/sdtm_key -o StrictHostKeyChecking=no \
         -o BatchMode=yes -p 22 \
         <SDTM_USERNAME>@<SDTM_HOST> ls /upload"
# Should list files in the upload directory or return empty without error
```

### Test a live submission end-to-end

1. Complete a full filing through the D2C wizard.
2. Complete payment (requires Gap #3 to be resolved first, or trigger the submission step directly via the API).
3. Check container logs for SDTM output:

```bash
docker compose -f docker-compose.prod.yml logs d2c-app --tail=100 | grep SDTM
# In live mode: no "[SDTM SANDBOX]" lines should appear
# Should see connection events from the ssh2 library
```

4. Confirm the file appears in the FinCEN SDTM `/upload` directory (verify via the BSA E-Filing web portal or another SFTP session).
5. Poll for acknowledgement and confirm the filing reaches `SUBMITTED` status with a BSA ID:

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U fbar -d fbar_direct \
  -c "SELECT id, status, \"bsaId\" FROM \"FilingYear\" ORDER BY \"updatedAt\" DESC LIMIT 5;"
```

### Verify host key verification is enforced

Check logs for the warning line from `sdtm.ts` line 42-43:

```bash
docker compose -f docker-compose.prod.yml logs d2c-app | grep "host key"
# Should NOT see: "[SDTM] SFTP_HOST_KEY not set — skipping host key verification"
# If this warning appears, SDTM_HOST_KEY is not set — fix before going live
```

## Risks / Notes

- **SDTM is not standard SFTP.** FinCEN's SDTM infrastructure requires explicit firewall allowlisting of the client IP (`178.156.250.116`). If the VPS IP changes (e.g., server migration), FinCEN must be contacted again to update their firewall rules. Document the VPS IP in the ops runbook before going live.

- **SSH key rotation.** FinCEN may require key rotation. Establish a process: generate new key, provide public key to FinCEN, receive confirmation, swap private key at `/etc/fbar-secrets/sdtm/id_ed25519`, and `docker compose up --force-recreate d2c-app`. The old key should not be deleted until FinCEN confirms the new one is active.

- **Production TCC is required in XML.** The D2C app's XML generator (ported from B2B) must use the production TCC issued after TCC testing (Step 4). Filing with `TBSATEST` in production will be rejected. Verify the TCC value in the XML generator before flipping `SDTM_SANDBOX_MODE=false`.

- **FinCEN acknowledgement polling.** The `checkAcknowledgement` function (`sdtm.ts` lines 98-182) reads from the `/download` directory (derived from `SDTM_REMOTE_DIR` by substituting `/upload` with `/download` at line 118). Confirm with FinCEN that this directory naming convention matches their actual setup. If the acknowledgement directory has a different name, the polling logic will always return `pending`.

- **Alternative to SDTM: web portal batch upload.** As noted in `claudedocs/d2c-fbar-filing-compliance.md` (Section 2), the BSA E-Filing web portal supports manual batch XML upload without SDTM. This is viable for low filing volumes during early launch. The tradeoff: manual portal uploads require an operator to upload each batch by hand; SDTM is fully automated. Consider starting with portal uploads while SDTM provisioning is in progress.

- **Container is read-only.** The `d2c-app` service has `read_only: true` (compose line 244). The SSH key mount uses `:ro` on the host side. The `ssh2` library (`SFTPClient`) reads the key via `fs.readFileSync` at `sdtm.ts` line 29 — it does not write the key, so read-only mount is correct. Do not mount the key as writable.

- **Sandbox mode is a string comparison.** `isSandbox()` at `sdtm.ts` line 18 checks `=== "true"`. Any value other than the exact string `"true"` (including `"True"`, `"1"`, `"yes"`) will disable sandbox mode. Setting `SDTM_SANDBOX_MODE=false` or leaving it empty are both equivalent to live mode.

- **Timeline estimate.** BSA E-Filing registration is same-day (self-service). SDTM provisioning by FinCEN typically takes 3-5 business days. TCC testing validation takes approximately 10 business days. Total blocking time before live filing is possible: approximately 2-3 weeks from initiation.
