import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import { run_trial } from "../../../H000004-flanker/src/run_trial";

describe("H000004 flanker trial", () => {
  it("preserves canonical phase context and response trigger metadata", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["congruent_left", "congruent_right", "incongruent_left", "incongruent_right"],
      key_list: ["f", "j"],
      left_key: "f",
      right_key: "j",
      fixation_duration: 0.5,
      stim_duration: 1,
      iti_duration: [0.8, 1.2]
    });
    settings.triggers = {
      left_key_press: 30,
      right_key_press: 31,
      response_timeout: 32
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      congruent_left: { type: "text", text: "<<<<<" },
      congruent_right: { type: "text", text: ">>>>>" },
      incongruent_left: { type: "text", text: ">><>>" },
      incongruent_right: { type: "text", text: "<<><<" }
    });
    const trial = new TrialBuilder({
      trial_id: "trial_1",
      block_id: "block_0",
      trial_index: 0,
      condition: "incongruent_right"
    });

    run_trial(trial, "incongruent_right", {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.trial_state).toMatchObject({
      flanker_type: "incongruent",
      target_direction: "right",
      correct_response: "j"
    });
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_stim_fixation",
      "flanker_response",
      "iti"
    ]);
    expect(compiled.units[1].response_cfg).toMatchObject({
      correct_keys: ["j"],
      response_trigger: { f: 30, j: 31 },
      timeout_trigger: 32
    });
    expect(compiled.units[2].context).toMatchObject({
      valid_keys: [],
      stim_id: "blank_iti",
      task_factors: {
        flanker_type: "incongruent",
        target_direction: "right"
      }
    });
  });
});
