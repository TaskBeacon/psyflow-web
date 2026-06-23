import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import { Controller } from "../../../H000006-mid/src/controller";
import { run_trial } from "../../../H000006-mid/src/run_trial";
import * as midUtils from "../../../H000006-mid/src/utils";

describe("H000006 MID trial", () => {
  it("preserves canonical phase contexts and target trigger metadata", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["win", "lose", "neut"],
      key_list: ["space"],
      delta: 10,
      cue_duration: 0.3,
      anticipation_duration: [1, 1.2],
      prefeedback_duration: [0.6, 0.8],
      feedback_duration: 1,
      response_grace_s: 0.15
    });
    settings.triggers = {
      win_key_press: 15,
      win_no_response: 16
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      win_cue: { type: "circle", radius: 1 },
      win_target: { type: "circle", radius: 1 },
      win_hit_feedback: { type: "text", text: "hit" },
      win_miss_feedback: { type: "text", text: "miss" }
    });
    const trial = new TrialBuilder({
      trial_id: "trial_1",
      block_id: "block_0",
      trial_index: 0,
      condition: "win"
    });

    run_trial(trial, "win", {
      settings,
      stimBank,
      controller: Controller.from_dict({
        initial_duration: 0.2,
        min_duration: 0.04,
        max_duration: 0.37,
        step: 0.03,
        target_accuracy: 0.66,
        condition_specific: true
      }),
      utils: midUtils
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "cue",
      "anticipation_fixation",
      "target_response_window",
      "prefeedback_fixation",
      "feedback"
    ]);
    expect(compiled.units[0].context).toMatchObject({
      valid_keys: [],
      stim_id: "win_cue",
      task_factors: { condition: "win", stage: "cue" }
    });
    expect(compiled.units[2].response_cfg).toMatchObject({
      response_trigger: 15,
      timeout_trigger: 16
    });
    expect(compiled.units[3].context).toMatchObject({
      valid_keys: [],
      stim_id: "fixation",
      task_factors: { condition: "win", stage: "prefeedback_fixation" }
    });
    expect(compiled.units[4].context).toMatchObject({
      valid_keys: [],
      stim_id: "feedback",
      task_factors: { condition: "win", stage: "feedback" }
    });
  });
});
