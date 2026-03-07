import { TaskSettings } from "./TaskSettings";

function makeSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BlockUnit {
  block_id: string;
  block_idx: number;
  settings: TaskSettings;
  n_trials: number;
  seed: number;
  conditions: string[] = [];

  constructor({
    block_id,
    block_idx,
    settings,
    n_trials
  }: {
    block_id: string;
    block_idx: number;
    settings: TaskSettings;
    n_trials?: number;
  }) {
    this.block_id = block_id;
    this.block_idx = block_idx;
    this.settings = settings;
    this.n_trials = n_trials ?? Number(settings.trials_per_block);
    const seeds = Array.isArray(settings.block_seed) ? settings.block_seed : [];
    this.seed = Number(seeds[block_idx] ?? settings.overall_seed ?? 2025);
  }

  generate_conditions(): this {
    const labels = this.settings.conditions.length > 0 ? this.settings.conditions : ["A", "B", "C"];
    const weights = this.settings.resolve_condition_weights();
    const rng = makeSeededRandom(this.seed);
    const normalizedWeights = weights ?? new Array(labels.length).fill(1);
    const totalWeight = normalizedWeights.reduce((sum, value) => sum + value, 0);
    const counts = normalizedWeights.map((weight) => Math.floor((this.n_trials * weight) / totalWeight));
    let remainder = this.n_trials - counts.reduce((sum, value) => sum + value, 0);
    while (remainder > 0) {
      const sample = rng() * totalWeight;
      let cumulative = 0;
      let chosenIndex = normalizedWeights.length - 1;
      for (let index = 0; index < normalizedWeights.length; index += 1) {
        cumulative += normalizedWeights[index];
        if (sample <= cumulative) {
          chosenIndex = index;
          break;
        }
      }
      counts[chosenIndex] += 1;
      remainder -= 1;
    }
    const result: string[] = [];
    labels.forEach((label, idx) => {
      for (let i = 0; i < counts[idx]; i += 1) {
        result.push(label);
      }
    });
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    this.conditions = result;
    return this;
  }
}
