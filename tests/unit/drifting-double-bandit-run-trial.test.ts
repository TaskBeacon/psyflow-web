import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000021-drifting-double-bandit/src/run_trial";
import { RewardTracker } from "../../../H000021-drifting-double-bandit/src/utils";

describe("H000021 drifting-double-bandit trial", () => {
  it("preserves canonical trigger metadata and imputed-choice reward semantics", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 40,
      trial_per_block: 40,
      conditions: ["bandit"],
      key_list: ["f", "j", "space"],
      left_key: "f",
      right_key: "j",
      reward_win: 10,
      reward_loss: 0,
      pre_choice_fixation_duration: 0.5,
      choice_duration: 2,
      choice_confirmation_duration: 0.35,
      outcome_feedback_duration: 0.8,
      iti_duration: 0.6
    });
    settings.triggers = {
      pre_choice_fixation_onset: 20,
      choice_onset: 30,
      choice_left_press: 31,
      choice_right_press: 32,
      choice_no_response: 33,
      choice_imputed: 34,
      choice_confirmation_onset: 40,
      outcome_feedback_win_onset: 50,
      outcome_feedback_loss_onset: 51,
      iti_onset: 60
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      machine_left: { type: "rect", width: 1, height: 1 },
      machine_right: { type: "rect", width: 1, height: 1 },
      machine_left_label: { type: "text", text: "左侧机器" },
      machine_right_label: { type: "text", text: "右侧机器" },
      highlight_left: { type: "rect", width: 1, height: 1 },
      highlight_right: { type: "rect", width: 1, height: 1 },
      choice_prompt: { type: "text", text: "{deadline_s}" },
      target_prompt: { type: "text", text: "{choice_label}" },
      feedback_win: { type: "text", text: "win {reward_delta} {total_score}" },
      feedback_loss: { type: "text", text: "loss {reward_delta} {total_score}" }
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "L65_R35_t001"
    });

    run_trial(
      trial,
      JSON.stringify({
        p_left: 0.65,
        p_right: 0.35,
        condition_id: "L65_R35_t001",
        trial_index: 1,
        fallback_side: "right",
        reward_draw_u: 0.8260730300603363
      }),
      {
        settings,
        stimBank,
        rewardTracker: new RewardTracker(),
        block_id: "block_0",
        block_idx: 0
      }
    );

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_choice_fixation",
      "bandit_choice",
      "choice_confirmation",
      "outcome_feedback",
      "iti"
    ]);
    expect(compiled.units.map((stage) => stage.onset_trigger)).toEqual([20, 30, 40, expect.any(Function), 60]);
    expect(compiled.units[1].response_cfg).toMatchObject({
      response_trigger: { f: 31, j: 32 },
      timeout_trigger: 33,
      terminate_on_response: false
    });

    const timeoutSnapshot = {
      units: {
        bandit_choice: {}
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[1].state_patch?.choice_key as (snapshot: TrialSnapshot) => string)(timeoutSnapshot)).toBe("j");
    expect((compiled.units[1].state_patch?.choice_imputed_trigger as (snapshot: TrialSnapshot) => number)(timeoutSnapshot)).toBe(
      34
    );

    const forcedRightSnapshot = {
      units: {
        bandit_choice: {
          choice_key: "j",
          choice_side: "right"
        }
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[3].state_patch?.reward_win as (snapshot: TrialSnapshot) => boolean)(forcedRightSnapshot)).toBe(
      false
    );
    expect((compiled.units[3].onset_trigger as (snapshot: TrialSnapshot) => number)(forcedRightSnapshot)).toBe(51);
    expect((compiled.units[3].context?.stim_id as (snapshot: TrialSnapshot) => string)(forcedRightSnapshot)).toBe(
      "feedback_loss"
    );
  });
});
