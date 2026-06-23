import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { Controller } from "../../../H000023-ultimatum-game/src/controller";
import { run_trial } from "../../../H000023-ultimatum-game/src/run_trial";

describe("H000023 ultimatum-game trial", () => {
  it("preserves canonical triggers and timeout-as-reject payoff semantics", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["fair", "unfair", "very_unfair"],
      key_list: ["f", "j"],
      offer_cue_duration: 0.5,
      pre_decision_fixation_duration: 0.6,
      offer_decision_duration: 2,
      decision_confirmation_duration: 0.6,
      payoff_feedback_duration: 1,
      iti_duration: 0.8
    });
    settings.triggers = {
      very_unfair_offer_cue_onset: 22,
      very_unfair_pre_decision_fixation_onset: 25,
      very_unfair_offer_decision_onset: 32,
      decision_response: 50,
      decision_timeout: 51,
      decision_confirmation_onset: 52,
      payoff_feedback_onset: 53,
      iti_onset: 60
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      offer_cue: { type: "text", text: "cue" },
      offer_panel: { type: "text", text: "{proposer_share}/{responder_share}" },
      decision_accept: { type: "text", text: "accept" },
      decision_reject: { type: "text", text: "reject" },
      decision_timeout: { type: "text", text: "timeout" },
      payoff_feedback: { type: "text", text: "{earned}/{total_earned}" }
    });
    const controller = Controller.from_dict({
      seed: 23023,
      offer_profiles: {
        very_unfair: { label: "极不公平", proposer_share: 9, responder_share: 1 }
      }
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "very_unfair"
    });

    run_trial(
      trial,
      JSON.stringify({
        condition: "very_unfair",
        condition_label: "极不公平",
        proposer_share: 9,
        responder_share: 1,
        condition_id: "very_unfair_P9_R1_t001",
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
      "offer_cue",
      "pre_decision_fixation",
      "offer_decision",
      "decision_confirmation",
      "payoff_feedback",
      "inter_trial_interval"
    ]);
    expect(compiled.units.map((stage) => stage.onset_trigger)).toEqual([22, 25, 32, 52, 53, 60]);
    expect(compiled.units[2].response_cfg).toMatchObject({
      response_trigger: 50,
      timeout_trigger: 51
    });

    const timeoutSnapshot = {
      units: {
        offer_decision: {}
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[2].state_patch?.choice_label as (snapshot: TrialSnapshot) => string)(timeoutSnapshot)).toBe(
      "timeout"
    );
    expect((compiled.units[2].state_patch?.earned as (snapshot: TrialSnapshot) => number)(timeoutSnapshot)).toBe(0);
    expect((compiled.units[3].context?.stim_id as (snapshot: TrialSnapshot) => string)(timeoutSnapshot)).toBe(
      "decision_timeout"
    );
  });
});
