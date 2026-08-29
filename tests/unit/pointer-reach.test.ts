import { describe, expect, it } from "vitest";

import {
  TrialBuilder,
  angularDifferenceDeg,
  evaluatePointerReach,
  polarReachPoint,
  rotateReachPoint,
  transformReachPoint
} from "../../src/index";

describe("click-free centre-out pointer reaching", () => {
  it("matches Python rotation and angular geometry", () => {
    expect(rotateReachPoint([0, 6], -45)[0]).toBeCloseTo(4.242640687);
    expect(transformReachPoint([0, 6], "veridical", 45)).toEqual([0, 6]);
    expect(angularDifferenceDeg(-179, 179)).toBe(2);
  });

  it("scores compensated cursor hits and slow reaches", () => {
    const points = Array.from({ length: 13 }, (_, index) => {
      const fraction = index / 12;
      const endpoint = polarReachPoint(6, 135);
      const physical: [number, number] = [endpoint[0] * fraction, endpoint[1] * fraction];
      return {
        t: 0.25 + 0.15 * fraction,
        physical,
        display: transformReachPoint(physical, "rotated", -45),
        visible: true
      };
    });
    expect(evaluatePointerReach(points, {
      target_position: [0, 6], target_distance: 6, target_radius: 0.25,
      reaction_threshold: 1, movement_deadline: 0.5
    })).toMatchObject({ completed: true, cursor_hit: true, hand_angle_deg: 135, cursor_angle_deg: 90 });
    expect(evaluatePointerReach(points.map((sample, index) => ({ ...sample, t: 0.25 + 0.75 * index / 12 })), {
      target_position: [0, 6], target_distance: 6, target_radius: 0.25,
      reaction_threshold: 1, movement_deadline: 0.5
    })).toMatchObject({ completed: false, timed_out: true });
  });

  it("compiles the public framework-owned reach contract", () => {
    const trial = new TrialBuilder({ trial_id: 1, block_id: "adaptation", trial_index: 0, condition: "rotated" });
    const unit = trial.unit("reach");
    unit.capturePointerReach({
      start: { kind: "stim_ref", key: "start" },
      target: { kind: "stim_ref", key: "target" },
      cursor: { kind: "stim_ref", key: "cursor" },
      target_position: [0, 6],
      target_distance: 6,
      start_radius: 0.25,
      target_radius: 0.25,
      search_visibility_radius: 2,
      start_hold_duration: 0.5,
      movement_deadline: 0.5,
      reaction_threshold: 1,
      feedback_mode: "rotated",
      rotation_deg: -45,
      endpoint_freeze_duration: 0.05,
      onset_trigger: 20,
      hold_trigger: 21,
      target_trigger: 31,
      movement_trigger: 40,
      complete_trigger: 50,
      hit_trigger: 52,
      timeout_trigger: 51
    });
    expect(unit.compile()).toMatchObject({
      op: "capture_pointer_reach",
      onset_trigger: 20,
      duration: null,
      pointer_reach_cfg: {
        feedback_mode: "rotated",
        rotation_deg: -45,
        movement_deadline: 0.5,
        complete_trigger: 50,
        timeout_trigger: 51
      }
    });
  });
});
