import { describe, expect, it } from "vitest";

import {
  generate_passive_lottery_conditions,
  parse_passive_lottery_condition,
  summarizeBlock
} from "../../../H000022-passive-lottery/src/utils";

describe("H000022 passive-lottery utils", () => {
  it("matches canonical Python balanced lottery scheduling and outcome draws", () => {
    const decoded = generate_passive_lottery_conditions(
      6,
      ["gain", "loss", "mixed"],
      0,
      {
        seed: 22022,
        lottery_profiles: {
          gain: { label: "gain label", prob_a: 0.75, outcome_a: 10, outcome_b: 0 },
          loss: { label: "loss label", prob_a: 0.75, outcome_a: -10, outcome_b: 0 },
          mixed: { label: "mixed label", prob_a: 0.5, outcome_a: 10, outcome_b: -10 }
        }
      },
      73105
    ).map(parse_passive_lottery_condition);

    expect(decoded).toEqual([
      {
        condition: "loss",
        condition_label: "loss label",
        prob_a: 0.75,
        outcome_a: -10,
        outcome_b: 0,
        outcome_value: -10,
        outcome_kind: "loss",
        condition_id: "loss_p75_t001",
        trial_index: 1
      },
      {
        condition: "mixed",
        condition_label: "mixed label",
        prob_a: 0.5,
        outcome_a: 10,
        outcome_b: -10,
        outcome_value: -10,
        outcome_kind: "loss",
        condition_id: "mixed_p50_t002",
        trial_index: 2
      },
      {
        condition: "mixed",
        condition_label: "mixed label",
        prob_a: 0.5,
        outcome_a: 10,
        outcome_b: -10,
        outcome_value: -10,
        outcome_kind: "loss",
        condition_id: "mixed_p50_t003",
        trial_index: 3
      },
      {
        condition: "gain",
        condition_label: "gain label",
        prob_a: 0.75,
        outcome_a: 10,
        outcome_b: 0,
        outcome_value: 0,
        outcome_kind: "neutral",
        condition_id: "gain_p75_t004",
        trial_index: 4
      },
      {
        condition: "loss",
        condition_label: "loss label",
        prob_a: 0.75,
        outcome_a: -10,
        outcome_b: 0,
        outcome_value: 0,
        outcome_kind: "neutral",
        condition_id: "loss_p75_t005",
        trial_index: 5
      },
      {
        condition: "gain",
        condition_label: "gain label",
        prob_a: 0.75,
        outcome_a: 10,
        outcome_b: 0,
        outcome_value: 10,
        outcome_kind: "win",
        condition_id: "gain_p75_t006",
        trial_index: 6
      }
    ]);
  });

  it("keeps block summaries numeric for canonical formatting", () => {
    expect(
      summarizeBlock(
        [
          { block_id: "block_0", outcome_kind: "win", outcome_value: 10, total_score: 10 },
          { block_id: "block_0", outcome_kind: "loss", outcome_value: -10, total_score: 0 }
        ],
        "block_0"
      )
    ).toEqual({
      win_rate: 0.5,
      block_score: 0,
      total_score: 0
    });
  });
});
