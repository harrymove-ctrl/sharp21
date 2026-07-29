-- Each graded hand a player finishes. correct_decisions/total_decisions come
-- from the client's report right now (server-authoritative hand dealing is
-- not built yet - see README) but entry_fee_tx_hash is independently
-- verified on-chain before a row is accepted, which at least rules out
-- fabricated hands with zero real payment behind them.
CREATE TABLE IF NOT EXISTS hands (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  correct_decisions INT NOT NULL CHECK (correct_decisions >= 0),
  total_decisions INT NOT NULL CHECK (total_decisions >= correct_decisions),
  wager_luna BIGINT NOT NULL CHECK (wager_luna > 0),
  entry_fee_tx_hash TEXT NOT NULL UNIQUE,
  payout_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hands_device_id_idx ON hands (device_id);

-- One row per competition scoring window.
CREATE TABLE IF NOT EXISTS payout_windows (
  id BIGSERIAL PRIMARY KEY,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

-- A frozen snapshot of the computed leaderboard/split for one closed window,
-- keyed by a deterministic hash so the local signer script can verify it
-- received the exact same batch a second time (tamper/corruption check).
CREATE TABLE IF NOT EXISTS payout_batches (
  batch_id TEXT PRIMARY KEY,
  window_id BIGINT NOT NULL REFERENCES payout_windows (id),
  payouts JSONB NOT NULL,
  total_luna BIGINT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);
