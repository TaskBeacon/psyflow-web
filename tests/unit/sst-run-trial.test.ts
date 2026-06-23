import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import { Controller } from "../../../H000012-sst/src/controller";
import { run_trial } from "../../../H000012-sst/src/run_trial";

describe("H000012 SST trial", () => {
  it("preserves canonical go-trial response and no-response feedback metadata", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      key_list: ["f", "j"],
      left_key: "f",
      right_key: "j",
      fixation_duration: [0.8, 1],
      go_duration: 1,
      no_response_feedback_duration: 0.8
    });
    settings.triggers = {
      go_response: 11,
      go_miss: 12,
      no_response_feedback_onset: 30
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      go_left: { type: "text", text: "<" },
      no_response_feedback: { type: "text", text: "miss" }
    });
    const trial = new TrialBuilder({
      trial_id: "trial_1",
      block_id: "block_0",
      trial_index: 0,
      condition: "go_left"
    });

    run_trial(trial, "go_left", {
      settings,
      stimBank,
      controller: Controller.from_dict({})
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "fixation",
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
        condition: "go_left",
        stage: "no_response_feedback",
        condition_kind: "go",
        condition_side: "left"
      }
    });
    expect(compiled.units[2].onset_trigger).toBe(30);
  });

  it("preserves canonical stop-trial trigger metadata and SSD context", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      key_list: ["f", "j"],
      left_key: "f",
      right_key: "j",
      go_duration: 1
    });
    settings.triggers = {
      go_onset: 10,
      pre_stop_response: 23,
      stop_onset: 22,
      on_stop_response: 24
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      go_right: { type: "text", text: ">" },
      stop_right: { type: "text", text: "X" }
    });
    const trial = new TrialBuilder({
      trial_id: "trial_2",
      block_id: "block_0",
      trial_index: 0,
      condition: "stop_right"
    });

    run_trial(trial, "stop_right", {
      settings,
      stimBank,
      controller: Controller.from_dict({ initial_ssd: 0.25 })
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "fixation",
      "pre_stop_go_window",
      "stop_signal_window"
    ]);
    expect(compiled.units[1].response_cfg).toMatchObject({
      response_trigger: 23
    });
    expect(compiled.units[1].onset_trigger).toBe(10);
    expect(compiled.units[2].response_cfg).toMatchObject({
      response_trigger: 24
    });
    expect(compiled.units[2].onset_trigger).toBe(22);
    expect(compiled.units[2].context?.task_factors).toMatchObject({
      condition: "stop_right",
      stage: "stop_signal_window"
    });
    expect((compiled.units[2].context?.task_factors?.ssd_s as () => number)()).toBe(0.25);
  });
});
