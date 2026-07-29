#!/usr/bin/env node
/**
 * Sharp21 treasury payout signer.
 *
 * Runs ONLY on the project owner's own machine, never on Railway or any
 * server. The treasury private key never leaves this process. See README.md
 * in this directory before running.
 */
import { Address, Client, ClientConfiguration, KeyPair, PrivateKey, TransactionBuilder } from "@nimiq/core";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as readline from "node:readline/promises";
import { computeBatchId, type PayoutLine } from "./batchId.js";
import { getEntry, LedgerLock, loadLedger, saveLedger, setEntry } from "./ledger.js";

const BACKEND_URL = process.env.SHARP21_BACKEND_URL;
const READ_TOKEN = process.env.SHARP21_PAYOUT_READ_TOKEN;
const CONFIRM_TOKEN = process.env.SHARP21_PAYOUT_CONFIRM_TOKEN;
const NETWORK = process.env.SHARP21_NETWORK ?? "TestAlbatross";
const KEY_PATH = process.env.SHARP21_TREASURY_KEY_PATH ?? join(homedir(), ".sharp21-treasury", "key.hex");
const LEDGER_PATH = join(process.cwd(), "payout-ledger.json");
const LOCK_PATH = join(process.cwd(), "payout-ledger.lock");
const MAX_RECIPIENT_SHARE = 0.35;
const DUST_TOLERANCE_LUNA = 100; // 0.001 NIM

const EXECUTE = process.argv.includes("--execute");

function assertEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

interface PayoutBatch {
  batchId: string;
  windowId: string;
  payouts: PayoutLine[];
  totalLuna: number;
}

async function fetchBatch(): Promise<PayoutBatch> {
  const res = await fetch(`${BACKEND_URL}/api/payout-batch`, {
    headers: { Authorization: `Bearer ${READ_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch payout batch: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as PayoutBatch;
}

async function confirmBatch(batchId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/payout-batch/${batchId}/confirm`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CONFIRM_TOKEN}` },
  });
  if (!res.ok) {
    console.warn(`Warning: failed to mark batch confirmed on the backend: ${res.status} ${await res.text()}`);
  }
}

function loadTreasuryKeyHex(): string {
  if (existsSync(KEY_PATH)) {
    return readFileSync(KEY_PATH, "utf-8").trim();
  }
  console.error(`No key found at ${KEY_PATH}.`);
  console.error(`Set SHARP21_TREASURY_KEY_PATH to point elsewhere, or place the hex-encoded private key there.`);
  process.exit(1);
}

function validateBatch(batch: PayoutBatch): void {
  const recomputed = computeBatchId(batch.windowId, batch.payouts);
  if (recomputed !== batch.batchId) {
    throw new Error(
      `Batch id mismatch: server sent ${batch.batchId} but recomputing from its own payload gives ${recomputed}. ` +
        `This means the batch was corrupted or tampered with in transit. Aborting - do not proceed.`,
    );
  }
  const sum = batch.payouts.reduce((s, p) => s + p.amountLuna, 0);
  if (sum !== batch.totalLuna) {
    throw new Error(`Payout amounts (${sum} Luna) don't sum to the reported total (${batch.totalLuna} Luna). Aborting.`);
  }
  for (const p of batch.payouts) {
    if (p.amountLuna > batch.totalLuna * MAX_RECIPIENT_SHARE) {
      throw new Error(
        `Payout to rank ${p.rank} (${p.amountLuna} Luna) exceeds the ${MAX_RECIPIENT_SHARE * 100}% per-recipient cap. Aborting.`,
      );
    }
    try {
      Address.fromUserFriendlyAddress(p.payoutAddress);
    } catch {
      throw new Error(`Payout address for rank ${p.rank} ("${p.payoutAddress}") failed checksum validation. Aborting.`);
    }
  }
}

function printDryRun(batch: PayoutBatch): void {
  console.log(`\nBatch ${batch.batchId}`);
  console.log(`Total pool: ${batch.totalLuna / 100_000} NIM\n`);
  console.log("rank | address                                       | amount (NIM)");
  console.log("-----|-----------------------------------------------|-------------");
  for (const p of batch.payouts) {
    console.log(`${String(p.rank).padStart(4)} | ${p.payoutAddress.padEnd(45)} | ${(p.amountLuna / 100_000).toFixed(5)}`);
  }
  console.log();
}

async function main() {
  assertEnv("SHARP21_BACKEND_URL", BACKEND_URL);
  assertEnv("SHARP21_PAYOUT_READ_TOKEN", READ_TOKEN);

  const batch = await fetchBatch();
  validateBatch(batch);
  printDryRun(batch);

  if (!EXECUTE) {
    console.log("Dry run only. Re-run with --execute to actually send transactions.");
    return;
  }
  assertEnv("SHARP21_PAYOUT_CONFIRM_TOKEN", CONFIRM_TOKEN);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const typed = await rl.question(`Type "CONFIRM PAYOUT ${batch.batchId}" to proceed: `);
  rl.close();
  if (typed !== `CONFIRM PAYOUT ${batch.batchId}`) {
    console.log("Confirmation did not match. Aborting - nothing was sent.");
    return;
  }

  const lock = new LedgerLock(LOCK_PATH);
  lock.acquire();
  try {
    const keyPair = KeyPair.derive(PrivateKey.fromHex(loadTreasuryKeyHex()));
    const treasuryAddress = keyPair.toAddress();

    console.log(`Connecting to Nimiq ${NETWORK}...`);
    const config = new ClientConfiguration();
    config.network(NETWORK);
    const client = await Client.create(config.build());
    await client.waitForConsensusEstablished();
    console.log("Consensus established.");

    const account = await client.getAccount(treasuryAddress);
    const balanceLuna = account.balance;
    if (balanceLuna < batch.totalLuna - DUST_TOLERANCE_LUNA) {
      throw new Error(
        `Treasury balance (${balanceLuna} Luna) is less than the batch total (${batch.totalLuna} Luna). Aborting - nothing was sent.`,
      );
    }

    const ledger = loadLedger(LEDGER_PATH);
    const networkId = await client.getNetworkId();
    const headHeight = await client.getHeadHeight();

    for (const payout of batch.payouts) {
      const existing = getEntry(ledger, batch.batchId, payout.payoutAddress);
      if (existing?.status === "sent") {
        console.log(`Rank ${payout.rank} (${payout.payoutAddress}): already sent per local ledger (${existing.txHash}). Skipping.`);
        continue;
      }

      // Chain-check-before-resend: Nimiq has no account nonce to dedupe a
      // retry, so a fresh signature is a distinct, independently-valid
      // transaction. Querying the treasury's own outgoing history for a
      // matching payment is the only real protection against a double-pay.
      const recentTxs = await client.getTransactionsByAddress(treasuryAddress, headHeight - 5000, null, null, 100);
      const alreadySent = recentTxs.find((tx) => tx.recipient === payout.payoutAddress && tx.value === payout.amountLuna);
      if (alreadySent) {
        console.log(`Rank ${payout.rank}: found a matching on-chain payment already (${alreadySent.transactionHash}). Recording and skipping.`);
        setEntry(ledger, batch.batchId, payout.payoutAddress, {
          status: "sent",
          txHash: alreadySent.transactionHash,
          amountLuna: payout.amountLuna,
          recordedAt: new Date().toISOString(),
        });
        saveLedger(LEDGER_PATH, ledger);
        continue;
      }

      const recipientAddress = Address.fromUserFriendlyAddress(payout.payoutAddress);
      const tx = TransactionBuilder.newBasic(treasuryAddress, recipientAddress, BigInt(payout.amountLuna), null, headHeight, networkId);
      keyPair.signTransaction(tx);
      const txHash = tx.hash();

      setEntry(ledger, batch.batchId, payout.payoutAddress, {
        status: "broadcasting",
        txHash,
        amountLuna: payout.amountLuna,
        recordedAt: new Date().toISOString(),
      });
      saveLedger(LEDGER_PATH, ledger); // claim written before broadcast, not after

      console.log(`Rank ${payout.rank}: sending ${payout.amountLuna / 100_000} NIM to ${payout.payoutAddress} (tx ${txHash})...`);
      await client.sendTransaction(tx);

      setEntry(ledger, batch.batchId, payout.payoutAddress, {
        status: "sent",
        txHash,
        amountLuna: payout.amountLuna,
        recordedAt: new Date().toISOString(),
      });
      saveLedger(LEDGER_PATH, ledger);
      console.log(`Rank ${payout.rank}: sent.`);
    }

    await confirmBatch(batch.batchId);
    console.log("\nAll payouts complete. Spot-check the tx hashes above on a block explorer, then rotate/delete the treasury key file.");
  } finally {
    lock.release();
  }
}

main().catch((err) => {
  console.error("\nAborted:", err instanceof Error ? err.message : err);
  process.exit(1);
});
