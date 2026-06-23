import { describe, expect, it } from "vitest";

import {
  generate_oddball_conditions,
  resolve_generation_settings
} from "../../../H000018-oddball-mmn/src/utils";

describe("H000018 oddball utils", () => {
  it("matches canonical weighted Python shuffle with first-trial stabilization", () => {
    const settings = resolve_generation_settings(["standard", "deviant", "target"], {
      weights: {
        standard: 0.7,
        deviant: 0.2,
        target: 0.1
      },
      order: "random",
      first_trial_label: "standard"
    });
    expect(generate_oddball_conditions(10, ["standard", "deviant", "target"], settings, 73105)).toEqual([
      "standard",
      "standard",
      "deviant",
      "target",
      "deviant",
      "standard",
      "standard",
      "standard",
      "standard",
      "standard"
    ]);
  });
});
