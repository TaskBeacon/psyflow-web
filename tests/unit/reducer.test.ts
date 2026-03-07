import { describe, expect, it } from "vitest";

import { ExecutionRecorder, resolveValue } from "../../src/core/reducer";
import { TrialBuilder } from "../../src/core/TrialBuilder";
import type { RawStageRow, TrialSnapshot } from "../../src/core/types";

function makeRawRow(overrides: Partial<RawStageRow>): RawStageRow {
  return {
    trial_id: 1,
    block_id: "block_0",
    trial_index: 0,
    condition: "win",
    condition_id: "win",
    unit_label: "cue",
    phase: null,
    op: "show",
    stim_id: null,
    deadline_s: null,
    valid_keys: null,
    onset_time: 0,
    onset_time_global: 100,
    close_time: 0.12,
    close_time_global: 100.12,
    duration: 0.12,
    response: null,
    key_press: false,
    rt: null,
    response_time: null,
    response_time_global: null,
    hit: null,
    timeout_triggered: false,
    timeout_time: null,
    task_factors: null,
    extra_data: {},
    ...overrides
  };
}

describe("ExecutionRecorder and authoring helpers", () => {
  it("reduces stage data by unit_label instead of phase", () => {
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "win"
    });
    trial.finalize((_snapshot, _runtime, helpers) => {
      helpers.setTrialState("trial_complete", true);
    });
    const compiled = trial.build();
    const recorder = new ExecutionRecorder();

    recorder.storeStageResult(
      compiled,
      "anticipation",
      {
        phase: "anticipation_fixation",
        response: "space",
        early_response: "space",
        hit: true
      },
      makeRawRow({
        unit_label: "anticipation",
        phase: "anticipation_fixation",
        op: "capture_response",
        response: "space",
        key_press: true,
        rt: 0.2,
        response_time: 0.2,
        response_time_global: 100.2,
        hit: true
      }),
      true
    );

    const reduced = recorder.finalizeTrial(compiled);

    expect(reduced.anticipation_phase).toBe("anticipation_fixation");
    expect(reduced.anticipation_early_response).toBe("space");
    expect(reduced).not.toHaveProperty("anticipation_fixation_response");
    expect(reduced.trial_complete).toBe(true);
  });

  it("resolves state refs and resolver functions against trial snapshots", () => {
    const runtime = new ExecutionRecorder();
    const snapshot: TrialSnapshot = {
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "win",
      units: {
        target: {
          response: "space"
        }
      },
      trial_state: {}
    };

    const ref = {
      kind: "state_ref" as const,
      unit_label: "target",
      key: "response"
    };

    expect(resolveValue(ref, snapshot, runtime)).toBe("space");
    expect(resolveValue((row) => Boolean(row.units.target?.response), snapshot, runtime)).toBe(true);
  });
});
