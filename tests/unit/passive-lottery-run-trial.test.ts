import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import { run_trial } from "../../../H000022-passive-lottery/src/run_trial";
import { ScoreTracker } from "../../../H000022-passive-lottery/src/utils";

describe("H000022 passive-lottery trial", () => {
  it("preserves canonical passive phase triggers and score metadata", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["gain", "loss", "mixed"],
      key_list: ["space"],
      condition_cue_duration: 0.6,
      pre_lottery_fixation_duration: 1.2,
      lottery_reveal_duration: 1.5,
      outcome_feedback_duration: 1,
      iti_duration: 0.8
    });
    settings.triggers = {
      loss_condition_cue_onset: 21,
      loss_pre_lottery_fixation_onset: 31,
      loss_lottery_reveal_onset: 41,
      loss_loss_outcome_feedback_onset: 55,
      iti_onset: 60
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      condition_cue: { type: "text", text: "{condition_label}" },
      lottery_offer: { type: "text", text: "{prob_a} {rest_prob} {outcome_a} {outcome_b}" },
      outcome_loss: { type: "text", text: "{outcome_value} {total_score}" },
      outcome_win: { type: "text", text: "{outcome_value} {total_score}" },
      outcome_neutral: { type: "text", text: "{outcome_value} {total_score}" }
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "loss"
    });

    run_trial(
      trial,
      JSON.stringify({
        condition: "loss",
        condition_label: "损失彩票",
        prob_a: 0.75,
        outcome_a: -10,
        outcome_b: 0,
        outcome_value: -10,
        outcome_kind: "loss",
        condition_id: "loss_p75_t001",
        trial_index: 1
      }),
      {
        settings,
        stimBank,
        scoreTracker: new ScoreTracker(0),
        block_id: "block_0",
        block_idx: 0
      }
    );

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "condition_cue",
      "pre_lottery_fixation",
      "lottery_reveal",
      "outcome_feedback",
      "iti"
    ]);
    expect(compiled.units.map((stage) => stage.onset_trigger)).toEqual([21, 31, 41, 55, 60]);
    expect(compiled.units[3].context).toMatchObject({
      stim_id: "outcome_loss",
      task_factors: {
        condition: "loss",
        outcome_value: -10,
        outcome_kind: "loss",
        total_score: -10
      }
    });
    expect(compiled.units[3].state_patch).toMatchObject({
      outcome_kind: "loss",
      outcome_value: -10,
      feedback_delta: -10,
      total_score: -10
    });
  });
});
