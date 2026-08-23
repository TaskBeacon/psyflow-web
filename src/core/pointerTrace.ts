import type { PointerTraceTransform } from "./types";

export type TracePoint = [number, number];

export interface TraceSample {
  t: number;
  physical: TracePoint;
  display: TracePoint;
}

export interface TraceEvaluation {
  completed: boolean;
  movement_time: number | null;
  error_excursions: number;
  off_path_duration: number;
  off_path_proportion: number | null;
  rms_path_error: number | null;
  max_progress: number;
  sample_count: number;
}

export function advanceOrderedTraceProgress(current: number, candidate: number, maxStep = 0.2): number {
  const currentValue = Math.max(0, Math.min(1, Number(current)));
  const candidateValue = Math.max(0, Math.min(1, Number(candidate)));
  const delta = candidateValue - currentValue;
  return delta >= 0 && delta <= maxStep ? candidateValue : currentValue;
}

export function normalizeTracePath(points: ReadonlyArray<Readonly<TracePoint>>, closed = true): TracePoint[] {
  if (points.length < 2) {
    throw new Error("pointer trace path requires at least two points");
  }
  const path = points.map(([x, y]) => [Number(x), Number(y)] as TracePoint);
  if (path.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    throw new Error("pointer trace path contains a non-finite coordinate");
  }
  const first = path[0];
  const last = path[path.length - 1];
  if (closed && (first[0] !== last[0] || first[1] !== last[1])) {
    path.push([...first]);
  }
  const hasNonzeroSegment = path.slice(1).some(([x, y], index) => {
    const [px, py] = path[index];
    return Math.hypot(x - px, y - py) > 0;
  });
  if (!hasNonzeroSegment) {
    throw new Error("pointer trace path must contain a non-zero segment");
  }
  return path;
}

export function transformTracePoint(point: TracePoint, transform: PointerTraceTransform): TracePoint {
  return transform === "mirror_x" ? [-point[0], point[1]] : [point[0], point[1]];
}

export function nearestTracePathPosition(
  point: TracePoint,
  pathPoints: ReadonlyArray<Readonly<TracePoint>>
): { distance: number; progress: number } {
  const path = normalizeTracePath(pathPoints, false);
  const lengths = path.slice(1).map(([x, y], index) => Math.hypot(x - path[index][0], y - path[index][1]));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    throw new Error("pointer trace path has zero total length");
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestProgress = 0;
  let elapsed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index];
    if (length <= 0) continue;
    const [ax, ay] = path[index];
    const [bx, by] = path[index + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const fraction = Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / (length * length)));
    const qx = ax + fraction * dx;
    const qy = ay + fraction * dy;
    const distance = Math.hypot(point[0] - qx, point[1] - qy);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProgress = (elapsed + fraction * length) / total;
    }
    elapsed += length;
  }
  return { distance: bestDistance, progress: bestProgress };
}

export function evaluatePointerTrace(
  samples: ReadonlyArray<TraceSample>,
  pathPoints: ReadonlyArray<Readonly<TracePoint>>,
  options: { corridor_width: number; completion_progress: number; finish_radius: number }
): TraceEvaluation {
  const path = normalizeTracePath(pathPoints);
  if (samples.length === 0) {
    return {
      completed: false,
      movement_time: null,
      error_excursions: 0,
      off_path_duration: 0,
      off_path_proportion: null,
      rms_path_error: null,
      max_progress: 0,
      sample_count: 0
    };
  }
  const halfWidth = options.corridor_width / 2;
  let previousInside = true;
  let previousTime: number | null = null;
  let errorExcursions = 0;
  let offPathDuration = 0;
  let squaredError = 0;
  let maxProgress = 0;
  for (const sample of samples) {
    const { distance, progress } = nearestTracePathPosition(sample.display, path);
    const inside = distance <= halfWidth;
    if (!inside && previousInside) errorExcursions += 1;
    if (!inside && previousTime !== null) offPathDuration += Math.max(0, sample.t - previousTime);
    previousInside = inside;
    previousTime = sample.t;
    squaredError += distance * distance;
    maxProgress = advanceOrderedTraceProgress(maxProgress, progress);
  }
  const movementTime = Math.max(0, samples[samples.length - 1].t - samples[0].t);
  const finishDistance = Math.hypot(
    samples[samples.length - 1].display[0] - path[0][0],
    samples[samples.length - 1].display[1] - path[0][1]
  );
  return {
    completed: maxProgress >= options.completion_progress && finishDistance <= options.finish_radius,
    movement_time: movementTime,
    error_excursions: errorExcursions,
    off_path_duration: offPathDuration,
    off_path_proportion: movementTime > 0 ? offPathDuration / movementTime : 0,
    rms_path_error: Math.sqrt(squaredError / samples.length),
    max_progress: maxProgress,
    sample_count: samples.length
  };
}
