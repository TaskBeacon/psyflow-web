import { describe, expect, it } from "vitest";

import { BlockUnit } from "../../src/core/BlockUnit";
import { TaskSettings } from "../../src/core/TaskSettings";

describe("BlockUnit", () => {
  it("generates seeded and balanced conditions", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 6,
      conditions: ["win", "lose", "neut"],
      overall_seed: 2025,
      seed_mode: "same_across_sub"
    });

    const first = new BlockUnit({
      block_id: "block_0",
      block_idx: 0,
      settings
    }).generate_conditions();

    const second = new BlockUnit({
      block_id: "block_0",
      block_idx: 0,
      settings
    }).generate_conditions();

    expect(first.conditions).toEqual(second.conditions);
    expect(first.conditions).toHaveLength(6);
    expect(first.conditions.filter((condition) => condition === "win")).toHaveLength(2);
    expect(first.conditions.filter((condition) => condition === "lose")).toHaveLength(2);
    expect(first.conditions.filter((condition) => condition === "neut")).toHaveLength(2);
  });
});
