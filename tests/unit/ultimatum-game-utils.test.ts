import { describe, expect, it } from "vitest";

import { Controller } from "../../../H000023-ultimatum-game/src/controller";
import { parse_ultimatum_condition, summarizeBlock } from "../../../H000023-ultimatum-game/src/utils";

describe("H000023 ultimatum-game utils", () => {
  it("matches canonical Python controller scheduling", () => {
    const controller = Controller.from_dict({
      seed: 23023,
      enable_logging: false,
      offer_profiles: {
        fair: { label: "fair label", proposer_share: 5, responder_share: 5 },
        unfair: { label: "unfair label", proposer_share: 7, responder_share: 3 },
        very_unfair: { label: "very unfair label", proposer_share: 9, responder_share: 1 }
      }
    });
    const decoded = controller
      .prepare_block({
        block_idx: 0,
        n_trials: 6,
        conditions: ["fair", "unfair", "very_unfair"]
      })
      .map(parse_ultimatum_condition);

    expect(decoded).toEqual([
      {
        condition: "very_unfair",
        condition_label: "very unfair label",
        proposer_share: 9,
        responder_share: 1,
        condition_id: "very_unfair_P9_R1_t001",
        trial_index: 1
      },
      {
        condition: "very_unfair",
        condition_label: "very unfair label",
        proposer_share: 9,
        responder_share: 1,
        condition_id: "very_unfair_P9_R1_t002",
        trial_index: 2
      },
      {
        condition: "unfair",
        condition_label: "unfair label",
        proposer_share: 7,
        responder_share: 3,
        condition_id: "unfair_P7_R3_t003",
        trial_index: 3
      },
      {
        condition: "fair",
        condition_label: "fair label",
        proposer_share: 5,
        responder_share: 5,
        condition_id: "fair_P5_R5_t004",
        trial_index: 4
      },
      {
        condition: "unfair",
        condition_label: "unfair label",
        proposer_share: 7,
        responder_share: 3,
        condition_id: "unfair_P7_R3_t005",
        trial_index: 5
      },
      {
        condition: "fair",
        condition_label: "fair label",
        proposer_share: 5,
        responder_share: 5,
        condition_id: "fair_P5_R5_t006",
        trial_index: 6
      }
    ]);
  });

  it("keeps accept rate numeric for canonical block formatting", () => {
    expect(
      summarizeBlock(
        [
          { block_id: "block_0", accepted: true, earned: 5, total_earned: 5 },
          { block_id: "block_0", accepted: false, earned: 0, total_earned: 5 }
        ],
        "block_0"
      )
    ).toEqual({
      accept_rate: 0.5,
      block_earned: 5,
      total_earned: 5
    });
  });
});
