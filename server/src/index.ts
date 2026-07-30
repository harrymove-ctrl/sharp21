import express from "express";
import { getPool } from "./db.js";
import { createHandsRouteHandler } from "./routes/hands.js";
import { createLeaderboardRouteHandler } from "./routes/leaderboardRoute.js";
import { createGetPayoutBatchHandler, createConfirmPayoutBatchHandler } from "./routes/payoutRoute.js";
import { createDetectPaymentHandler } from "./routes/payDetectRoute.js";

const app = express();
app.use(express.json());

// Same-origin-agnostic CORS: this API is called directly from the Mini App's
// WebView origin (a github.io/Nimiq Pay origin, not this server's own), so a
// permissive-but-read-mostly CORS policy is required, not a bug.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const pool = getPool();

app.get("/health", (_req, res) => res.json({ ok: true }));
app.post("/api/hands", createHandsRouteHandler(pool));
app.get("/api/leaderboard", createLeaderboardRouteHandler(pool));
app.get("/api/payout-batch", createGetPayoutBatchHandler(pool));
app.post("/api/payout-batch/:batchId/confirm", createConfirmPayoutBatchHandler(pool));
app.get("/api/pay/detect", createDetectPaymentHandler());

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Sharp21 backend listening on port ${port}`);
});
