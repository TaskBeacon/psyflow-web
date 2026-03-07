import { describe, expect, it } from "vitest";

import { count_down } from "../../src";

describe("count_down", () => {
  it("builds non-exported countdown display trials", () => {
    const trials = count_down({
      seconds: 3,
      block_id: "block_0",
      trial_id_prefix: "countdown_block_0",
      stim: {
        color: "black",
        height: 4
      }
    });

    expect(trials).toHaveLength(3);
    expect(trials.map((trial) => trial.trial_id)).toEqual([
      "countdown_block_0_3",
      "countdown_block_0_2",
      "countdown_block_0_1"
    ]);
    expect(trials.every((trial) => trial.units[0]?.export_to_reduced === false)).toBe(true);
    expect(trials.map((trial) => trial.units[0]?.stim_refs[0])).toEqual([
      {
        type: "text",
        text: "3",
        color: "black",
        height: 4,
        alignment: "center"
      },
      {
        type: "text",
        text: "2",
        color: "black",
        height: 4,
        alignment: "center"
      },
      {
        type: "text",
        text: "1",
        color: "black",
        height: 4,
        alignment: "center"
      }
    ]);
  });
});
