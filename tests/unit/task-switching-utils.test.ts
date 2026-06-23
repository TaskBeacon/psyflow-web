import { describe, expect, it } from "vitest";

import {
  generate_task_switching_conditions,
  parse_task_switching_condition,
  summarizeBlock
} from "../../../H000027-task-switching/src/utils";

describe("H000027 task-switching utils", () => {
  it("matches canonical Python generated task-switching specs", () => {
    const decoded = generate_task_switching_conditions(
      6,
      ["cued_switching"],
      0.5,
      [1, 2, 3, 4, 6, 7, 8, 9],
      [0.3, 0.6],
      [0.3, 0.6],
      null,
      0,
      false,
      2025
    ).map(parse_task_switching_condition);

    expect(decoded.map(({ fixation_duration, iti_duration, ...rest }) => rest)).toEqual([
      {
        condition: "cued_switching",
        condition_id: "cued_switching_parity_start_d9_t001",
        trial_index: 1,
        task_rule: "parity",
        trial_type: "start",
        target_digit: 9,
        switch_trial: false
      },
      {
        condition: "cued_switching",
        condition_id: "cued_switching_parity_repeat_d1_t002",
        trial_index: 2,
        task_rule: "parity",
        trial_type: "repeat",
        target_digit: 1,
        switch_trial: false
      },
      {
        condition: "cued_switching",
        condition_id: "cued_switching_magnitude_switch_d8_t003",
        trial_index: 3,
        task_rule: "magnitude",
        trial_type: "switch",
        target_digit: 8,
        switch_trial: true
      },
      {
        condition: "cued_switching",
        condition_id: "cued_switching_magnitude_repeat_d2_t004",
        trial_index: 4,
        task_rule: "magnitude",
        trial_type: "repeat",
        target_digit: 2,
        switch_trial: false
      },
      {
        condition: "cued_switching",
        condition_id: "cued_switching_parity_switch_d2_t005",
        trial_index: 5,
        task_rule: "parity",
        trial_type: "switch",
        target_digit: 2,
        switch_trial: true
      },
      {
        condition: "cued_switching",
        condition_id: "cued_switching_magnitude_switch_d4_t006",
        trial_index: 6,
        task_rule: "magnitude",
        trial_type: "switch",
        target_digit: 4,
        switch_trial: true
      }
    ]);
    expect(decoded[0].fixation_duration).toBeCloseTo(0.48344643973031687, 12);
    expect(decoded[0].iti_duration).toBeCloseTo(0.5580721543076065, 12);
  });

  it("keeps rates and signed values numeric for canonical formatting", () => {
    expect(
      summarizeBlock(
        [
          {
            block_id: "block_0",
            trial_type: "repeat",
            decision_timed_out: false,
            is_correct: true,
            decision_rt_s: 0.4,
            score_after: 1,
            score_delta: 1
          },
          {
            block_id: "block_0",
            trial_type: "switch",
            decision_timed_out: false,
            is_correct: false,
            decision_rt_s: 0.7,
            score_after: 0,
            score_delta: -1
          },
          {
            block_id: "block_0",
            trial_type: "switch",
            decision_timed_out: true,
            is_correct: null,
            decision_rt_s: null,
            score_after: 0,
            score_delta: 0
          }
        ],
        "block_0",
        0
      )
    ).toMatchObject({
      total_trials: 3,
      accuracy: 0.5,
      switch_accuracy: 0,
      repeat_accuracy: 1,
      timeout_count: 1,
      mean_rt_ms: 550,
      mean_switch_rt_ms: 700,
      mean_repeat_rt_ms: 400,
      switch_cost_ms: 300,
      score_end: 0,
      net_score: 0
    });
  });
});
