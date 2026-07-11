import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type RuntimeView, type TrialSnapshot } from "../../src";
import { CorsiSpanController } from "../../../H000060-corsi-block-tapping-task/src/controller";
import { run_trial } from "../../../H000060-corsi-block-tapping-task/src/run_trial";
import { BLOCK_NAMES, buildPlans, expectedResponse, type TrialPlan } from "../../../H000060-corsi-block-tapping-task/src/utils";

function fixtures() {
  const settings = TaskSettings.from_dict({
    total_blocks: 1,
    total_trials: 1,
    trial_per_block: 1,
    conditions: ["forward"],
    sequence_ready_duration: 0.5,
    flash_duration: 0.5,
    flash_ioi: 1,
    recall_timeout: 30,
    feedback_duration: 0.75,
    iti_duration: 0.5
  }) as TaskSettings & Record<string, unknown>;
  settings.triggers = { map: { sequence_ready: 20, sequence_flash: 21, recall_onset: 30, block_select: 31, recall_complete: 32, recall_timeout: 33, feedback_onset: 40, trial_iti: 50 } };
  const stimuli = Object.fromEntries([
    ...BLOCK_NAMES.map((name, index) => [name, { type: "rect", width: 90, height: 90, pos: [index * 10, 0] }]),
    ...BLOCK_NAMES.map((name, index) => [`active_${name}`, { type: "rect", width: 90, height: 90, pos: [index * 10, 0], fillColor: "yellow" }]),
    ["ready_marker", { type: "circle", radius: 14 }],
    ["feedback_correct", { type: "text", text: "correct" }],
    ["feedback_incorrect", { type: "text", text: "incorrect" }],
    ["blank", { type: "text", text: "" }]
  ]);
  return { settings, stimBank: new StimBank(stimuli as never) };
}

function build(plan: TrialPlan, controller?: CorsiSpanController) {
  const { settings, stimBank } = fixtures();
  const trial = new TrialBuilder({ trial_id: 1, block_id: "forward_scored", trial_index: 0, condition: plan.direction });
  run_trial(trial, plan, { settings, stimBank, controller });
  return trial.build();
}

function finalize(compiled: ReturnType<typeof build>, units: TrialSnapshot["units"]) {
  const state: Record<string, unknown> = { ...compiled.trial_state };
  const snapshot = { trial_id: compiled.trial_id, block_id: compiled.block_id, trial_index: compiled.trial_index, condition: compiled.condition, units, trial_state: state } satisfies TrialSnapshot;
  compiled.finalizers[0](snapshot, { getReducedRows: () => [], sumReducedField: () => 0 } satisfies RuntimeView, {
    setTrialState: (key, value) => { state[key] = value; },
    getUnitState: (label, key) => units[label]?.[key]
  });
  return state;
}

describe("H000060 Corsi block tapping", () => {
  it("generates deterministic no-repeat plans for every candidate level", () => {
    const options = { direction: "forward" as const, seed: 60060, start_length: 2, max_length: 9, attempts_per_length: 2, practice_trials: 3, practice_length: 3 };
    const first = buildPlans(options);
    expect(buildPlans(options)).toEqual(first);
    expect(first).toHaveLength(19);
    first.forEach((plan) => {
      expect(plan.sequence).toHaveLength(plan.sequence_length);
      expect(new Set(plan.sequence).size).toBe(plan.sequence_length);
    });
  });

  it("compiles the canonical timing, marker, and ordered pointer contract", () => {
    const plan = buildPlans({ direction: "forward", seed: 60060, start_length: 2, max_length: 2, attempts_per_length: 2, practice_trials: 0, practice_length: 3 })[0];
    const controller = new CorsiSpanController("forward", 2, 2, 2, 1);
    const compiled = build(plan, controller);
    expect(compiled.units[0]).toMatchObject({ unit_label: "sequence_ready", duration: 0.5, onset_trigger: 20 });
    expect(compiled.units.find((unit) => unit.unit_label === "sequence_flash_01")).toMatchObject({ duration: 0.5, onset_trigger: 21 });
    expect(compiled.units.find((unit) => unit.unit_label === "sequence_gap_01")?.duration).toBe(0.5);
    const finalFlash = compiled.units.find((unit) => unit.unit_label === "sequence_flash_02");
    expect(finalFlash?.stim_refs).toHaveLength(11);
    const recall = compiled.units.find((unit) => unit.unit_label === "recall");
    expect(recall).toMatchObject({ op: "capture_pointer_sequence", duration: 30, onset_trigger: 30 });
    expect(recall?.pointer_cfg).toMatchObject({ max_selections: 2, selection_trigger: 31, complete_trigger: 32, timeout_trigger: 33 });
    expect(Object.keys(recall?.pointer_cfg?.targets ?? {})).toEqual(BLOCK_NAMES);
    const snapshot = { trial_id: 1, block_id: "forward_scored", trial_index: 0, condition: "forward", units: {}, trial_state: {} } satisfies TrialSnapshot;
    expect((recall?.when as (snapshot: TrialSnapshot, runtime: RuntimeView) => boolean)(snapshot, { getReducedRows: () => [], sumReducedField: () => 0 })).toBe(true);
  });

  it("scores forward, backward, timeout, and adaptive advancement exactly", () => {
    const forward = buildPlans({ direction: "forward", seed: 60060, start_length: 2, max_length: 2, attempts_per_length: 2, practice_trials: 0, practice_length: 3 })[0];
    const controller = new CorsiSpanController("forward", 2, 2, 2, 1);
    const first = build(forward, controller);
    expect(finalize(first, { recall: { responses: forward.sequence, response_times: [0.2, 0.4], first_rt: 0.2, rt: 0.4, completed: true } })).toMatchObject({ correct: true, timed_out: false, outcome: "correct", span_after: 0 });
    const secondPlan = { ...forward, attempt_index: 2, condition_id: "forward_len2_attempt2" };
    expect(finalize(build(secondPlan, controller), { recall: { responses: [], response_times: [], first_rt: null, rt: null, completed: false } })).toMatchObject({ correct: false, timed_out: true, outcome: "timeout", span_after: 2 });
    expect(controller.snapshot()).toMatchObject({ span: 2, finished: true, termination_reason: "maximum_span_reached" });

    const backward = { ...forward, direction: "backward" as const, condition_id: "backward_len2_attempt1" };
    const reversed = expectedResponse(backward.sequence, "backward");
    expect(finalize(build(backward, new CorsiSpanController("backward", 2, 2, 2, 1)), { recall: { responses: reversed, completed: true, rt: 0.5 } })).toMatchObject({ correct: true });
  });
});
