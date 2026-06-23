import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { Controller } from "../../../H000027-task-switching/src/controller";
import { run_trial } from "../../../H000027-task-switching/src/run_trial";

describe("H000027 task-switching trial", () => {
  it("preserves canonical generated spec triggers and scoring semantics", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["cued_switching"],
      key_list: ["f", "j", "space"],
      left_key: "f",
      right_key: "j",
      fixation_duration: [0.3, 0.6],
      cue_duration: 0.6,
      decision_deadline: 2,
      feedback_duration: 0.8,
      iti_duration: [0.3, 0.6],
      rule_names: { parity: "Parity", magnitude: "Magnitude" },
      trial_type_names: { start: "Start", repeat: "Repeat", switch: "Switch" },
      response_labels: {
        parity: { left: "Odd", right: "Even" },
        magnitude: { left: "<5", right: ">5" }
      }
    });
    settings.triggers = {
      fixation_onset: 20,
      cue_onset: 30,
      decision_onset: 40,
      choice_left: 41,
      choice_right: 42,
      choice_timeout: 43,
      feedback_correct: 50,
      feedback_incorrect: 51,
      feedback_timeout: 52,
      iti_onset: 60
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      cue_title: { type: "text", text: "cue" },
      score_text: { type: "text", text: "{current_score}" },
      cue_parity: { type: "text", text: "parity" },
      cue_magnitude: { type: "text", text: "magnitude" },
      trial_type_tag: { type: "text", text: "{trial_type_cn}" },
      target_digit: { type: "text", text: "0" },
      rule_prompt: { type: "text", text: "{rule_name_cn}" },
      key_hint: { type: "text", text: "{left_key}/{right_key}" },
      feedback_correct: { type: "text", text: "{score_delta}/{score_after}" },
      feedback_incorrect: { type: "text", text: "{score_delta}/{score_after}" },
      feedback_timeout: { type: "text", text: "{score_after}" }
    });
    const controller = Controller.from_dict({
      initial_score: 0,
      correct_delta: 1,
      incorrect_delta: -1,
      timeout_delta: 0,
      enable_logging: false
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "cued_switching"
    });

    run_trial(
      trial,
      JSON.stringify({
        condition: "cued_switching",
        condition_id: "cued_switching_parity_start_d9_t001",
        trial_index: 1,
        task_rule: "parity",
        trial_type: "start",
        target_digit: 9,
        switch_trial: false,
        fixation_duration: 0.48344643973031687,
        iti_duration: 0.5580721543076065
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
      "fixation",
      "cue",
      "decision",
      "feedback",
      "inter_trial_interval"
    ]);
    expect(compiled.units.map((stage) => stage.onset_trigger)).toEqual([20, 30, 40, expect.any(Function), 60]);
    expect(compiled.units[2].response_cfg).toMatchObject({
      response_trigger: { f: 41, j: 42 },
      timeout_trigger: 43
    });
    expect(compiled.units[0].duration).toBeCloseTo(0.48344643973031687, 12);
    expect(compiled.units[4].duration).toBeCloseTo(0.5580721543076065, 12);

    const correctSnapshot = {
      units: {
        decision: { response: "f", response_key: "f", is_correct: true, timed_out: false }
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[2].state_patch?.is_correct as (snapshot: TrialSnapshot) => boolean)(correctSnapshot)).toBe(
      true
    );
    expect((compiled.units[3].onset_trigger as (snapshot: TrialSnapshot) => number)(correctSnapshot)).toBe(50);
    expect((compiled.units[3].context?.stim_id as (snapshot: TrialSnapshot) => string)(correctSnapshot)).toBe(
      "feedback_correct"
    );
  });
});
