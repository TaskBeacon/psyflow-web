import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000019-eefrt/src/run_trial";

describe("H000019 eefrt trial", () => {
  it("preserves canonical phase metadata, triggers, and choice labels", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 48,
      trial_per_block: 48,
      conditions: ["offer"],
      key_list: ["f", "j", "space"],
      choice_keys: ["f", "j"],
      effort_key: "space",
      easy_choice_label: "低努力",
      hard_choice_label: "高努力",
      easy_reward: 1,
      easy_required_presses: 30,
      hard_required_presses: 100,
      easy_time_limit_s: 7,
      hard_time_limit_s: 21,
      delta: 1,
      cue_duration: 1,
      anticipation_duration: 5,
      ready_duration: 1,
      feedback_duration: 1,
      reward_feedback_duration: 1,
      iti_duration: 1
    });
    settings.triggers = {
      cue_onset: 20,
      choice_onset: 30,
      choice_easy_press: 31,
      choice_hard_press: 32,
      choice_no_response: 33,
      choice_forced: 34,
      ready_onset: 40,
      target_onset: 50,
      target_key_press: 51,
      target_complete: 52,
      target_fail: 53,
      feedback_onset: 60,
      reward_win_onset: 70,
      reward_nowin_onset: 71,
      reward_incomplete_onset: 72,
      iti_onset: 80
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      choice_header: { type: "text", text: "p {probability_pct}" },
      choice_left: { type: "text", text: "easy {easy_presses} {easy_deadline_s} {easy_reward}" },
      choice_right: { type: "text", text: "hard {hard_presses} {hard_deadline_s} {hard_reward}" },
      ready_text: { type: "text", text: "{choice_label} {required_presses} {time_limit_s} {effort_key}" },
      effort_prompt: { type: "text", text: "{choice_label} {required_presses} {time_limit_s} {effort_key}" },
      effort_counter: { type: "text", text: "{current_presses}/{required_presses}/{time_left_s}" },
      effort_success_feedback: { type: "text", text: "success" },
      effort_fail_feedback: { type: "text", text: "fail" },
      reward_win_feedback: { type: "text", text: "win {reward_amount}" },
      reward_nowin_feedback: { type: "text", text: "no win" },
      reward_incomplete_feedback: { type: "text", text: "incomplete" }
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "offer"
    });

    run_trial(
      trial,
      JSON.stringify({
        offer_probability: 0.88,
        hard_reward: 3.43,
        condition_id: "p88_h3.43_t002",
        trial_index: 2,
        fallback_choice: "hard",
        reward_draw_u: 0.2786254142530612
      }),
      {
        settings,
        stimBank,
        block_id: "block_0",
        block_idx: 0
      }
    );

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "offer_fixation",
      "offer_choice",
      "ready",
      "effort_execution_window",
      "effort_feedback",
      "reward_feedback",
      "inter_trial_interval"
    ]);
    expect(compiled.units.map((stage) => stage.onset_trigger)).toEqual([20, 30, 40, 50, 60, expect.any(Function), 80]);
    expect(compiled.units[1].response_cfg).toMatchObject({
      response_trigger: { f: 31, j: 32 },
      timeout_trigger: 33
    });
    expect(compiled.units[2].context).toMatchObject({
      stim_id: "ready_text",
      task_factors: {
        choice_option: expect.any(Function),
        required_presses: expect.any(Function),
        effort_deadline_s: expect.any(Function)
      }
    });

    const hardSnapshot = {
      units: {
        offer_choice: {
          response: "j",
          choice_option: "hard",
          required_presses: 100,
          effort_deadline_s: 21,
          chosen_reward: 3.43
        },
        effort_execution: {
          response_count: 100
        }
      }
    } as unknown as TrialSnapshot;
    const readyStim = compiled.units[2].stim_refs[0] as unknown as (snapshot: TrialSnapshot) => { text: string };
    expect(readyStim(hardSnapshot).text).toContain("高努力");
    expect(compiled.units[3].response_cfg).toMatchObject({
      response_trigger: 51,
      terminate_on_response: false,
      count_responses: true
    });
    expect((compiled.units[3].state_patch?.target_outcome_trigger as (snapshot: TrialSnapshot) => number)(hardSnapshot)).toBe(
      52
    );
    expect((compiled.units[5].onset_trigger as (snapshot: TrialSnapshot) => number)(hardSnapshot)).toBe(70);
  });
});
