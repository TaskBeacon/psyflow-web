import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000018-oddball-mmn/src/run_trial";

describe("H000018 oddball trial", () => {
  it("preserves canonical target trigger metadata and scoring state", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      key_list: ["space"],
      delta: 1,
      fixation_duration: 0.3,
      stimulus_duration: 0.5,
      iti_duration: 0.5
    });
    settings.triggers = {
      fixation_onset: 20,
      target_stimulus_onset: 42,
      target_key_press: 52,
      target_no_response: 62,
      iti_onset: 80
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      target_stimulus: { type: "text", text: "star" }
    });
    const trial = new TrialBuilder({
      trial_id: "trial_1",
      block_id: "block_0",
      trial_index: 0,
      condition: "target"
    });

    run_trial(trial, "target", {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "trial_fixation",
      "oddball_response_window",
      "inter_trial_interval"
    ]);
    expect(compiled.units.map((stage) => stage.onset_trigger)).toEqual([20, 42, 80]);
    expect(compiled.units[1].response_cfg).toMatchObject({
      correct_keys: ["space"],
      response_trigger: 52,
      timeout_trigger: 62,
      terminate_on_response: true
    });
    const hitSnapshot = {
      units: {
        stimulus: {
          response: "space"
        }
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[1].state_patch?.outcome as (snapshot: TrialSnapshot) => string)(hitSnapshot)).toBe("hit");
    expect((compiled.units[1].state_patch?.score_delta as (snapshot: TrialSnapshot) => number)(hitSnapshot)).toBe(1);
  });
});
