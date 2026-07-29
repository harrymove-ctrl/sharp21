import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

export type EntryStatus = "broadcasting" | "sent";

export interface LedgerEntry {
  status: EntryStatus;
  txHash: string;
  amountLuna: number;
  recordedAt: string;
}

export type Ledger = Record<string, Record<string, LedgerEntry>>; // batchId -> address -> entry

/**
 * Exclusive lock via atomic file creation ('wx' fails if the file already
 * exists) - blocks a second concurrent invocation of this script outright,
 * the same guarantee an flock would give, without a native dependency.
 */
export class LedgerLock {
  private readonly lockPath: string;
  private held = false;

  constructor(lockPath: string) {
    this.lockPath = lockPath;
  }

  acquire(): void {
    try {
      const fd = openSync(this.lockPath, "wx");
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      this.held = true;
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === "EEXIST") {
        throw new Error(
          `Lock file ${this.lockPath} already exists - another run may be in progress. ` +
            `If you're certain no other run is active (e.g. a previous run crashed), delete it and retry.`,
        );
      }
      throw err;
    }
  }

  release(): void {
    if (this.held && existsSync(this.lockPath)) {
      unlinkSync(this.lockPath);
      this.held = false;
    }
  }
}

export function loadLedger(path: string): Ledger {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function saveLedger(path: string, ledger: Ledger): void {
  writeFileSync(path, JSON.stringify(ledger, null, 2));
}

export function getEntry(ledger: Ledger, batchId: string, address: string): LedgerEntry | undefined {
  return ledger[batchId]?.[address];
}

export function setEntry(ledger: Ledger, batchId: string, address: string, entry: LedgerEntry): void {
  ledger[batchId] ??= {};
  ledger[batchId][address] = entry;
}
