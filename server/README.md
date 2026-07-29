# Sharp21 backend

Records graded hands and computes the skill leaderboard. Node.js + Express + Postgres.

## Endpoints

- `POST /api/hands` — record one graded hand (device id, decision counts, wager, entry-fee tx hash, payout address)
- `GET /api/leaderboard` — public, top 10 by total correct decisions among devices meeting the minimum-hands floor
- `GET /api/payout-batch` — protected (`Authorization: Bearer $PAYOUT_READ_TOKEN`); computes the one-time payout batch for the most recently closed window
- `POST /api/payout-batch/:batchId/confirm` — protected (`Authorization: Bearer $PAYOUT_CONFIRM_TOKEN`); marks a batch paid after the local signer script (`../scripts/payout/`) has actually sent the transactions

## Status

- Hands are currently trusted as reported by the client (correct/total decision counts) — server-authoritative dealing/grading is not built yet.
- `entry_fee_tx_hash` is checked for a plausible shape and uniqueness, but **not yet verified on-chain** (see `src/nimiqRpc.ts`) — a known, disclosed gap, not a hidden one.
- The treasury private key never lives here, in any form, at any point. Payouts are signed and sent from the project owner's own machine — see `../scripts/payout/README.md`.

## Development

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and the two payout tokens
npm run migrate
npm run dev
npm test
```
