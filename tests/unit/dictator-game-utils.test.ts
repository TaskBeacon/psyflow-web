import { describe, expect, it } from "vitest";

import { Controller } from "../../../H000025-dictator-game/src/controller";
import { parse_dictator_condition, summarizeBlock } from "../../../H000025-dictator-game/src/utils";

function makeController(): Controller {
  return Controller.from_dict({
    seed: 25025,
    enable_logging: false,
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
}

describe("H000025 dictator-game utils", () => {
  it("matches canonical Python controller scheduling", () => {
    const decoded = makeController()
      .prepare_block({
        block_idx: 0,
        n_trials: 6,
        conditions: ["low_stake", "medium_stake", "high_stake"]
      })
      .map(parse_dictator_condition);

    expect(decoded).toEqual([
      {
        condition: "medium_stake",
        condition_label: "medium stake",
        stake: 20,
        condition_id: "medium_stake_s20_t001",
        trial_index: 1
      },
      {
        condition: "low_stake",
        condition_label: "low stake",
        stake: 10,
        condition_id: "low_stake_s10_t002",
        trial_index: 2
      },
      {
        condition: "high_stake",
        condition_label: "high stake",
        stake: 30,
        condition_id: "high_stake_s30_t003",
        trial_index: 3
      },
      {
        condition: "medium_stake",
        condition_label: "medium stake",
        stake: 20,
        condition_id: "medium_stake_s20_t004",
        trial_index: 4
      },
      {
        condition: "low_stake",
        condition_label: "low stake",
        stake: 10,
        condition_id: "low_stake_s10_t005",
        trial_index: 5
      },
      {
        condition: "high_stake",
        condition_label: "high stake",
        stake: 30,
        condition_id: "high_stake_s30_t006",
        trial_index: 6
      }
    ]);
  });

  it("matches canonical allocation and timeout-as-equal semantics", () => {
    const controller = makeController();
    controller.prepare_block({
      block_idx: 0,
      n_trials: 6,
      conditions: ["low_stake", "medium_stake", "high_stake"]
    });

    expect(
      controller.register_decision({
        condition: "high_stake",
        block_idx: 0,
        trial_index: 1,
        stake: 30,
        choice: "generous",
        timed_out: false
      })
    ).toMatchObject({
      self_amount: 9,
      other_amount: 21,
      self_total: 9,
      other_total: 21
    });
    expect(
      controller.register_decision({
        condition: "low_stake",
        block_idx: 0,
        trial_index: 2,
        stake: 10,
        choice: "equal",
        timed_out: true
      })
    ).toMatchObject({
      choice: "equal",
      timed_out: true,
      self_amount: 5,
      other_amount: 5,
      self_total: 14,
      other_total: 26
    });
  });

  it("keeps allocation rates numeric for canonical block formatting", () => {
    expect(
      summarizeBlock(
        [
          { block_id: "block_0", choice: "generous", self_amount: 9, other_amount: 21, self_total: 9, other_total: 21 },
          { block_id: "block_0", choice: "equal", self_amount: 5, other_amount: 5, self_total: 14, other_total: 26 }
        ],
        "block_0"
      )
    ).toEqual({
      generous_rate: 0.5,
      equal_rate: 0.5,
      selfish_rate: 0,
      block_self_total: 14,
      block_other_total: 26,
      self_total: 14,
      other_total: 26
    });
  });
});
