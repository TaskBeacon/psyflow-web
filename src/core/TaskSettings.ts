type SettingsLike = Record<string, unknown>;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function makeSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Experiment configuration container (browser counterpart of Python's TaskSettings).
 *
 * Create via {@link TaskSettings.from_dict} with a parsed YAML config object.
 * Holds window display, block/trial structure, seeding, and condition weights.
 */
export class TaskSettings {
  [key: string]: unknown;

  size = [1280, 720];
  units = "deg";
  screen = 0;
  bg_color = "gray";
  fullscreen = false;
  total_blocks = 1;
  total_trials = 10;
  key_list = ["space"];
  conditions: string[] = [];
  condition_weights: number[] | Record<string, number> | null = null;
  block_seed: Array<number | null> = [];
  seed_mode = "same_across_sub";
  overall_seed = 2025;
  trials_per_block = 10;
  trial_per_block?: number;
  subject_id?: string;

  /**
   * Create a TaskSettings from a flat config dictionary.
   * Validates `trial_per_block` consistency and initialises block seeds.
   */
  static from_dict(config: SettingsLike): TaskSettings {
    const settings = new TaskSettings();
    Object.assign(settings, config);
    const derivedTrialsPerBlock = Math.ceil(
      Number(settings.total_trials ?? 10) / Math.max(1, Number(settings.total_blocks ?? 1))
    );
    const configuredTrialPerBlock = config.trial_per_block ?? config.trials_per_block;
    if (configuredTrialPerBlock !== undefined && Number(configuredTrialPerBlock) !== derivedTrialsPerBlock) {
      throw new Error(
        `trial_per_block=${String(configuredTrialPerBlock)} does not match derived trials_per_block=${derivedTrialsPerBlock}.`
      );
    }
    settings.trials_per_block = Number(configuredTrialPerBlock ?? derivedTrialsPerBlock);
    settings.trial_per_block = settings.trials_per_block;
    if (!Array.isArray(settings.block_seed) || settings.block_seed.length === 0) {
      settings.block_seed = new Array(Number(settings.total_blocks ?? 1)).fill(null);
    }
    if (
      settings.seed_mode === "same_across_sub" &&
      settings.block_seed.every((seed) => seed === null)
    ) {
      settings.set_block_seed(Number(settings.overall_seed ?? 2025));
    }
    return settings;
  }

  set_block_seed(seedBase: number): void {
    const rng = makeSeededRandom(seedBase);
    this.block_seed = new Array(Number(this.total_blocks ?? 1))
      .fill(null)
      .map(() => Math.floor(rng() * 100000));
  }

  /** Merge participant info into settings and derive per-subject seeds when `seed_mode` is `"same_within_sub"`. */
  add_subinfo(subinfo: Record<string, unknown>): void {
    Object.assign(this, subinfo);
    const subjectId = String(subinfo.subject_id ?? "");
    if (!subjectId) {
      throw new Error("subject_id is required in subinfo");
    }
    this.subject_id = subjectId;
    if (
      this.seed_mode === "same_within_sub" &&
      Array.isArray(this.block_seed) &&
      this.block_seed.every((seed) => seed === null)
    ) {
      this.overall_seed = hashString(subjectId);
      this.set_block_seed(Number(this.overall_seed));
    }
  }

  /** Return validated weight vector aligned to `conditions`, or `null` for equal weighting. */
  resolve_condition_weights(): number[] | null {
    const raw = this.condition_weights;
    if (raw == null) {
      return null;
    }
    const labels = Array.isArray(this.conditions) ? this.conditions.map(String) : [];
    if (labels.length === 0) {
      throw new Error("conditions must be configured when condition_weights is provided.");
    }
    const values =
      Array.isArray(raw)
        ? raw
        : labels.map((label) => {
            const weight = raw[label];
            if (weight === undefined) {
              throw new Error(`condition_weights is missing condition '${label}'.`);
            }
            return weight;
          });
    if (values.length !== labels.length) {
      throw new Error("condition_weights length must match conditions length.");
    }
    return values.map((value, index) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`condition_weights[${index}] must be a finite number > 0.`);
      }
      return parsed;
    });
  }
}
