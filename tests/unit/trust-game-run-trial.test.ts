import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { Controller } from "../../../H000024-trust-game/src/controller";
import { run_trial } from "../../../H000024-trust-game/src/run_trial";

describe("H000024 trust-game trial", () => {
  it("preserves canonical triggers and timeout-as-keep payoff semantics", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["high_trust", "medium_trust", "low_trust"],
      key_list: ["f", "j"],
      partner_cue_duration: 0.6,
      pre_decision_fixation_duration: 0.6,
      decision_duration: 2,
      decision_confirmation_duration: 0.5,
      outcome_feedback_duration: 1,
      iti_duration: 0.8
    });
    settings.triggers = {
      high_trust_partner_cue_onset: 20,
      high_trust_pre_decision_fixation_onset: 23,
      high_trust_decision_onset: 30,
      decision_response: 50,
      decision_timeout: 51,
      decision_confirmation_onset: 52,
      outcome_feedback_onset: 53,
      iti_onset: 60
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      partner_cue: { type: "text", text: "{partner_label}" },
      decision_panel: { type: "text", text: "{endowment}" },
      decision_invest: { type: "text", text: "invest" },
      decision_keep: { type: "text", text: "keep" },
      decision_timeout: { type: "text", text: "timeout" },
      outcome_feedback: { type: "text", text: "{invested}/{returned}/{earned}/{total_earned}" }
    });
    const controller = Controller.from_dict({
      seed: 24024,
      endowment: 10,
      transfer_multiplier: 3,
      return_noise_ratio: 0.05,
      partner_profiles: {
        high_trust: { label: "高返回对手", return_ratio: 0.6 }
      }
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "high_trust"
    });

    run_trial(
      trial,
      JSON.stringify({
        condition: "high_trust",
        partner_label: "高返回对手",
        return_ratio: 0.6,
        condition_id: "high_trust_r60_t001",
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
      "partner_cue",
      "pre_decision_fixation",
      "trust_decision",
      "decision_confirmation",
      "outcome_feedback",
      "inter_trial_interval"
    ]);
    expect(compiled.units.map((stage) => stage.onset_trigger)).toEqual([20, 23, 30, 52, 53, 60]);
    expect(compiled.units[2].response_cfg).toMatchObject({
      response_trigger: 50,
      timeout_trigger: 51
    });

    const timeoutSnapshot = {
      units: {
        decision: {}
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[2].state_patch?.choice_label as (snapshot: TrialSnapshot) => string)(timeoutSnapshot)).toBe(
      "timeout"
    );
    expect((compiled.units[2].state_patch?.trusted as (snapshot: TrialSnapshot) => boolean)(timeoutSnapshot)).toBe(
      false
    );
    expect((compiled.units[3].context?.stim_id as (snapshot: TrialSnapshot) => string)(timeoutSnapshot)).toBe(
      "decision_timeout"
    );
  });
});
