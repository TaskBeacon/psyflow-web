import { describe, expect, it } from "vitest";

import {
  advanceOrderedTraceProgress,
  TrialBuilder,
  evaluatePointerTrace,
  nearestTracePathPosition,
  transformTracePoint
} from "../../src/index";

const path: Array<[number, number]> = [[0, 1], [1, 0], [0, -1], [-1, 0], [0, 1]];

function samples(withError = false) {
  const points: Array<[number, number]> = [
    [0, 1], [0.5, 0.5], [1, 0], [0.5, -0.5], [0, -1],
    [-0.5, -0.5], [-1, 0], [-0.5, 0.5], [-0.1, 0.9], [0, 1]
  ];
  if (withError) points[4] = [0.4, -1.4];
  return points.map((display, index) => ({ t: index * 0.25, physical: display, display }));
}

describe("continuous pointer tracing", () => {
  it("matches the Python mirror transform and path-position geometry", () => {
    expect(transformTracePoint([2, -3], "mirror_x")).toEqual([-2, -3]);
    expect(transformTracePoint([2, -3], "identity")).toEqual([2, -3]);
    const position = nearestTracePathPosition([0.5, 0.5], path);
    expect(position.distance).toBeCloseTo(0);
    expect(position.progress).toBeGreaterThan(0);
    expect(position.progress).toBeLessThan(0.5);
  });

  it("scores accurate, error, and timeout traces", () => {
    const accurate = evaluatePointerTrace(samples(), path, {
      corridor_width: 0.2,
      completion_progress: 0.9,
      finish_radius: 0.15
    });
    expect(accurate).toMatchObject({ completed: true, error_excursions: 0, movement_time: 2.25, sample_count: 10 });

    const error = evaluatePointerTrace(samples(true), path, {
      corridor_width: 0.2,
      completion_progress: 0.9,
      finish_radius: 0.15
    });
    expect(error.completed).toBe(true);
    expect(error.error_excursions).toBeGreaterThanOrEqual(1);
    expect(error.off_path_duration).toBeGreaterThan(0);

    const timeout = evaluatePointerTrace([], path, {
      corridor_width: 0.2,
      completion_progress: 0.9,
      finish_radius: 0.15
    });
    expect(timeout).toMatchObject({ completed: false, movement_time: null, sample_count: 0 });
  });

  it("rejects the closed-path reverse-direction shortcut", () => {
    const reverse = [
      { t: 0, physical: [0, 1] as [number, number], display: [0, 1] as [number, number] },
      { t: 0.1, physical: [-0.05, 0.95] as [number, number], display: [-0.05, 0.95] as [number, number] },
      { t: 0.2, physical: [-0.1, 0.9] as [number, number], display: [-0.1, 0.9] as [number, number] },
      { t: 0.3, physical: [0, 1] as [number, number], display: [0, 1] as [number, number] }
    ];
    expect(evaluatePointerTrace(reverse, path, {
      corridor_width: 0.2, completion_progress: 0.9, finish_radius: 0.15
    })).toMatchObject({ completed: false, max_progress: 0 });
    expect(advanceOrderedTraceProgress(0.1, 0.15)).toBe(0.15);
    expect(advanceOrderedTraceProgress(0, 0.95)).toBe(0);
  });

  it("compiles a framework-owned capture_pointer_trace stage", () => {
    const trial = new TrialBuilder({ trial_id: 1, block_id: "b", trial_index: 0, condition: "mirror" });
    const unit = trial.unit("tracing");
    unit.capturePointerTrace({
      path_points: path,
      corridor_width: 0.2,
      transform: "mirror_x",
      finish_radius: 0.15,
      completion_progress: 0.9,
      duration: 60,
      onset_trigger: 20,
      start_trigger: 21,
      error_trigger: 22,
      complete_trigger: 23,
      timeout_trigger: 24
    });
    expect(unit.compile()).toMatchObject({
      op: "capture_pointer_trace",
      duration: 60,
      onset_trigger: 20,
      pointer_trace_cfg: { transform: "mirror_x", complete_trigger: 23, timeout_trigger: 24 }
    });
  });
});
