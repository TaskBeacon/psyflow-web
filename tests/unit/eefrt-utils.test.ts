import { describe, expect, it } from "vitest";

import {
  build_eefrt_offer_conditions,
  parse_offer_condition,
  summarizeBlock
} from "../../../H000019-eefrt/src/utils";

describe("H000019 eefrt utils", () => {
  it("matches canonical Python offer generation for the human block", () => {
    const decoded = build_eefrt_offer_conditions(
      48,
      ["offer"],
      {
        probability_levels: [0.12, 0.5, 0.88],
        hard_reward_levels: [1.24, 1.68, 2.11, 2.55, 2.99, 3.43, 3.86, 4.3],
        randomize_order: true,
        no_choice_hard_prob: 0.5
      },
      73105
    )
      .slice(0, 5)
      .map(parse_offer_condition);

    expect(decoded).toEqual([
      {
        offer_probability: 0.5,
        hard_reward: 2.55,
        condition_id: "p50_h2.55_t001",
        trial_index: 1,
        fallback_choice: "hard",
        reward_draw_u: 0.8840037233558371
      },
      {
        offer_probability: 0.88,
        hard_reward: 3.43,
        condition_id: "p88_h3.43_t002",
        trial_index: 2,
        fallback_choice: "hard",
        reward_draw_u: 0.2786254142530612
      },
      {
        offer_probability: 0.5,
        hard_reward: 2.99,
        condition_id: "p50_h2.99_t003",
        trial_index: 3,
        fallback_choice: "hard",
        reward_draw_u: 0.3792798546811885
      },
      {
        offer_probability: 0.88,
        hard_reward: 2.11,
        condition_id: "p88_h2.11_t004",
        trial_index: 4,
        fallback_choice: "hard",
        reward_draw_u: 0.16568360605704313
      },
      {
        offer_probability: 0.88,
        hard_reward: 3.43,
        condition_id: "p88_h3.43_t005",
        trial_index: 5,
        fallback_choice: "easy",
        reward_draw_u: 0.5556975362269256
      }
    ]);
  });

  it("keeps block rates numeric for canonical percent formatting", () => {
    expect(
      summarizeBlock(
        [
          { block_id: "block_0", choice_option: "hard", effort_completed: true, reward_amount: 1.5 },
          { block_id: "block_0", choice_option: "easy", effort_completed: false, reward_amount: 0 }
        ],
        "block_0"
      )
    ).toEqual({
      hard_rate: 0.5,
      completion_rate: 0.5,
      total_reward: "1.50"
    });
  });
});
