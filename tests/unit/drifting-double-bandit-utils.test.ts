import { describe, expect, it } from "vitest";

import {
  generate_drifting_bandit_conditions,
  parse_drifting_condition
} from "../../../H000021-drifting-double-bandit/src/utils";

describe("H000021 drifting-double-bandit utils", () => {
  it("matches canonical Python drifting probability generation", () => {
    const decoded = generate_drifting_bandit_conditions(
      5,
      ["bandit"],
      {
        initial_left_prob: 0.65,
        initial_right_prob: 0.35,
        drift_sigma: 0.05,
        min_prob: 0.1,
        max_prob: 0.9,
        anti_correlated: true,
        no_choice_policy: "random",
        randomize_within_block: false
      },
      73105
    ).map(parse_drifting_condition);

    expect(decoded).toEqual([
      {
        p_left: 0.65,
        p_right: 0.35,
        condition_id: "L65_R35_t001",
        trial_index: 1,
        fallback_side: "right",
        reward_draw_u: 0.8260730300603363
      },
      {
        p_left: 0.6681,
        p_right: 0.3319,
        condition_id: "L67_R33_t002",
        trial_index: 2,
        fallback_side: "right",
        reward_draw_u: 0.6473989235986446
      },
      {
        p_left: 0.6949,
        p_right: 0.3051,
        condition_id: "L69_R31_t003",
        trial_index: 3,
        fallback_side: "right",
        reward_draw_u: 0.37171943984129274
      },
      {
        p_left: 0.6889,
        p_right: 0.3111,
        condition_id: "L69_R31_t004",
        trial_index: 4,
        fallback_side: "left",
        reward_draw_u: 0.9490173313719612
      },
      {
        p_left: 0.6766,
        p_right: 0.3234,
        condition_id: "L68_R32_t005",
        trial_index: 5,
        fallback_side: "left",
        reward_draw_u: 0.20684073581280704
      }
    ]);
  });
});
