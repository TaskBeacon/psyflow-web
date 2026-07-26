import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import {
  TwoStepController
} from "../../../H000075-two-step-sequential-decision-task/src/controller";
import { run_trial } from "../../../H000075-two-step-sequential-decision-task/src/run_trial";
import {
  counterbalanceGroup,
  makePlans
} from "../../../H000075-two-step-sequential-decision-task/src/utils";

function settings() {
  const value = TaskSettings.from_dict({
    total_blocks: 4,
    total_trials: 251,
    trial_per_block: 63,
    conditions: ["sequential_decision"],
    left_key: "f",
    right_key: "j",
    fixation_duration: 0.5,
    stage1_choice_window: 2,
    stage2_choice_window: 2,
    outcome_duration: 1,
    iti_duration: 1
  }) as TaskSettings & Record<string, unknown>;
  value.triggers = {
    map: {
      fixation: 20,
      stage1_choice: 30,
      stage1_left_response: 31,
      stage1_right_response: 32,
      stage1_timeout: 33,
      stage2_pink: 40,
      stage2_blue: 41,
      stage2_left_response: 42,
      stage2_right_response: 43,
      stage2_timeout: 44,
      transition_common: 50,
      transition_rare: 51,
      outcome_rewarded: 60,
      outcome_unrewarded: 61,
      outcome_timeout: 62,
      iti: 70
    }
  };
  return value;
}

function stimBank() {
  return new StimBank({
    fixation: { type: "text", text: "+" },
    card_left: { type: "image", image: "left.png" },
    card_right: { type: "image", image: "right.png" },
    stage1_label: { type: "text", text: "FIRST CHOICE" },
    state_pink: { type: "text", text: "PINK STATE" },
    state_blue: { type: "text", text: "BLUE STATE" },
    reward_coin: { type: "image", image: "coin.png" },
    unrewarded_zero: { type: "text", text: "0" },
    coin_count: { type: "text", text: "Coins: {total_reward}" },
    feedback_timeout: { type: "text", text: "TOO SLOW" },
    blank: { type: "text", text: "" }
  });
}

describe("H000075 two-step sequential decision task", () => {
  it("matches the canonical Python seeded controller trajectory", () => {
    const controller = new TwoStepController({
      seed: 75175,
      mapping_swapped: true
    });
    expect(controller.transition("stage1_a")).toEqual({
      second_state: "blue",
      transition_type: "common",
      common: true,
      draw: 0.6120883263770242
    });
    expect(controller.reward("blue_1")).toEqual({
      action: "blue_1",
      probability: 0.6,
      rewarded: false,
      draw: 0.839317892305682,
      total_reward: 0
    });
    controller.commitCompleted({
      first_action: "stage1_a",
      transition_type: "common",
      rewarded: true
    });
    controller.advanceRewardWalk();
    expect(controller.snapshot()).toEqual({
      reward_probability_pink_1: 0.4049657134834861,
      reward_probability_pink_2: 0.6277790618888688,
      reward_probability_blue_1: 0.6351973453271146,
      reward_probability_blue_2: 0.3883069756463616
    });
    expect(controller.stayContext("stage1_a")).toEqual({
      stay: true,
      previous_first_action: "stage1_a",
      previous_transition_type: "common",
      previous_rewarded: true
    });
  });

  it("keeps card plans deterministic and participant counterbalancing aligned", () => {
    const first = makePlans({
      count: 201,
      practice: false,
      seed: 75075,
      block_index: 0
    });
    const replay = makePlans({
      count: 201,
      practice: false,
      seed: 75075,
      block_index: 0
    });
    expect(replay).toEqual(first);
    expect(first).toHaveLength(201);
    expect(counterbalanceGroup(102, 75075)).toBe(0);
    expect(counterbalanceGroup(103, 75075)).toBe(1);
  });

  it("compiles the canonical phases, conditional branches, and timings", () => {
    const plan = makePlans({
      count: 1,
      practice: false,
      seed: 75075,
      block_index: 0
    })[0];
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "scored_1",
      trial_index: 0,
      condition: plan.condition
    });
    run_trial(trial, plan, {
      settings: settings(),
      stimBank: stimBank(),
      controller: new TwoStepController({ seed: 75175 })
    });
    const compiled = trial.build();
    expect(compiled.units.map((unit) => unit.unit_label)).toEqual([
      "fixation",
      "stage1_choice",
      "transition_event",
      "stage2_choice",
      "outcome",
      "timeout_outcome",
      "iti"
    ]);
    expect(compiled.units.find((unit) => unit.unit_label === "stage1_choice"))
      .toMatchObject({ duration: 2 });
    expect(compiled.units.find((unit) => unit.unit_label === "stage2_choice"))
      .toMatchObject({ duration: 2 });
    expect(compiled.units.find((unit) => unit.unit_label === "outcome"))
      .toMatchObject({ duration: 1 });
    expect(compiled.units.find((unit) => unit.unit_label === "timeout_outcome"))
      .toMatchObject({ duration: 1 });
    expect(compiled.units.find((unit) => unit.unit_label === "stage2_choice")?.when)
      .toBeTypeOf("function");
    expect(compiled.units.find((unit) => unit.unit_label === "timeout_outcome")?.when)
      .toBeTypeOf("function");
  });

  it("keeps random walks inside reflecting bounds under stress", () => {
    const controller = new TwoStepController({ seed: 75075 });
    for (let index = 0; index < 10_000; index += 1) {
      controller.advanceRewardWalk();
    }
    expect(Object.values(controller.snapshot()).every(
      (value) => value >= 0.25 && value <= 0.75
    )).toBe(true);
  });
});
