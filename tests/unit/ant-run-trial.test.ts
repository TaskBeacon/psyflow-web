import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000015-ant/src/run_trial";

describe("H000015 ANT trial", () => {
  it("preserves canonical spatial-cue, target, feedback, and ITI metadata", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      key_list: ["f", "j"],
      left_key: "f",
      right_key: "j",
      fixation_duration: 0.5,
      cue_duration: 0.1,
      stim_duration: 1,
      feedback_duration: 0.5,
      iti_duration: [0.8, 1.2]
    });
    settings.triggers = {
      fixation_onset: 1,
      spatial_cue_up_onset: 13,
      stim_4222: 58,
      left_key_press: 201,
      right_key_press: 202,
      feedback_correct_response: 221,
      feedback_incorrect_response: 222,
      feedback_no_response: 223
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      cue_up: { type: "text", text: "*" },
      incongruent_down_right: { type: "text", text: "<<><<" },
      correct_feedback: { type: "text", text: "correct" },
      incorrect_feedback: { type: "text", text: "wrong" },
      no_response_feedback: { type: "text", text: "miss" }
    });
    const condition = "spatial_cue_up_incongruent_down_right";
    const trial = new TrialBuilder({
      trial_id: "trial_1",
      block_id: "block_0",
      trial_index: 0,
      condition
    });

    run_trial(trial, condition, {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_cue_fixation",
      "cue_signal",
      "flanker_response",
      "feedback",
      "iti"
    ]);
    expect(compiled.units[0].onset_trigger).toBe(1);
    expect(compiled.units[1]).toMatchObject({
      onset_trigger: 13,
      context: {
        stim_id: "cue_up",
        task_factors: {
          cue_type: "spatial_cue_up"
        }
      }
    });
    expect(compiled.units[2]).toMatchObject({
      onset_trigger: 58,
      context: {
        stim_id: "incongruent_down_right",
        task_factors: {
          cue_type: "spatial_cue_up",
          flanker_type: "incongruent",
          target_position: "down",
          target_direction: "right"
        }
      },
      response_cfg: {
        correct_keys: ["j"],
        response_trigger: { f: 201, j: 202 }
      }
    });
    expect(compiled.units[3].context).toMatchObject({
      valid_keys: [],
      task_factors: {
        condition,
        stage: "feedback",
        cue_type: "spatial_cue_up",
        flanker_type: "incongruent",
        target_position: "down",
        target_direction: "right"
      }
    });
    const incorrectSnapshot = {
      units: {
        stimulus: {
          response: "f",
          hit: false
        }
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[3].context?.stim_id as (snapshot: TrialSnapshot) => string)(incorrectSnapshot)).toBe(
      "incorrect_feedback"
    );
    expect((compiled.units[3].onset_trigger as (snapshot: TrialSnapshot) => number)(incorrectSnapshot)).toBe(222);
    expect(compiled.units[4].context).toMatchObject({
      phase: "iti",
      valid_keys: [],
      stim_id: "blank_iti",
      task_factors: {
        condition,
        stage: "iti",
        cue_type: "spatial_cue_up",
        flanker_type: "incongruent",
        target_position: "down",
        target_direction: "right"
      }
    });
  });
});
