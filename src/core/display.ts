import { TrialBuilder } from "./TrialBuilder";
import type { CompiledTrial, TextStimSpec } from "./types";

export interface CountDownOptions {
  seconds?: number;
  block_id?: string | null;
  condition?: string;
  trial_index_start?: number;
  trial_id_prefix?: string;
  unit_label?: string;
  duration_s?: number;
  stim?: Omit<TextStimSpec, "type" | "text">;
}

export function count_down(options: CountDownOptions = {}): CompiledTrial[] {
  const seconds = Math.max(0, Math.floor(Number(options.seconds ?? 3)));
  const blockId = options.block_id ?? null;
  const condition = options.condition ?? "countdown";
  const trialIndexStart = Number(options.trial_index_start ?? -seconds);
  const trialIdPrefix = options.trial_id_prefix ?? "countdown";
  const unitLabel = options.unit_label ?? "countdown";
  const duration = Number(options.duration_s ?? 1);
  const stimBase: Omit<TextStimSpec, "type" | "text"> = {
    color: "black",
    height: 3.5,
    alignment: "center",
    ...options.stim
  };

  const trials: CompiledTrial[] = [];
  for (let value = seconds; value >= 1; value -= 1) {
    const offset = seconds - value;
    const trial = new TrialBuilder({
      trial_id: `${trialIdPrefix}_${value}`,
      block_id: blockId,
      trial_index: trialIndexStart + offset,
      condition
    });
    trial
      .unit(unitLabel)
      .addStim({
        type: "text",
        text: String(value),
        ...stimBase
      })
      .show({ duration });
    trials.push(trial.build());
  }
  return trials;
}
