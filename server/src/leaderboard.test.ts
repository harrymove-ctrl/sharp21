import { describe, expect, test } from "vitest";
import { aggregateHands, buildLeaderboard, computePayouts, MIN_HANDS_FOR_ELIGIBILITY, type HandRow } from "./leaderboard.js";

function hand(deviceId: string, correct: number, total: number): HandRow {
  return { deviceId, correctDecisions: correct, totalDecisions: total };
}

describe("aggregateHands", () => {
  test("sums decisions and counts hands per device", () => {
    const result = aggregateHands([hand("a", 2, 3), hand("a", 1, 1), hand("b", 5, 5)]);
    expect(result.get("a")).toEqual({ correctDecisions: 3, totalDecisions: 4, handsPlayed: 2 });
    expect(result.get("b")).toEqual({ correctDecisions: 5, totalDecisions: 5, handsPlayed: 1 });
  });
});

describe("buildLeaderboard", () => {
  test("excludes devices below the minimum-hands eligibility floor", () => {
    const hands = [hand("under", 100, 100)]; // 1 hand, way below the floor
    expect(buildLeaderboard(hands)).toEqual([]);
  });

  test("ranks eligible devices by total correct decisions descending", () => {
    const many = (deviceId: string, correctEach: number, count: number) =>
      Array.from({ length: count }, () => hand(deviceId, correctEach, correctEach));
    const hands = [...many("low", 1, MIN_HANDS_FOR_ELIGIBILITY), ...many("high", 2, MIN_HANDS_FOR_ELIGIBILITY)];

    const board = buildLeaderboard(hands);

    expect(board.map((e) => e.deviceId)).toEqual(["high", "low"]);
    expect(board[0].rank).toBe(1);
    expect(board[1].rank).toBe(2);
  });

  test("ties in correct decisions are broken by hands played, not left ambiguous", () => {
    const many = (deviceId: string, count: number) => Array.from({ length: count }, () => hand(deviceId, 1, 1));
    // Both accumulate 12 correct decisions; "grinder" needed more hands to get there.
    const hands = [...many("efficient", 12), ...many("grinder", 24).map((h, i) => (i < 12 ? h : { ...h, correctDecisions: 0 }))];

    const board = buildLeaderboard(hands);

    expect(board[0].deviceId).toBe("grinder"); // more hands played at the same correct-decision total
    expect(board[0].correctDecisions).toBe(board[1].correctDecisions);
  });

  test("a device meeting the floor exactly is eligible, not excluded", () => {
    const hands = Array.from({ length: MIN_HANDS_FOR_ELIGIBILITY }, () => hand("exact", 1, 1));
    expect(buildLeaderboard(hands)).toHaveLength(1);
  });
});

describe("computePayouts", () => {
  test("splits the pool across up to 10 winners on the published curve", () => {
    const leaderboard = Array.from({ length: 12 }, (_, i) => ({
      deviceId: `p${i + 1}`,
      correctDecisions: 100 - i,
      totalDecisions: 100,
      handsPlayed: 20,
      rank: i + 1,
    }));

    const payouts = computePayouts(leaderboard, 1_000_000);

    expect(payouts).toHaveLength(10); // only top 10 paid, even with 12 eligible
    expect(payouts[0]).toEqual({ deviceId: "p1", rank: 1, percentOfPool: 30, amountLuna: 300_000 });
    expect(payouts[9]).toEqual({ deviceId: "p10", rank: 10, percentOfPool: 1, amountLuna: 10_000 });
  });

  test("pays out fewer than 10 when fewer than 10 are eligible - no crash, no phantom winners", () => {
    const leaderboard = [{ deviceId: "solo", correctDecisions: 50, totalDecisions: 50, handsPlayed: 20, rank: 1 }];

    const payouts = computePayouts(leaderboard, 1_000_000);

    expect(payouts).toEqual([{ deviceId: "solo", rank: 1, percentOfPool: 30, amountLuna: 300_000 }]);
  });

  test("an empty leaderboard produces no payouts, not an error", () => {
    expect(computePayouts([], 1_000_000)).toEqual([]);
  });

  test("rejects a negative pool rather than silently computing negative amounts", () => {
    expect(() => computePayouts([], -1)).toThrow();
  });
});
