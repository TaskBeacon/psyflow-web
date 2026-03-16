import type {
  CompiledTrial,
  TrialFinalizeHelpers,
  TrialFinalizer,
  TrialSnapshot
} from "./types";
import { StimUnit } from "./StimUnit";

/**
 * Builds a single {@link CompiledTrial} from an ordered sequence of {@link StimUnit} stages.
 *
 * Typical usage: `new TrialBuilder(meta).unit("fixation").addStim(...).show()...build()`
 */
export class TrialBuilder {
  readonly trial_id: number | string;
  readonly block_id: string | null;
  readonly trial_index: number;
  readonly condition: string;
  private readonly units: StimUnit[] = [];
  private readonly finalizers: TrialFinalizer[] = [];
  private readonly trialState: Record<string, unknown> = {};

  constructor(meta: {
    trial_id: number | string;
    block_id: string | null;
    trial_index: number;
    condition: string;
  }) {
    this.trial_id = meta.trial_id;
    this.block_id = meta.block_id;
    this.trial_index = meta.trial_index;
    this.condition = meta.condition;
  }

  /** Create and register a new {@link StimUnit} stage with the given label. */
  unit(label: string): StimUnit {
    const unit = new StimUnit(label, this);
    this.units.push(unit);
    return unit;
  }

  finalize(fn: TrialFinalizer): this {
    this.finalizers.push(fn);
    return this;
  }

  setTrialState(key: string, value: unknown): void {
    this.trialState[key] = value;
  }

  /** Compile all registered units into a {@link CompiledTrial}. */
  build(): CompiledTrial {
    return {
      trial_id: this.trial_id,
      block_id: this.block_id,
      trial_index: this.trial_index,
      condition: this.condition,
      units: this.units.map((unit) => unit.compile()),
      trial_state: { ...this.trialState },
      finalizers: [...this.finalizers]
    };
  }
}

export function createFinalizeHelpers(
  snapshot: TrialSnapshot,
  trialState: Record<string, unknown>
): TrialFinalizeHelpers {
  return {
    setTrialState(key: string, value: unknown) {
      trialState[key] = value;
    },
    getUnitState(unitLabel: string, key: string) {
      return snapshot.units[unitLabel]?.[key];
    }
  };
}
