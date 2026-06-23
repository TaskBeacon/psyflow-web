import { describe, expect, it } from "vitest";

import { Controller } from "../../../H000024-trust-game/src/controller";
import { parse_trust_condition, summarizeBlock } from "../../../H000024-trust-game/src/utils";

function makeController(): Controller {
  return Controller.from_dict({
    seed: 24024,
    enable_logging: false,
    endowment: 10,
    transfer_multiplier: 3,
    return_noise_ratio: 0.05,
    partner_profiles: {
      high_trust: { label: "high label", return_ratio: 0.6 },
      medium_trust: { label: "medium label", return_ratio: 0.4 },
      low_trust: { label: "low label", return_ratio: 0.2 }
    }
  });
}

describe("H000024 trust-game utils", () => {
  it("matches canonical Python controller scheduling", () => {
    const decoded = makeController()
      .prepare_block({
        block_idx: 0,
        n_trials: 6,
        conditions: ["high_trust", "medium_trust", "low_trust"]
      })
      .map(parse_trust_condition);

    expect(decoded).toEqual([
      {
        condition: "medium_trust",
        partner_label: "medium label",
        return_ratio: 0.4,
        condition_id: "medium_trust_r40_t001",
        trial_index: 1
      },
      {
        condition: "medium_trust",
        partner_label: "medium label",
        return_ratio: 0.4,
        condition_id: "medium_trust_r40_t002",
        trial_index: 2
      },
      {
        condition: "high_trust",
        partner_label: "high label",
        return_ratio: 0.6,
        condition_id: "high_trust_r60_t003",
        trial_index: 3
      },
      {
        condition: "low_trust",
        partner_label: "low label",
        return_ratio: 0.2,
        condition_id: "low_trust_r20_t004",
        trial_index: 4
      },
      {
        condition: "low_trust",
        partner_label: "low label",
        return_ratio: 0.2,
        condition_id: "low_trust_r20_t005",
        trial_index: 5
      },
      {
        condition: "high_trust",
        partner_label: "high label",
        return_ratio: 0.6,
        condition_id: "high_trust_r60_t006",
        trial_index: 6
      }
    ]);
  });

  it("matches canonical invested and timeout payoff resolution", () => {
    const controller = makeController();
    controller.prepare_block({
      block_idx: 0,
      n_trials: 6,
      conditions: ["high_trust", "medium_trust", "low_trust"]
    });

    expect(
      controller.resolve_outcome({
        condition: "high_trust",
        block_idx: 0,
        trial_index: 1,
        trusted: true,
        timed_out: false
      })
    ).toMatchObject({
      invested: 10,
      multiplied_amount: 30,
      returned: 18,
      earned: 18,
      total_earned: 18
    });
    expect(
      controller.resolve_outcome({
        condition: "high_trust",
        block_idx: 0,
        trial_index: 2,
        trusted: false,
        timed_out: true
      })
    ).toMatchObject({
      invested: 0,
      multiplied_amount: 0,
      returned: 0,
      earned: 10,
      total_earned: 28
    });
  });

  it("keeps trust rate numeric for canonical block formatting", () => {
    expect(
      summarizeBlock(
        [
          { block_id: "block_0", trusted: true, earned: 18, total_earned: 18 },
          { block_id: "block_0", trusted: false, earned: 10, total_earned: 28 }
        ],
        "block_0"
      )
    ).toEqual({
      trust_rate: 0.5,
      block_earned: 28,
      total_earned: 28
    });
  });
});
