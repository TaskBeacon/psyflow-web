import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000017-delay-discounting/src/run_trial";

describe("H000017 delay-discounting trial", () => {
  it("preserves canonical option text, triggers, and dynamic feedback metadata", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 5,
      trial_per_block: 5,
      conditions: ["small", "medium", "large"],
      key_list: ["f", "j"],
      currency_unit: "元",
      option_amount_format: "{amount:.0f}",
      delay_today_label: "今天到账",
      delay_future_template: "{days}天后到账",
      option_text_template: "{amount}{currency_unit}，{delay_label}",
      cue_duration: 0.6,
      anticipation_duration: 0.2,
      decision_duration: 6,
      choice_confirm_duration: 0.3,
      feedback_duration: 0.5,
      iti_duration: 0.5
    });
    settings.block_seed = [73105];
    settings.triggers = {
      cue_onset: 20,
      anticipation_onset: 25,
      choice_onset: 30,
      choice_confirm_onset: 33,
      choice_response_left: 31,
      choice_response_right: 32,
      choice_no_response: 39,
      feedback_choice_onset: 40,
      feedback_timeout_onset: 41,
      iti_onset: 50
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      option_left: { type: "text", text: "left" },
      option_right: { type: "text", text: "right" },
      choice_prompt: { type: "text", text: "choose" },
      highlight_left: { type: "rect", width: 1, height: 1 },
      highlight_right: { type: "rect", width: 1, height: 1 },
      feedback_choice: { type: "text", text: "choice" },
      feedback_timeout: { type: "text", text: "timeout" }
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "medium"
    });

    run_trial(trial, "medium", {
      settings,
      stimBank,
      condition_generation_config: {
        randomize_order: true,
        counterbalance_sides: true,
        ll_left_prob: 0.5
      },
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_choice_fixation",
      "offer_onset_jitter",
      "intertemporal_choice",
      "choice_confirmation",
      "outcome_feedback",
      "inter_trial_interval"
    ]);
    expect(compiled.units.map((stage) => stage.onset_trigger)).toEqual([20, 25, 30, 33, expect.any(Function), 50]);
    expect(compiled.units[2]).toMatchObject({
      context: {
        condition_id: "medium|item15|ll_left",
        stim_id: "mcq27_item_15",
        task_factors: {
          magnitude: "medium",
          offer_id: 15,
          ll_side: "left",
          ss_side: "right",
          ll_key: "f",
          ss_key: "j"
        }
      },
      response_cfg: {
        response_trigger: { f: 31, j: 32 },
        timeout_trigger: 39
      }
    });
    const leftText = compiled.units[2].stim_refs[0] as { text: string };
    const rightText = compiled.units[2].stim_refs[1] as { text: string };
    expect(leftText.text).toBe("85元，35天后到账");
    expect(rightText.text).toBe("65元，今天到账");

    const responseSnapshot = {
      units: {
        intertemporal_choice: {
          response: "f",
          choice_made: true
        }
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[3].context?.stim_id as (snapshot: TrialSnapshot) => string)(responseSnapshot)).toBe(
      "highlight_left"
    );
    expect((compiled.units[4].context?.stim_id as (snapshot: TrialSnapshot) => string)(responseSnapshot)).toBe(
      "feedback_choice"
    );
    expect((compiled.units[4].onset_trigger as (snapshot: TrialSnapshot) => number)(responseSnapshot)).toBe(40);
  });
});
