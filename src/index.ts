/**
 * psyflow-web — browser runtime for auditable psychology experiments.
 *
 * **For task authors**: use {@link TaskSettings}, {@link BlockUnit}, {@link StimBank},
 * {@link StimUnit}, {@link TrialBuilder}, and {@link SubInfo} to define trials.
 *
 * **For runtime consumers**: use {@link runPsyflowExperiment} or {@link mountTaskApp}.
 *
 * @module
 */

export { parsePsyflowConfig } from "./core/config";
export { TaskSettings } from "./core/TaskSettings";
export { BlockUnit } from "./core/BlockUnit";
export { StimBank } from "./core/StimBank";
export { StimUnit, set_trial_context } from "./core/StimUnit";
export { SubInfo } from "./core/SubInfo";
export { next_trial_id, reset_trial_counter, resolve_deadline } from "./core/trials";
export { TrialBuilder } from "./core/TrialBuilder";
export { ExecutionRecorder, resolveValue } from "./core/reducer";
export { toCsv } from "./core/csv";
export { count_down } from "./core/display";
export type { CountDownOptions } from "./core/display";
export { runPsyflowExperiment } from "./jspsych/runtime";
export { default as PsyflowStagePlugin } from "./jspsych/PsyflowStagePlugin";
export { mountTaskApp } from "./app/TaskApp";
export type {
  CompiledStage,
  CompiledTrial,
  ParsedConfig,
  RawStageRow,
  ReducedTrialRow,
  ResponseConfig,
  Resolvable,
  RuntimeView,
  StateRef,
  StimRef,
  StimSpec,
  TrialContextSpec,
  TrialSnapshot
} from "./core/types";
export type { PsyflowRunResult, RunPsyflowExperimentOptions } from "./jspsych/runtime";
export type { PsyflowRunSession } from "./jspsych/runtime";
export type { MountTaskAppOptions } from "./app/TaskApp";
export type {
  PsyflowStageResult,
  ResolvedStageExecution,
  ResolvedStageStimulus
} from "./jspsych/PsyflowStagePlugin";
export { PSYFLOW_ABORT_EVENT } from "./jspsych/sessionEvents";
