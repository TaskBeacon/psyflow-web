import { describe, expect, it } from "vitest";

import { build_block_plan } from "../../../H000017-delay-discounting/src/utils";

describe("H000017 delay-discounting utils", () => {
  it("matches canonical Python MCQ block planning", () => {
    const plan = build_block_plan(5, {
      seed: 73105,
      condition_labels: ["small", "medium", "large"],
      config: {
        randomize_order: true,
        counterbalance_sides: true,
        ll_left_prob: 0.5
      }
    });

    expect(plan.map((trial) => trial.condition_id)).toEqual([
      "medium|item15|ll_left",
      "large|item26|ll_right",
      "small|item6|ll_right",
      "medium|item13|ll_right",
      "medium|item18|ll_left"
    ]);
    expect(plan.map((trial) => [trial.left_amount, trial.left_delay_days, trial.right_amount, trial.right_delay_days])).toEqual([
      [85, 35, 65, 0],
      [35, 0, 45, 20],
      [25, 0, 60, 14],
      [55, 0, 60, 117],
      [60, 89, 50, 0]
    ]);
  });
});
