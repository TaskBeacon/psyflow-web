import { describe, expect, it } from "vitest";

import {
  build_bandit_schedule,
  parse_bandit_condition
} from "../../../H000020-one-armed-bandit/src/utils";

describe("H000020 one-armed-bandit utils", () => {
  it("matches canonical block probability scheduling without pre-drawing outcomes", () => {
    const decoded = build_bandit_schedule(
      3,
      ["bandit"],
      0,
      {
        block_probabilities: [
          { left: 0.75, right: 0.25 },
          { left: 0.25, right: 0.75 }
        ]
      },
      73105
    ).map(parse_bandit_condition);

    expect(decoded).toEqual([
      { p_left: 0.75, p_right: 0.25, condition_id: "L75_R25", trial_index: 1 },
      { p_left: 0.75, p_right: 0.25, condition_id: "L75_R25", trial_index: 2 },
      { p_left: 0.75, p_right: 0.25, condition_id: "L75_R25", trial_index: 3 }
    ]);
  });
});
