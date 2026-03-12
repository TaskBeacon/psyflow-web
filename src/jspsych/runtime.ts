import CallFunctionPlugin from "@jspsych/plugin-call-function";
import { initJsPsych, type JsPsych } from "jspsych";

import { toCsv } from "../core/csv";
import { ExecutionRecorder, resolveValue, splitRawExtraData } from "../core/reducer";
import { StimBank } from "../core/StimBank";
import type { TaskSettings } from "../core/TaskSettings";
import { resolve_deadline } from "../core/trials";
import type {
  CompiledStage,
  CompiledTrial,
  RawStageRow,
  ReducedTrialRow,
  Resolvable,
  StimRef,
  StimSpec,
  TrialContextSpec,
  TrialSnapshot
} from "../core/types";
import PsyflowStagePlugin, {
  type PsyflowStageResult,
  type ResolvedStageExecution,
  type ResolvedStageStimulus
} from "./PsyflowStagePlugin";
import { PSYFLOW_ABORT_EVENT, type PsyflowAbortDetail } from "./sessionEvents";

export interface PsyflowRunResult {
  jsPsych: JsPsych;
  raw_rows: RawStageRow[];
  reduced_rows: ReducedTrialRow[];
  raw_jsonl: string;
  reduced_csv: string;
  reduced_json: string;
  aborted: boolean;
  abort_reason: string | null;
}

export interface PsyflowRunSession {
  jsPsych: JsPsych;
  abort: (reason?: string) => void;
  forceQuit: (reason?: string) => void;
  isAborted: () => boolean;
  getAbortReason: () => string | null;
}

export interface RunPsyflowExperimentOptions {
  display_element: HTMLElement;
  stimBank: StimBank;
  trials: CompiledTrial[];
  settings?: TaskSettings;
  onResults?: (result: PsyflowRunResult) => void;
  onSessionStart?: (session: PsyflowRunSession) => void;
}

interface ResolvedStageExecutionSkipped {
  skip: true;
}

type TimelineTrial = Record<string, unknown>;

function isSkippedStageExecution(
  execution: ResolvedStageExecution | ResolvedStageExecutionSkipped
): execution is ResolvedStageExecutionSkipped {
  return "skip" in execution && execution.skip;
}

function sampleDuration(value: number | number[] | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return null;
    }
    if (value.length === 1) {
      return Number(value[0]);
    }
    const lower = Number(value[0]);
    const upper = Number(value[1]);
    return lower + Math.random() * (upper - lower);
  }
  return Number(value);
}

function resolveStimulusWithMeta(
  input: Resolvable<StimRef | StimSpec | null>,
  snapshot: TrialSnapshot,
  recorder: ExecutionRecorder,
  stimBank: StimBank
): ResolvedStageStimulus | null {
  const resolved = resolveValue(input, snapshot, recorder);
  if (!resolved) {
    return null;
  }
  if (typeof resolved === "string") {
    return {
      stim_id: resolved,
      spec: stimBank.resolve(resolved)
    };
  }
  if (typeof resolved === "object" && "kind" in resolved && resolved.kind === "stim_ref") {
    return {
      stim_id: resolved.key,
      spec: stimBank.resolve(resolved)
    };
  }
  return {
    stim_id: null,
    spec: structuredClone(resolved as StimSpec)
  };
}

function resolveStageExecution(
  compiledTrial: CompiledTrial,
  stage: CompiledStage,
  recorder: ExecutionRecorder,
  stimBank: StimBank
): ResolvedStageExecution | ResolvedStageExecutionSkipped {
  const snapshot = recorder.buildSnapshot(compiledTrial.trial_id);
  if (stage.when != null && !Boolean(resolveValue(stage.when, snapshot, recorder))) {
    return { skip: true };
  }
  const rawDuration = stage.duration == null ? null : resolveValue(stage.duration, snapshot, recorder);
  const sampledDuration = sampleDuration(rawDuration as number | number[] | null);
  const responseCfg = stage.response_cfg ? structuredClone(stage.response_cfg) : undefined;
  const context: TrialContextSpec = {
    ...(stage.context ?? {})
  };
  if (context.deadline_s == null) {
    context.deadline_s = resolve_deadline(sampledDuration);
  }
  if (context.valid_keys == null && responseCfg?.keys) {
    context.valid_keys = [...responseCfg.keys];
  }
  const stimuli = stage.stim_refs
    .map((stim) => resolveStimulusWithMeta(stim, snapshot, recorder, stimBank))
    .filter((stimulus): stimulus is ResolvedStageStimulus => stimulus !== null);
  return {
    context,
    duration: sampledDuration,
    min_wait: stage.min_wait ?? 0,
    response_cfg: responseCfg,
    stimuli
  };
}

function shouldFinalizeTrial(compiledTrial: CompiledTrial): boolean {
  return (
    compiledTrial.finalizers.length > 0 ||
    compiledTrial.units.some((unit) => unit.export_to_reduced) ||
    Object.keys(compiledTrial.trial_state).length > 0
  );
}

function toUnitState(
  compiledTrial: CompiledTrial,
  stage: CompiledStage,
  resolvedStage: ResolvedStageExecution,
  result: PsyflowStageResult,
  recorder: ExecutionRecorder
): { unitState: Record<string, unknown>; rawRow: RawStageRow } {
  const phase = resolvedStage.context.phase ?? stage.phase ?? null;
  const conditionId = resolvedStage.context.condition_id ?? compiledTrial.condition;
  const stimId = resolvedStage.context.stim_id ?? result.resolved_stim_id ?? null;
  const validKeys = resolvedStage.context.valid_keys ? [...resolvedStage.context.valid_keys] : null;
  const taskFactors = resolvedStage.context.task_factors
    ? structuredClone(resolvedStage.context.task_factors)
    : null;
  const baseUnitState: Record<string, unknown> = {
    trial_id: compiledTrial.trial_id,
    block_id: resolvedStage.context.block_id ?? compiledTrial.block_id,
    condition_id: conditionId,
    phase,
    op: stage.op,
    stim_id: stimId,
    deadline_s: result.resolved_deadline_s,
    valid_keys: validKeys,
    onset_time: result.onset_time,
    onset_time_global: result.onset_time_global,
    close_time: result.close_time,
    close_time_global: result.close_time_global,
    duration: result.duration,
    response: result.response,
    key_press: result.key_press,
    rt: result.rt,
    response_time: result.response_time,
    response_time_global: result.response_time_global,
    hit: result.hit,
    timeout_triggered: result.timeout_triggered,
    timeout_time: result.timeout_time,
    task_factors: taskFactors
  };
  if (resolvedStage.context.stim_features != null) {
    baseUnitState.stim_features = structuredClone(resolvedStage.context.stim_features);
  }

  if (stage.state_patch && Object.keys(stage.state_patch).length > 0) {
    const snapshotBefore = recorder.buildSnapshot(compiledTrial.trial_id);
    const temporaryUnitState = { ...baseUnitState };
    const temporarySnapshot: TrialSnapshot = {
      ...snapshotBefore,
      units: {
        ...snapshotBefore.units,
        [stage.unit_label]: temporaryUnitState
      }
    };
    for (const [key, value] of Object.entries(stage.state_patch)) {
      const resolvedValue = resolveValue(value, temporarySnapshot, recorder);
      temporaryUnitState[key] = resolvedValue;
      temporarySnapshot.units[stage.unit_label] = { ...temporaryUnitState };
    }
    Object.assign(baseUnitState, temporaryUnitState);
  }

  const rawRow: RawStageRow = {
    trial_id: compiledTrial.trial_id,
    block_id: (baseUnitState.block_id as string | null | undefined) ?? compiledTrial.block_id,
    trial_index: compiledTrial.trial_index,
    condition: compiledTrial.condition,
    condition_id: conditionId,
    unit_label: stage.unit_label,
    phase,
    op: stage.op,
    stim_id: stimId,
    deadline_s: result.resolved_deadline_s,
    valid_keys: validKeys,
    onset_time: result.onset_time,
    onset_time_global: result.onset_time_global,
    close_time: result.close_time,
    close_time_global: result.close_time_global,
    duration: result.duration,
    response: result.response,
    key_press: result.key_press,
    rt: result.rt,
    response_time: result.response_time,
    response_time_global: result.response_time_global,
    hit: result.hit,
    timeout_triggered: result.timeout_triggered,
    timeout_time: result.timeout_time,
    task_factors: taskFactors,
    extra_data: {}
  };
  rawRow.extra_data = splitRawExtraData(baseUnitState);
  return {
    unitState: baseUnitState,
    rawRow
  };
}

function buildTimeline(
  trials: CompiledTrial[],
  recorder: ExecutionRecorder,
  stimBank: StimBank
): TimelineTrial[] {
  const timeline: TimelineTrial[] = [];
  for (const compiledTrial of trials) {
    for (const stage of compiledTrial.units) {
      let resolvedStageCache: ResolvedStageExecution | ResolvedStageExecutionSkipped | null = null;
      timeline.push({
        type: PsyflowStagePlugin,
        stage,
        resolve_stage: () => {
          resolvedStageCache = resolveStageExecution(compiledTrial, stage, recorder, stimBank);
          return resolvedStageCache;
        },
        on_finish: (data: PsyflowStageResult) => {
          const resolvedStage =
            resolvedStageCache ?? resolveStageExecution(compiledTrial, stage, recorder, stimBank);
          if (isSkippedStageExecution(resolvedStage)) {
            resolvedStageCache = null;
            return;
          }
          const execution: ResolvedStageExecution = resolvedStage;
          const { unitState, rawRow } = toUnitState(compiledTrial, stage, execution, data, recorder);
          recorder.storeStageResult(compiledTrial, stage.unit_label, unitState, rawRow, stage.export_to_reduced);
          resolvedStageCache = null;
        }
      });
    }
    if (shouldFinalizeTrial(compiledTrial)) {
      timeline.push({
        type: CallFunctionPlugin,
        func: () => recorder.finalizeTrial(compiledTrial),
        record_data: false
      });
    }
  }
  return timeline;
}

function buildResult(
  jsPsych: JsPsych,
  recorder: ExecutionRecorder,
  sessionState: { aborted: boolean; abort_reason: string | null }
): PsyflowRunResult {
  const reducedRows = recorder.getReducedRows();
  return {
    jsPsych,
    raw_rows: recorder.getRawRows(),
    reduced_rows: reducedRows,
    raw_jsonl: recorder.toRawJsonl(),
    reduced_csv: toCsv(reducedRows),
    reduced_json: JSON.stringify(reducedRows, null, 2),
    aborted: sessionState.aborted,
    abort_reason: sessionState.abort_reason
  };
}

export async function runPsyflowExperiment(
  options: RunPsyflowExperimentOptions
): Promise<PsyflowRunResult> {
  const { display_element, stimBank, trials, settings, onResults, onSessionStart } = options;
  display_element.innerHTML = "";
  display_element.classList.add("psyflow-runtime-root");
  if (typeof settings?.bg_color === "string") {
    display_element.style.background = settings.bg_color;
  }
  if (typeof settings?.units === "string") {
    display_element.dataset.psyflowDefaultUnits = settings.units;
  }
  if (Number.isFinite(Number(settings?.monitor_width_cm))) {
    display_element.dataset.psyflowMonitorWidthCm = String(Number(settings?.monitor_width_cm));
  }
  if (Number.isFinite(Number(settings?.monitor_distance_cm))) {
    display_element.dataset.psyflowMonitorDistanceCm = String(Number(settings?.monitor_distance_cm));
  }
  if (Array.isArray(settings?.size) && Number.isFinite(Number(settings.size[0]))) {
    display_element.dataset.psyflowConfigWidthPx = String(Number(settings.size[0]));
  }

  const recorder = new ExecutionRecorder();
  for (const compiledTrial of trials) {
    recorder.ensureTrial(compiledTrial);
  }

  const jsPsych = initJsPsych({
    display_element
  });
  const sessionState = {
    aborted: false,
    abort_reason: null as string | null
  };
  const abort = (reason = "aborted") => {
    if (sessionState.aborted) {
      return;
    }
    sessionState.aborted = true;
    sessionState.abort_reason = reason;
    display_element.dispatchEvent(
      new CustomEvent<PsyflowAbortDetail>(PSYFLOW_ABORT_EVENT, {
        detail: { reason }
      })
    );
    jsPsych.abortExperiment();
  };
  const session: PsyflowRunSession = {
    jsPsych,
    abort,
    forceQuit: abort,
    isAborted: () => sessionState.aborted,
    getAbortReason: () => sessionState.abort_reason
  };
  onSessionStart?.(session);
  const timeline = buildTimeline(trials, recorder, stimBank);
  await jsPsych.run(timeline as Parameters<JsPsych["run"]>[0]);
  const result = buildResult(jsPsych, recorder, sessionState);
  onResults?.(result);
  return result;
}
