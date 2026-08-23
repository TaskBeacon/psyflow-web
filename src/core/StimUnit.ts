import type {
  CompiledStage,
  Resolvable,
  PointerSequenceConfig,
  PointerTraceConfig,
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
  private enabledWhen?: Resolvable<boolean>;
  private stage?: CompiledStage;

  constructor(label: string, trial: TrialBuilder) {
    this.label = label;
    this.trial = trial;
  }

  addStim(...stims: Array<Resolvable<StimRef | StimSpec | null>>): this {
    this.stimRefs.push(...stims);
    return this;
  }

  show(options: {
    duration?: Resolvable<number | number[] | null>;
    onset_trigger?: Resolvable<number | null>;
  } = {}): this {
    this.stage = {
      unit_label: this.label,
      op: "show",
      phase: this.pendingContext.phase ?? null,
      onset_trigger: options.onset_trigger ?? null,
      when: this.enabledWhen,
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
      correct_keys?: Resolvable<string[] | string | undefined>;
      terminate_on_response?: boolean;
      count_responses?: boolean;
      grace_s?: number;
      onset_trigger?: Resolvable<number | null>;
      response_trigger?: Resolvable<number | Record<string, number> | null>;
      timeout_trigger?: Resolvable<number | null>;
    }
  ): this {
    this.stage = {
      unit_label: this.label,
      op: "capture_response",
      phase: this.pendingContext.phase ?? null,
      onset_trigger: options.onset_trigger ?? null,
      when: this.enabledWhen,
      stim_refs: [...this.stimRefs],
      duration: options.duration,
      response_cfg: {
        keys: [...options.keys],
        correct_keys: options.correct_keys,
        terminate_on_response: options.terminate_on_response ?? true,
        count_responses: options.count_responses ?? false,
        grace_s: options.grace_s ?? 0,
        response_trigger: options.response_trigger ?? null,
        timeout_trigger: options.timeout_trigger ?? null
      },
      context: this.buildContext(options.duration, options.keys),
      state_patch: { ...this.statePatch },
      export_to_reduced: false
    };
    return this;
  }

  capturePointerSequence(options: {
    targets: PointerSequenceConfig["targets"];
    max_selections: number;
    duration: Resolvable<number | number[] | null>;
    onset_trigger?: Resolvable<number | null>;
    selection_trigger?: PointerSequenceConfig["selection_trigger"];
    complete_trigger?: PointerSequenceConfig["complete_trigger"];
    timeout_trigger?: PointerSequenceConfig["timeout_trigger"];
    highlight_color?: string;
    highlight_duration_s?: number;
  }): this {
    if (!Number.isInteger(options.max_selections) || options.max_selections < 1) {
      throw new Error("capturePointerSequence requires max_selections >= 1.");
    }
    if (Object.keys(options.targets).length === 0) {
      throw new Error("capturePointerSequence requires at least one named target.");
    }
    this.stage = {
      unit_label: this.label,
      op: "capture_pointer_sequence",
      phase: this.pendingContext.phase ?? null,
      onset_trigger: options.onset_trigger ?? null,
      when: this.enabledWhen,
      stim_refs: [...this.stimRefs],
      duration: options.duration,
      pointer_cfg: {
        targets: { ...options.targets },
        max_selections: options.max_selections,
        selection_trigger: options.selection_trigger ?? null,
        complete_trigger: options.complete_trigger ?? null,
        timeout_trigger: options.timeout_trigger ?? null,
        highlight_color: options.highlight_color,
        highlight_duration_s: options.highlight_duration_s
      },
      context: this.buildContext(options.duration, Object.keys(options.targets)),
      state_patch: { ...this.statePatch },
      export_to_reduced: false
    };
    return this;
  }

  capturePointerTrace(options: PointerTraceConfig & {
    duration: Resolvable<number | number[] | null>;
    onset_trigger?: Resolvable<number | null>;
  }): this {
    const pathPoints = options.path_points.map(([x, y]) => [Number(x), Number(y)] as [number, number]);
    if (pathPoints.length < 2) {
      throw new Error("capturePointerTrace requires at least two path points.");
    }
    if (!(Number(options.corridor_width) > 0) || !(Number(options.finish_radius) > 0)) {
      throw new Error("capturePointerTrace requires positive corridor_width and finish_radius.");
    }
    if (!(Number(options.completion_progress) > 0 && Number(options.completion_progress) <= 1)) {
      throw new Error("capturePointerTrace completion_progress must be in (0, 1].");
    }
    this.stage = {
      unit_label: this.label,
      op: "capture_pointer_trace",
      phase: this.pendingContext.phase ?? null,
      onset_trigger: options.onset_trigger ?? null,
      when: this.enabledWhen,
      stim_refs: [...this.stimRefs],
      duration: options.duration,
      pointer_trace_cfg: {
        path_points: pathPoints,
        corridor_width: Number(options.corridor_width),
        transform: options.transform,
        finish_radius: Number(options.finish_radius),
        completion_progress: Number(options.completion_progress),
        start_trigger: options.start_trigger ?? null,
        error_trigger: options.error_trigger ?? null,
        complete_trigger: options.complete_trigger ?? null,
        timeout_trigger: options.timeout_trigger ?? null,
        trail_color: options.trail_color,
        trail_line_width: options.trail_line_width,
        cursor_color: options.cursor_color,
        error_cursor_color: options.error_cursor_color,
        cursor_radius: options.cursor_radius
      },
      context: this.buildContext(options.duration, ["trace"]),
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
      when: this.enabledWhen,
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

  when(predicate: Resolvable<boolean>): this {
    this.enabledWhen = predicate;
    if (this.stage) {
      this.stage.when = predicate;
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
      throw new Error("Cannot export a StimUnit before defining an operation.");
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
