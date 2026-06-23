import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import { run_trial } from "../../../H000011-simon/src/run_trial";

describe("H000011 Simon trial", () => {
  it("preserves canonical feedback and ITI contexts", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["red_left", "red_right", "blue_left", "blue_right"],
      key_list: ["f", "j"],
      left_key: "f",
      right_key: "j",
      fixation_duration: 0.5,
      stim_duration: 1,
      feedback_duration: 0.5,
      iti_duration: [0.8, 1.2]
    });
    settings.triggers = {
      left_key_press: 30,
      right_key_press: 31
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      red_left: { type: "circle", radius: 1 },
      correct_feedback: { type: "text", text: "correct" },
      incorrect_feedback: { type: "text", text: "wrong" },
      no_response_feedback: { type: "text", text: "miss" }
    });
    const trial = new TrialBuilder({
      trial_id: "simon_1",
      block_id: "block_0",
      trial_index: 0,
      condition: "red_left"
    });

    run_trial(trial, "red_left", {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_stim_fixation",
      "simon_response",
      "feedback",
      "iti"
    ]);
    expect(compiled.units[1].response_cfg).toMatchObject({
      correct_keys: ["f"],
      response_trigger: { f: 30, j: 31 }
    });
    expect(compiled.units[2].context).toMatchObject({
      valid_keys: [],
      stim_id: "feedback",
      task_factors: {
        stim_color: "red",
        stim_position: "left",
        stage: "feedback"
      }
    });
    expect(compiled.units[3].context).toMatchObject({
      valid_keys: [],
      stim_id: "blank_iti",
      task_factors: {
        stim_color: "red",
        stim_position: "left",
        stage: "iti"
      }
    });
  });
});
