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
    expect(first.conditions).toEqual(["neut", "neut", "win", "win", "lose", "lose"]);
  });

  it("matches canonical PsyFlow condition order for the H004 flanker schedule", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 3,
      total_trials: 180,
      trial_per_block: 60,
      conditions: ["congruent_left", "congruent_right", "incongruent_left", "incongruent_right"],
      overall_seed: 2025,
      seed_mode: "same_across_sub"
    });

    const block = new BlockUnit({
      block_id: "block_0",
      block_idx: 0,
      settings
    }).generate_conditions();

    expect(settings.block_seed.slice(0, 3)).toEqual([73105, 10839, 84652]);
    expect(block.conditions.slice(0, 20)).toEqual([
      "incongruent_left",
      "incongruent_right",
      "incongruent_left",
      "congruent_left",
      "incongruent_right",
      "congruent_right",
      "incongruent_left",
      "incongruent_right",
      "incongruent_right",
      "congruent_right",
      "congruent_left",
      "congruent_left",
      "incongruent_left",
      "incongruent_right",
      "congruent_left",
      "congruent_left",
      "congruent_right",
      "congruent_left",
      "incongruent_right",
      "congruent_right"
    ]);
  });

  it("matches canonical weighted Go/NoGo scheduling for H005", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 3,
      total_trials: 210,
      trial_per_block: 70,
      conditions: ["go", "nogo"],
      condition_weights: { go: 3, nogo: 1 },
      overall_seed: 2025,
      seed_mode: "same_across_sub"
    });

    const block = new BlockUnit({
      block_id: "block_0",
      block_idx: 0,
      settings
    }).generate_conditions();

    expect(block.conditions.filter((condition) => condition === "go")).toHaveLength(52);
    expect(block.conditions.filter((condition) => condition === "nogo")).toHaveLength(18);
    expect(block.conditions.slice(0, 30)).toEqual([
      "go",
      "go",
      "go",
      "go",
      "go",
      "go",
      "go",
      "go",
      "go",
      "go",
      "nogo",
      "go",
      "go",
      "go",
      "go",
      "go",
      "go",
      "go",
      "nogo",
      "go",
      "nogo",
      "go",
      "go",
      "go",
      "go",
      "nogo",
      "go",
      "nogo",
      "go",
      "nogo"
    ]);
  });
});
