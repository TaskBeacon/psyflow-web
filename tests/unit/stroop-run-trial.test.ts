import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000014-stroop/src/run_trial";

describe("H000014 Stroop trial", () => {
  it("preserves canonical phase context and trigger metadata", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      key_list: ["f", "j"],
      red_key: "f",
      green_key: "j",
      fixation_duration: 0.5,
      stim_duration: 2,
      feedback_duration: 0.5,
      iti_duration: [0.8, 1.2]
    });
    settings.triggers = {
      fixation_onset: 1,
      congruent_stim_onset: 10,
      incongruent_stim_onset: 20,
      red_key_press: 30,
      green_key_press: 31,
      feedback_correct_response: 51,
      feedback_incorrect_response: 52,
      feedback_no_response: 53
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      incongruent_red: { type: "text", text: "green", color: "red" },
      correct_feedback: { type: "text", text: "correct" },
      incorrect_feedback: { type: "text", text: "wrong" },
      no_response_feedback: { type: "text", text: "miss" }
    });
    const trial = new TrialBuilder({
      trial_id: "trial_1",
      block_id: "block_0",
      trial_index: 0,
      condition: "incongruent_red"
    });

    run_trial(trial, "incongruent_red", {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_stim_fixation",
      "stroop_response",
      "feedback",
      "iti"
    ]);
    expect(compiled.units[0].onset_trigger).toBe(1);
    expect(compiled.units[1].onset_trigger).toBe(20);
    expect(compiled.units[1].response_cfg).toMatchObject({
      response_trigger: { f: 30, j: 31 }
    });
    expect(compiled.units[2].context).toMatchObject({
      valid_keys: [],
      task_factors: {
        condition: "incongruent_red",
        stage: "feedback",
        stroop_type: "incongruent",
        color: "red"
      }
    });
    expect(typeof compiled.units[2].context?.stim_id).toBe("function");
    expect(typeof compiled.units[2].onset_trigger).toBe("function");
    const correctSnapshot = {
      units: {
        stimulus: {
          response: "f",
          hit: true
        }
      }
    } as unknown as TrialSnapshot;
    const noResponseSnapshot = {
      units: {
        stimulus: {
          response: null,
          hit: null
        }
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[2].context?.stim_id as (snapshot: TrialSnapshot) => string)(correctSnapshot)).toBe(
      "correct_feedback"
    );
    expect((compiled.units[2].onset_trigger as (snapshot: TrialSnapshot) => number)(correctSnapshot)).toBe(51);
    expect((compiled.units[2].onset_trigger as (snapshot: TrialSnapshot) => number)(noResponseSnapshot)).toBe(53);
    expect(compiled.units[3].context).toMatchObject({
      phase: "iti",
      valid_keys: [],
      stim_id: "blank_iti",
      task_factors: {
        condition: "incongruent_red",
        stage: "iti",
        stroop_type: "incongruent",
        color: "red"
      }
    });
  });
});
