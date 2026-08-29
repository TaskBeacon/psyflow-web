export type ReachPoint = [number, number];
export type PointerReachFeedbackMode = "veridical" | "rotated" | "none";

export interface ReachSample {
  t: number;
  physical: ReachPoint;
  display: ReachPoint;
  visible: boolean;
}

export interface ReachEvaluation {
  completed: boolean;
  timed_out: boolean;
  reaction_time: number | null;
  movement_time: number | null;
  physical_endpoint: ReachPoint | null;
  display_endpoint: ReachPoint | null;
  hand_angle_deg: number | null;
  cursor_angle_deg: number | null;
  cursor_error_deg: number | null;
  cursor_hit: boolean;
  sample_count: number;
}

export function normalizeReachAngleDeg(value: number): number {
  return ((Number(value) + 180) % 360 + 360) % 360 - 180;
}

export function pointAngleDeg([x, y]: Readonly<ReachPoint>): number {
  return Math.atan2(Number(y), Number(x)) * 180 / Math.PI;
}

export function angularDifferenceDeg(value: number, reference: number): number {
  return normalizeReachAngleDeg(Number(value) - Number(reference));
}

export function rotateReachPoint([x, y]: Readonly<ReachPoint>, angleDeg: number): ReachPoint {
  const theta = Number(angleDeg) * Math.PI / 180;
  return [
    Number(x) * Math.cos(theta) - Number(y) * Math.sin(theta),
    Number(x) * Math.sin(theta) + Number(y) * Math.cos(theta)
  ];
}

export function polarReachPoint(radius: number, angleDeg: number): ReachPoint {
  const theta = Number(angleDeg) * Math.PI / 180;
  return [Number(radius) * Math.cos(theta), Number(radius) * Math.sin(theta)];
}

export function transformReachPoint(
  point: Readonly<ReachPoint>,
  feedbackMode: PointerReachFeedbackMode,
  rotationDeg: number
): ReachPoint {
  if (feedbackMode === "rotated") return rotateReachPoint(point, rotationDeg);
  if (feedbackMode === "veridical" || feedbackMode === "none") return [Number(point[0]), Number(point[1])];
  throw new Error(`unsupported reach feedback mode: ${String(feedbackMode)}`);
}

export function evaluatePointerReach(
  samples: ReadonlyArray<ReachSample>,
  options: {
    target_position: ReachPoint;
    target_distance: number;
    target_radius: number;
    reaction_threshold: number;
    movement_deadline: number;
  }
): ReachEvaluation {
  if (samples.length === 0) {
    return {
      completed: false,
      timed_out: true,
      reaction_time: null,
      movement_time: null,
      physical_endpoint: null,
      display_endpoint: null,
      hand_angle_deg: null,
      cursor_angle_deg: null,
      cursor_error_deg: null,
      cursor_hit: false,
      sample_count: 0
    };
  }

  let firstMoveTime: number | null = null;
  let reactionTime: number | null = null;
  let terminal = samples[samples.length - 1];
  for (const sample of samples) {
    const radius = Math.hypot(sample.physical[0], sample.physical[1]);
    if (firstMoveTime === null && radius > 0) firstMoveTime = sample.t;
    if (reactionTime === null && radius >= options.reaction_threshold) reactionTime = sample.t;
    if (radius >= options.target_distance) {
      terminal = sample;
      break;
    }
  }

  const movementTime = Math.max(0, terminal.t - (firstMoveTime ?? 0));
  const radialComplete = Math.hypot(terminal.physical[0], terminal.physical[1]) >= options.target_distance;
  const completed = radialComplete && movementTime <= options.movement_deadline;
  const targetAngle = pointAngleDeg(options.target_position);
  const handAngle = pointAngleDeg(terminal.physical);
  const cursorAngle = pointAngleDeg(terminal.display);
  const cursorError = angularDifferenceDeg(cursorAngle, targetAngle);
  const cursorHit = Math.hypot(
    terminal.display[0] - options.target_position[0],
    terminal.display[1] - options.target_position[1]
  ) <= options.target_radius;
  return {
    completed,
    timed_out: !completed,
    reaction_time: reactionTime,
    movement_time: movementTime,
    physical_endpoint: [...terminal.physical],
    display_endpoint: [...terminal.display],
    hand_angle_deg: handAngle,
    cursor_angle_deg: cursorAngle,
    cursor_error_deg: cursorError,
    cursor_hit: completed && cursorHit,
    sample_count: samples.length
  };
}

