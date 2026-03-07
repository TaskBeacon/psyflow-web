import { describe, expect, it } from "vitest";

import { Controller } from "../../../H000006-mid/src/controller";

describe("MID Controller", () => {
  it("updates target duration separately by condition", () => {
    const controller = Controller.from_dict({
      initial_duration: 0.2,
      min_duration: 0.08,
      max_duration: 0.3,
      step: 0.02,
      target_accuracy: 0.66,
      condition_specific: true
    });

    expect(controller.get_duration("win")).toBe(0.2);
    expect(controller.get_duration("lose")).toBe(0.2);

    controller.update(true, "win");

    expect(controller.get_duration("win")).toBeCloseTo(0.18, 6);
    expect(controller.get_duration("lose")).toBeCloseTo(0.2, 6);

    controller.update(false, "lose");

    expect(controller.get_duration("win")).toBeCloseTo(0.18, 6);
    expect(controller.get_duration("lose")).toBeCloseTo(0.22, 6);
  });
});
