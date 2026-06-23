import { describe, expect, it } from "vitest";

import {
  cardConditionToTrialSpec,
  generateCardSortingConditions,
  sampleCardTrialSpec
} from "../../../H000016-card-sorting/src/utils";

describe("H000016 card-sorting utils", () => {
  it("matches canonical Python trial-spec sampling", () => {
    expect(sampleCardTrialSpec("color", { key_list: ["1", "2", "3", "4"], seed: 73105 })).toEqual({
      rule: "color",
      condition_id: "color|BLUE|CIRCLE|2",
      target_color: "BLUE",
      target_shape: "CIRCLE",
      target_number: 2,
      correct_key: "3",
      target_image: "assets/cards/targets/target_color-blue_shape-circle_number-2.png"
    });
  });

  it("matches canonical Python concrete block scheduling", () => {
    const decoded = generateCardSortingConditions(5, ["color"], {
      seed: 73105,
      key_list: ["1", "2", "3", "4"]
    }).map(cardConditionToTrialSpec);

    expect(decoded.map((spec) => spec.condition_id)).toEqual([
      "color|RED|TRIANGLE|3",
      "color|BLUE|TRIANGLE|4",
      "color|BLUE|CIRCLE|4",
      "color|RED|TRIANGLE|3",
      "color|YELLOW|CIRCLE|3"
    ]);
    expect(decoded.map((spec) => spec.correct_key)).toEqual(["1", "3", "3", "1", "4"]);
  });
});
