/**
 * TODO(on-chain verification): this does not yet verify a reported
 * entry_fee_tx_hash against the real chain (sender/recipient/amount) - it
 * only checks the hash looks well-formed and hasn't been reused. This is a
 * known, disclosed gap (see README "Status"), not a hidden one: a client
 * could currently report a plausible-looking but fake hash. Wiring this up
 * needs Nimiq's RPC getTransactionByHash against a public testnet/mainnet
 * node once one is confirmed reachable and its response shape verified
 * directly (nimiq.dev's docs page for it doesn't render example JSON via a
 * plain fetch - it needs the interactive playground). Until then, hands
 * recording is best-effort, matching the rest of the client-trust model
 * server-authoritative dealing will eventually replace.
 */
export function looksLikeTxHash(hash: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(hash) || /^[0-9a-fA-F]{40,72}$/.test(hash);
}
