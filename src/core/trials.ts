let sessionTrialCounter = 0;

export function next_trial_id(): number {
  sessionTrialCounter += 1;
  return sessionTrialCounter;
}

export function reset_trial_counter(startAt = 0): void {
  sessionTrialCounter = startAt;
}

export function resolve_deadline(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    const nums = value.filter((item): item is number => typeof item === "number");
    if (nums.length > 0) {
      return Math.max(...nums);
    }
  }
  return null;
}
