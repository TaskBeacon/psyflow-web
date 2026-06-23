import { describe, expect, it } from "vitest";

import { sample_reward_draw } from "../../../H000009-prl/src/utils";

describe("H000009 PRL utils", () => {
  it("matches canonical deterministic reward draws", () => {
    const settings = { block_seed: [73105] };

    expect(sample_reward_draw(settings, "AB", 0, 1, 0)).toEqual({
      rand_val: 0.6818635963780746,
      reward_seed: 74311
    });
    expect(sample_reward_draw(settings, "BA", 0, 2, 0)).toEqual({
      rand_val: 0.12269155635090301,
      reward_seed: 75319
    });
    expect(sample_reward_draw(settings, "AB", 0, 10, 1)).toEqual({
      rand_val: 0.6477693148478681,
      reward_seed: 183395
    });
  });
});
