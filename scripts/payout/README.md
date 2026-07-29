# Sharp21 payout signer

Signs and sends the one-time end-of-window NIM payout. **Run this only on your own
machine, never on Railway or any server.** The treasury private key never leaves
this process — it isn't sent to the backend, isn't logged, and isn't stored
anywhere except the local key file you point it at.

## Setup

```bash
cd scripts/payout
npm install
```

Place the treasury's raw hex-encoded private key at `~/.sharp21-treasury/key.hex`
(`chmod 600` it), or set `SHARP21_TREASURY_KEY_PATH` to wherever it actually is.

Set these environment variables before running:

```bash
export SHARP21_BACKEND_URL=https://<your-railway-domain>
export SHARP21_PAYOUT_READ_TOKEN=<the PAYOUT_READ_TOKEN set on the backend service>
export SHARP21_PAYOUT_CONFIRM_TOKEN=<the PAYOUT_CONFIRM_TOKEN set on the backend service>
export SHARP21_NETWORK=TestAlbatross   # or MainAlbatross once this handles real funds
```

## Usage

1. **Dry run** (default — sends nothing):
   ```bash
   npm start
   ```
   Prints the computed batch: rank, address, amount. Nothing is sent.

2. **Before executing**, manually compare the printed addresses/amounts against
   the live public leaderboard page. This is the one real second set of eyes
   on the thing that actually matters (correct address per rank) — there's no
   independent second data pipeline for this yet.

3. **Execute**:
   ```bash
   npm start -- --execute
   ```
   You'll be asked to type `CONFIRM PAYOUT <batchId>` verbatim before anything
   is signed or sent.

4. **After it finishes**, spot-check the printed transaction hashes on a block
   explorer, then delete or rotate `~/.sharp21-treasury/key.hex` (or unset the
   env var, if you used one instead of a file).

## Safety properties

- **Never touches Railway.** The backend only exposes a read-only
  `/api/payout-batch` endpoint (no key) and a confirm endpoint for
  bookkeeping. Signing happens only here, locally.
- **Recomputes the batch id** from the server's own payload before doing
  anything else, and aborts if it doesn't match — catches transit corruption
  or tampering.
- **Validates** every address's checksum, that amounts sum to the reported
  total, and that no single payout exceeds 35% of the pool.
- **Checks the treasury's live on-chain balance** covers the batch before
  sending anything.
- **Idempotent across crashes/re-runs**: before signing anything, it queries
  the treasury's own on-chain transaction history for an already-matching
  payment (recipient + amount) — this, not the local ledger file, is what
  actually prevents a double-pay, since Nimiq has no account nonce to dedupe
  a retry the way Ethereum does. The local `payout-ledger.json` plus a lock
  file (`payout-ledger.lock`) additionally block a second concurrent
  invocation outright and cache what's already been confirmed sent, so a
  re-run doesn't need to re-query the chain for entries it already knows
  about.
- **Fails closed.** Any validation error aborts the entire batch — no
  silent partial-skip of a bad row.

## Known limitation

`/api/payout-batch/:batchId/confirm` (the bookkeeping call this script makes
after sending) does not itself verify the transactions on-chain — it trusts
this script's report. The real verification is the manual leaderboard-diff
step above and the spot-check afterward.
