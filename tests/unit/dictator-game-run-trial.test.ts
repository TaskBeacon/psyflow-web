import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { Controller } from "../../../H000025-dictator-game/src/controller";
import { run_trial } from "../../../H000025-dictator-game/src/run_trial";

describe("H000025 dictator-game trial", () => {
  it("preserves canonical triggers and timeout-as-equal feedback semantics", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["low_stake", "medium_stake", "high_stake"],
      key_list: ["f", "space", "j"],
      stake_prompt_duration: 0.6,
      pre_decision_fixation_duration: 0.5,
      decision_duration: 2.2,
      choice_feedback_duration: 0.5,
      outcome_feedback_duration: 1,
      iti_duration: 0.8
    });
    settings.triggers = {
      low_stake_prompt_onset: 20,
      low_stake_decision_onset: 30,
      decision_response: 50,
      decision_timeout: 51,
      choice_feedback_onset: 52,
      outcome_feedback_onset: 53,
      iti_onset: 60
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      stake_prompt_text: { type: "text", text: "{stake}/{condition_label}" },
      decision_panel: { type: "text", text: "{stake}" },
      decision_generous: { type: "text", text: "generous" },
      decision_equal: { type: "text", text: "equal" },
      decision_selfish: { type: "text", text: "selfish" },
      decision_timeout: { type: "text", text: "timeout" },
      outcome_feedback: { type: "text", text: "{stake}/{choice_label}/{self_amount}/{other_amount}" }
    });
    const controller = Controller.from_dict({
      seed: 25025,
      allocation_profiles: {
        generous: { label: "generous label", self_ratio: 0.3 },
        equal: { label: "equal label", self_ratio: 0.5 },
        selfish: { label: "selfish label", self_ratio: 0.9 }
      },
      stake_levels: {
        low_stake: 10,
        medium_stake: 20,
        high_stake: 30
      }
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "low_stake"
    });

    run_trial(
      trial,
      JSON.stringify({
        condition: "low_stake",
        condition_label: "low stake",
        stake: 10,
        condition_id: "low_stake_s10_t001",
        trial_index: 1
      }),
      {
        settings,
        stimBank,
        controller,
        block_id: "block_0",
        block_idx: 0
      }
    );

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "stake_prompt",
      "pre_decision_fixation",
      "decision",
      "choice_feedback",
      "outcome_feedback",
      "inter_trial_interval"
    ]);
    expect(compiled.units.map((stage) => stage.onset_trigger)).toEqual([20, null, 30, 52, 53, 60]);
    expect(compiled.units[2].response_cfg).toMatchObject({
      response_trigger: 50,
      timeout_trigger: 51
    });

    const timeoutSnapshot = {
      units: {
        decision: {}
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[2].state_patch?.choice_state as (snapshot: TrialSnapshot) => { choice: string })(timeoutSnapshot)).toEqual({
      choice: "equal",
      timed_out: true
    });
    expect((compiled.units[3].context?.stim_id as (snapshot: TrialSnapshot) => string)(timeoutSnapshot)).toBe(
      "decision_timeout"
    );
  });
});
