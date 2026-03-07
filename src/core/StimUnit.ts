import type {
  CompiledStage,
  Resolvable,
  StateRef,
  StimRef,
  StimSpec,
  TrialContextSpec
} from "./types";
import { resolve_deadline } from "./trials";
import { TrialBuilder } from "./TrialBuilder";

type StageStatePatch = Record<string, Resolvable<unknown>>;

export class StimUnit {
  readonly label: string;
  private readonly trial: TrialBuilder;
  private readonly stimRefs: Array<Resolvable<StimRef | StimSpec | null>> = [];
  private readonly pendingContext: TrialContextSpec = {};
  private readonly statePatch: StageStatePatch = {};
  private stage?: CompiledStage;

  constructor(label: string, trial: TrialBuilder) {
    this.label = label;
    this.trial = trial;
  }

  addStim(...stims: Array<Resolvable<StimRef | StimSpec | null>>): this {
    this.stimRefs.push(...stims);
    return this;
  }

  show(options: { duration?: Resolvable<number | number[] | null> } = {}): this {
    this.stage = {
      unit_label: this.label,
      op: "show",
      phase: this.pendingContext.phase ?? null,
      stim_refs: [...this.stimRefs],
      duration: options.duration ?? null,
      context: this.buildContext(options.duration),
      state_patch: { ...this.statePatch },
      export_to_reduced: false
    };
    return this;
  }

  captureResponse(
    options: {
      keys: string[];
      duration: Resolvable<number | number[] | null>;
      correct_keys?: string[] | string;
      terminate_on_response?: boolean;
      response_trigger?: number | Record<string, number> | null;
      timeout_trigger?: number | null;
    }
  ): this {
    const correctKeys =
      typeof options.correct_keys === "string" ? [options.correct_keys] : options.correct_keys;
    this.stage = {
      unit_label: this.label,
      op: "capture_response",
      phase: this.pendingContext.phase ?? null,
      stim_refs: [...this.stimRefs],
      duration: options.duration,
      response_cfg: {
        keys: [...options.keys],
        correct_keys: correctKeys ? [...correctKeys] : undefined,
        terminate_on_response: options.terminate_on_response ?? true,
        response_trigger: options.response_trigger ?? null,
        timeout_trigger: options.timeout_trigger ?? null
      },
      context: this.buildContext(options.duration, options.keys),
      state_patch: { ...this.statePatch },
      export_to_reduced: false
    };
    return this;
  }

  waitAndContinue(options: { keys?: string[]; min_wait?: number } = {}): this {
    const minWait = options.min_wait ?? 0;
    this.stage = {
      unit_label: this.label,
      op: "wait_and_continue",
      phase: this.pendingContext.phase ?? null,
      stim_refs: [...this.stimRefs],
      response_cfg: {
        keys: [...(options.keys ?? ["space"])],
        terminate_on_response: true
      },
      context: this.buildContext(minWait, options.keys ?? ["space"]),
      state_patch: { ...this.statePatch },
      export_to_reduced: false,
      min_wait: minWait
    };
    return this;
  }

  set_state(patch: StageStatePatch): this {
    Object.assign(this.statePatch, patch);
    if (this.stage) {
      this.stage.state_patch = { ...this.statePatch };
    }
    return this;
  }

  setContext(context: TrialContextSpec): this {
    Object.assign(this.pendingContext, context);
    if (this.stage) {
      this.stage.context = this.buildContext(this.stage.duration ?? null, this.stage.response_cfg?.keys);
      this.stage.phase = this.pendingContext.phase ?? null;
    }
    return this;
  }

  ref<T = unknown>(key: string): StateRef<T> {
    return {
      kind: "state_ref",
      unit_label: this.label,
      key
    };
  }

  to_dict(): this {
    if (!this.stage) {
      throw new Error("Cannot export a StimUnit before calling show/captureResponse/waitAndContinue.");
    }
    this.stage.export_to_reduced = true;
    return this;
  }

  compile(): CompiledStage {
    if (!this.stage) {
      throw new Error(`StimUnit '${this.label}' does not define an operation.`);
    }
    return { ...this.stage };
  }

  private buildContext(
    duration: Resolvable<number | number[] | null> | null | undefined,
    validKeys?: string[]
  ): TrialContextSpec {
    const resolvedDeadline =
      typeof duration === "number" || Array.isArray(duration) ? resolve_deadline(duration) : this.pendingContext.deadline_s;
    return {
      ...this.pendingContext,
      trial_id: this.pendingContext.trial_id ?? this.trial.trial_id,
      block_id: this.pendingContext.block_id ?? this.trial.block_id,
      condition_id: this.pendingContext.condition_id ?? this.trial.condition,
      deadline_s: this.pendingContext.deadline_s ?? resolvedDeadline,
      valid_keys: this.pendingContext.valid_keys ?? (validKeys ? [...validKeys] : undefined)
    };
  }
}

export function set_trial_context(unit: StimUnit, context: TrialContextSpec): StimUnit {
  return unit.setContext(context);
}
