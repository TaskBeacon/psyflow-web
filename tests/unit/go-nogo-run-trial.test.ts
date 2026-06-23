import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import { run_trial } from "../../../H000005-go-nogo/src/run_trial";

describe("H000005 Go/No-Go trial", () => {
  const settings = TaskSettings.from_dict({
    total_blocks: 1,
    total_trials: 2,
    trial_per_block: 2,
    conditions: ["go", "nogo"],
    condition_weights: { go: 3, nogo: 1 },
    key_list: ["space"],
    fixation_duration: [0.8, 1],
    go_duration: 1,
    no_response_feedback_duration: 0.8,
    nogo_error_feedback_duration: 0.8
  });
  settings.triggers = {
    go_response: 11,
    go_miss: 12,
    nogo_response: 21,
    nogo_miss: 22
  };

  const stimBank = new StimBank({
    fixation: { type: "text", text: "+" },
    go: { type: "circle", radius: 1 },
    nogo: { type: "rect", width: 1, height: 1 },
    no_response_feedback: { type: "text", text: "miss" },
    nogo_error_feedback: { type: "text", text: "false alarm" }
  });

  it("preserves Go miss feedback context", () => {
    const trial = new TrialBuilder({
      trial_id: "go_1",
      block_id: "block_0",
      trial_index: 0,
      condition: "go"
    });

    run_trial(trial, "go", {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_target_fixation",
      "go_response_window",
      "no_response_feedback"
    ]);
    expect(compiled.units[1].response_cfg).toMatchObject({
      response_trigger: 11,
      timeout_trigger: 12
    });
    expect(compiled.units[2].context).toMatchObject({
      valid_keys: [],
      stim_id: "no_response_feedback",
      task_factors: {
        response: false,
        stage: "no_response_feedback"
      }
    });
  });

  it("preserves NoGo commission feedback context", () => {
    const trial = new TrialBuilder({
      trial_id: "nogo_1",
      block_id: "block_0",
      trial_index: 1,
      condition: "nogo"
    });

    run_trial(trial, "nogo", {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_target_fixation",
      "nogo_inhibition_window",
      "nogo_error_feedback"
    ]);
    expect(compiled.units[1].response_cfg).toMatchObject({
      response_trigger: 21,
      timeout_trigger: 22
    });
    expect(compiled.units[2].context).toMatchObject({
      valid_keys: [],
      stim_id: "nogo_error_feedback",
      task_factors: {
        response: true,
        false_alarm: true,
        stage: "nogo_error_feedback"
      }
    });
  });
});
