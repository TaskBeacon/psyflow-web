import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { encodeCardTrialSpec } from "../../../H000016-card-sorting/src/utils";
import { run_trial } from "../../../H000016-card-sorting/src/run_trial";

describe("H000016 card-sorting trial", () => {
  it("preserves concrete card spec and canonical trigger metadata", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      key_list: ["1", "2", "3", "4"],
      cue_duration: 0.4,
      anticipation_duration: 0.2,
      target_duration: 2,
      feedback_duration: 0.6,
      iti_duration: 0.3
    });
    settings.triggers = {
      color_cue_onset: 20,
      anticipation_onset: 25,
      target_onset: 30,
      key_press: 40,
      no_response: 41,
      feedback_onset: 50,
      iti_onset: 60
    };
    const stimBank = new StimBank({
      rule_cue_color: { type: "text", text: "color" },
      fixation: { type: "text", text: "+" },
      target_card: { type: "image", image: "placeholder.png" },
      ref_card_1: { type: "image", image: "1.png" },
      ref_card_2: { type: "image", image: "2.png" },
      ref_card_3: { type: "image", image: "3.png" },
      ref_card_4: { type: "image", image: "4.png" },
      feedback_correct: { type: "text", text: "correct" },
      feedback_incorrect: { type: "text", text: "wrong" }
    });
    const condition = encodeCardTrialSpec({
      rule: "color",
      condition_id: "color|BLUE|CIRCLE|2",
      target_color: "BLUE",
      target_shape: "CIRCLE",
      target_number: 2,
      correct_key: "3",
      target_image: "assets/cards/targets/target_color-blue_shape-circle_number-2.png"
    });
    const trial = new TrialBuilder({
      trial_id: "trial_1",
      block_id: "block_0",
      trial_index: 0,
      condition: "color"
    });

    run_trial(trial, condition, {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "rule_cue",
      "pre_choice_fixation",
      "card_choice_response",
      "choice_feedback",
      "iti"
    ]);
    expect(compiled.units.map((stage) => stage.onset_trigger)).toEqual([20, 25, 30, 50, 60]);
    expect(compiled.units[2]).toMatchObject({
      context: {
        condition_id: "color|BLUE|CIRCLE|2",
        stim_id: "target_card",
        task_factors: {
          rule: "color",
          target_color: "BLUE",
          target_shape: "CIRCLE",
          target_number: 2,
          correct_key: "3",
          target_image: "assets/cards/targets/target_color-blue_shape-circle_number-2.png"
        }
      },
      response_cfg: {
        correct_keys: ["3"],
        response_trigger: 40,
        timeout_trigger: 41
      }
    });
    const correctSnapshot = {
      units: {
        card_choice_response: {
          response: "3",
          hit: true
        }
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[3].context?.stim_id as (snapshot: TrialSnapshot) => string)(correctSnapshot)).toBe(
      "feedback_correct"
    );
  });
});
