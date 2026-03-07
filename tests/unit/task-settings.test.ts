import { describe, expect, it } from "vitest";

import { TaskSettings } from "../../src/core/TaskSettings";

describe("TaskSettings", () => {
  it("validates trial_per_block alias and writes subject-linked seeds", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 2,
      total_trials: 8,
      trial_per_block: 4,
      conditions: ["win", "lose"],
      seed_mode: "same_within_sub"
    });

    expect(settings.trials_per_block).toBe(4);
    expect(settings.trial_per_block).toBe(4);
    expect(settings.block_seed).toEqual([null, null]);

    settings.add_subinfo({ subject_id: "sub-001" });

    expect(settings.subject_id).toBe("sub-001");
    expect(settings.block_seed[0]).not.toBeNull();
    expect(settings.block_seed[1]).not.toBeNull();
  });

  it("resolves condition weights in config order", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 6,
      conditions: ["win", "lose", "neut"],
      condition_weights: { win: 2, lose: 1, neut: 1 }
    });

    expect(settings.resolve_condition_weights()).toEqual([2, 1, 1]);
  });
});
