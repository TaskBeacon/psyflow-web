import { describe, expect, it } from "vitest";

import { resolveMidOutcome } from "../../../H000006-mid/src/utils";
import type { TrialSnapshot } from "../../src/core/types";

function makeSnapshot(units: TrialSnapshot["units"]): TrialSnapshot {
  return {
    trial_id: 1,
    block_id: "block_0",
    trial_index: 0,
    condition: "win",
    units,
    trial_state: {}
  };
}

describe("MID outcome utils", () => {
  it("treats anticipation early responses as misses", () => {
    const snapshot = makeSnapshot({
      anticipation: { early_response: "space" },
      target: { hit: true }
    });

    const outcome = resolveMidOutcome(snapshot, "win", 10);

    expect(outcome.hit).toBe(false);
    expect(outcome.delta).toBe(0);
    expect(outcome.hit_type).toBe("miss");
  });

  it("computes condition-specific deltas from target hits and misses", () => {
    expect(
      resolveMidOutcome(
        makeSnapshot({
          anticipation: { early_response: null },
          target: { hit: true }
        }),
        "win",
        10
      )
    ).toEqual({
      hit: true,
      delta: 10,
      hit_type: "hit"
    });

    expect(
      resolveMidOutcome(
        makeSnapshot({
          anticipation: { early_response: null },
          target: { hit: false }
        }),
        "lose",
        10
      )
    ).toEqual({
      hit: false,
      delta: -10,
      hit_type: "miss"
    });
  });
});
