# Sharp21

A skill-based Blackjack mini app for the [Nimiq Mini Apps Competition](https://miniappscompetition.com). Built on the Nimiq Pay Mini Apps Framework.

Plays like real Blackjack — same table, same hit/stand flow, same dealer rules (stands on all 17s, no splits/doubles/insurance). The difference is what the money is scored on: **your payout depends on how many of your hit/stand decisions matched basic strategy, not on whether any individual hand's cards went your way.** No side ever gets paid because another side lost a hand — everyone is scored independently against a published, skill-only rule.

## Modes

- **Play (PvE)** — you vs. the house dealer. This is the real, scored mode: every hit/stand decision is graded against basic strategy, and that grade is what will drive the real NIM payout.
- **Watch bots** — a spectate-only demo where both seats auto-play (the "player" seat plays textbook basic strategy). Nothing is at stake and it never touches the real Skill Score — a bot playing perfectly forever can't be allowed to top a real leaderboard.
- **PvP** — intentionally not built. Real matched-live-opponent play would be the single biggest engineering piece in this project (matchmaking + real-time state sync), and the payout mechanic doesn't need an opponent — it's graded solo. Deferred in favor of the wallet/backend work below, which the competition actually requires.

## Status

- **Real, working:** the game engine, the UI (mini-app + web), and NIM entry-fee payment via `@nimiq/mini-app-sdk`'s `sendBasicTransaction` — when opened inside Nimiq Pay, tapping a bet chip requests a real wallet confirmation. Outside Nimiq Pay (a plain browser), the same UI falls back to a local demo automatically.
- **Blocked on a real treasury address:** `src/nimiq/client.ts`'s `TREASURY_ADDRESS` is still a placeholder, so even inside Nimiq Pay, payment requests currently refuse to fire rather than send funds somewhere wrong.
- **Not yet built:** server-authoritative hand dealing/grading (client-side decision scoring can currently be spoofed via devtools), the leaderboard, and the one-time end-of-window payout job — all need a backend, which needs a hosting decision.

## Development

```bash
npm install
npm run dev
```

## License

MIT — see [LICENSE](./LICENSE).
