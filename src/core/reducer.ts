import type {
  CompiledTrial,
  RawStageRow,
  ReducedTrialRow,
  Resolver,
  Resolvable,
  RuntimeView,
  StateRef,
  TrialSnapshot
} from "./types";
import { createFinalizeHelpers } from "./TrialBuilder";

const RAW_FIELDS = new Set([
  "trial_id",
  "block_id",
  "trial_index",
  "condition",
  "condition_id",
  "unit_label",
  "phase",
  "op",
  "stim_id",
  "deadline_s",
  "valid_keys",
  "onset_time",
  "onset_time_global",
  "close_time",
  "close_time_global",
  "duration",
  "response",
  "key_press",
  "rt",
  "response_time",
  "response_time_global",
  "hit",
  "timeout_triggered",
  "timeout_time",
  "task_factors"
]);

/**
 * Resolve a {@link Resolvable} value: call it if it's a {@link Resolver},
 * look up state if it's a {@link StateRef}, or return it as-is.
 */
export function resolveValue<T>(
  value: Resolvable<T>,
  snapshot: TrialSnapshot,
  runtime: RuntimeView
): T {
  if (typeof value === "function") {
    return (value as Resolver<T>)(snapshot, runtime);
  }
  if (value && typeof value === "object" && "kind" in value && value.kind === "state_ref") {
    const ref = value as StateRef<T>;
    return snapshot.units[ref.unit_label]?.[ref.key] as T;
  }
  return value as T;
}

export function splitRawExtraData(unitState: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(unitState)) {
    if (!RAW_FIELDS.has(key)) {
      extra[key] = value;
    }
  }
  return extra;
}

/**
 * Records trial execution data and produces raw JSONL + reduced CSV output.
 *
 * Implements {@link RuntimeView} so that Resolvers and finalizers can query
 * accumulated results during execution.
 */
export class ExecutionRecorder implements RuntimeView {
  private readonly trialStore = new Map<
    number | string,
    {
      meta: Pick<CompiledTrial, "trial_id" | "block_id" | "trial_index" | "condition">;
      units: Record<string, Record<string, unknown>>;
      trial_state: Record<string, unknown>;
      raw_rows: RawStageRow[];
      exported_units: string[];
    }
  >();

  private readonly reducedRows: ReducedTrialRow[] = [];

  ensureTrial(compiledTrial: CompiledTrial): void {
    if (!this.trialStore.has(compiledTrial.trial_id)) {
      this.trialStore.set(compiledTrial.trial_id, {
        meta: {
          trial_id: compiledTrial.trial_id,
          block_id: compiledTrial.block_id,
          trial_index: compiledTrial.trial_index,
          condition: compiledTrial.condition
        },
        units: {},
        trial_state: { ...compiledTrial.trial_state },
        raw_rows: [],
        exported_units: []
      });
    }
  }

  storeStageResult(
    compiledTrial: CompiledTrial,
    unitLabel: string,
    unitState: Record<string, unknown>,
    rawRow: RawStageRow,
    exportToReduced: boolean
  ): void {
    this.ensureTrial(compiledTrial);
    const store = this.trialStore.get(compiledTrial.trial_id);
    if (!store) {
      throw new Error("Trial store missing.");
    }
    store.units[unitLabel] = { ...(store.units[unitLabel] ?? {}), ...unitState };
    store.raw_rows.push(rawRow);
    if (exportToReduced && !store.exported_units.includes(unitLabel)) {
      store.exported_units.push(unitLabel);
    }
  }

  buildSnapshot(trialId: number | string): TrialSnapshot {
    const store = this.trialStore.get(trialId);
    if (!store) {
      throw new Error(`Trial ${String(trialId)} not found.`);
    }
    return {
      trial_id: store.meta.trial_id,
      block_id: store.meta.block_id,
      trial_index: store.meta.trial_index,
      condition: store.meta.condition,
      units: structuredClone(store.units),
      trial_state: structuredClone(store.trial_state)
    };
  }

  finalizeTrial(compiledTrial: CompiledTrial): ReducedTrialRow {
    this.ensureTrial(compiledTrial);
    const store = this.trialStore.get(compiledTrial.trial_id);
    if (!store) {
      throw new Error("Trial store missing.");
    }
    for (const finalizer of compiledTrial.finalizers) {
      const snapshot = this.buildSnapshot(compiledTrial.trial_id);
      const helpers = createFinalizeHelpers(snapshot, store.trial_state);
      finalizer(snapshot, this, helpers);
    }

    const row: ReducedTrialRow = {
      trial_id: store.meta.trial_id,
      block_id: store.meta.block_id,
      trial_index: store.meta.trial_index,
      condition: store.meta.condition,
      ...store.trial_state
    };

    for (const unitLabel of store.exported_units) {
      const unitState = store.units[unitLabel] ?? {};
      for (const [key, value] of Object.entries(unitState)) {
        row[`${unitLabel}_${key}`] = value;
      }
    }

    this.reducedRows.push(row);
    return row;
  }

  getRawRows(): RawStageRow[] {
    return [...this.trialStore.values()].flatMap((item) => item.raw_rows);
  }

  getReducedRows(): ReducedTrialRow[] {
    return [...this.reducedRows];
  }

  sumReducedField(field: string): number {
    return this.reducedRows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
  }

  toRawJsonl(): string {
    return this.getRawRows()
      .map((row) => JSON.stringify(row))
      .join("\n");
  }
}
