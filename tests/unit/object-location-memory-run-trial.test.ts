import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type RuntimeView, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000059-object-location-memory/src/run_trial";
import { POSITION_KEYS, generateTrialPlans, type EncodingCondition } from "../../../H000059-object-location-memory/src/utils";

const triggerMap = { fixation_onset: 20, study_onset: 30, retention_onset: 40, assignment_onset: 50, response_1: 61, response_2: 62, response_3: 63, response_4: 64, response_5: 65, response_6: 66, response_7: 67, response_8: 68, response_9: 69, response_0: 70, response_timeout: 79, practice_feedback_onset: 80, iti_onset: 90 };

function buildTrial(condition: EncodingCondition = "silent") {
  const plan = generateTrialPlans({ condition, count: 1, seed: 2026, blockIdx: condition === "silent" ? 1 : 0 })[0];
  const settings = TaskSettings.from_dict({
    total_blocks: 1,
    total_trials: 1,
    trial_per_block: 1,
    conditions: [condition],
    fixation_duration: 0.5,
    study_duration: 30,
    retention_duration: 0.5,
    assignment_window: 10,
    practice_feedback_duration: 1.5,
    iti_duration: 0.5
  }) as TaskSettings & Record<string, unknown>;
  settings.triggers = { map: triggerMap };
  const stimBank = new StimBank({
    fixation: { type: "text", text: "+" },
    blank: { type: "text", text: "" },
    study_suppression: { type: "text", text: "BLAH\n{study_grid}" },
    study_silent: { type: "text", text: "SILENT\n{study_grid}" },
    recall_display: { type: "text", text: "{object_name} {query_number}\n{marker_grid}" },
    practice_feedback: { type: "text", text: "{correct_assignments}/{assignment_count}" }
  });
  const trial = new TrialBuilder({ trial_id: 1, block_id: `block_${condition}`, trial_index: 0, condition });
  run_trial(trial, plan, { settings, stimBank });
  return { compiled: trial.build(), plan };
}

function finalize(compiled: ReturnType<typeof buildTrial>["compiled"], units: TrialSnapshot["units"]) {
  const state: Record<string, unknown> = { ...compiled.trial_state };
  const snapshot = { trial_id: compiled.trial_id, block_id: compiled.block_id, trial_index: compiled.trial_index, condition: compiled.condition, units, trial_state: state } satisfies TrialSnapshot;
  compiled.finalizers[0](snapshot, { getReducedRows: () => [], sumReducedField: () => 0 } satisfies RuntimeView, {
    setTrialState: (key, value) => { state[key] = value; },
    getUnitState: (label, key) => units[label]?.[key]
  });
  return state;
}

describe("H000059 object-location memory", () => {
  it("generates unique ten-object, ten-position assignment plans", () => {
    (["suppression", "silent"] as EncodingCondition[]).forEach((condition, blockIdx) => {
      const plans = generateTrialPlans({ condition, count: 20, seed: 2026, blockIdx });
      plans.forEach((plan) => {
        expect(plan.assignments).toHaveLength(10);
        expect(new Set(plan.assignments.map((item) => item.object_name)).size).toBe(10);
        expect(new Set(plan.assignments.map((item) => item.grid_index)).size).toBe(10);
        expect(new Set(plan.assignments.map((item) => item.correct_key)).size).toBe(10);
        expect(new Set(plan.assignments.map((item) => item.correct_key)).size).toBe(POSITION_KEYS.length);
        expect([...plan.query_order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(plan.study_grid.split("\n")).toHaveLength(9);
      });
    });
  });

  it("preserves phase timing, triggers, response keys, and mislocation scoring", () => {
    const { compiled, plan } = buildTrial("silent");
    expect(compiled.units.find((unit) => unit.unit_label === "fixation")).toMatchObject({ duration: 0.5, onset_trigger: 20 });
    expect(compiled.units.find((unit) => unit.unit_label === "study")).toMatchObject({ duration: 30, onset_trigger: 30 });
    expect(compiled.units.find((unit) => unit.unit_label === "retention")).toMatchObject({ duration: 0.5, onset_trigger: 40 });
    const first = compiled.units.find((unit) => unit.unit_label === "assignment_01");
    expect(first).toMatchObject({ duration: 10, onset_trigger: 50 });
    expect(first?.response_cfg).toMatchObject({ keys: [...POSITION_KEYS], correct_keys: [plan.assignments[plan.query_order[0]].correct_key], timeout_trigger: 79 });

    const units: TrialSnapshot["units"] = {};
    plan.query_order.forEach((assignmentIndex, queryIndex) => {
      const correct = plan.assignments[assignmentIndex].correct_key;
      units[`assignment_${String(queryIndex + 1).padStart(2, "0")}`] = {
        response: queryIndex === 0 ? (POSITION_KEYS.find((key) => key !== correct) ?? "0") : correct,
        rt: 0.5 + queryIndex * 0.01
      };
    });
    expect(finalize(compiled, units)).toMatchObject({
      assignment_count: 10,
      answered_assignments: 10,
      correct_assignments: 9,
      assignment_accuracy: 0.9,
      mislocated_percentage: 10,
      response_correct: false
    });
  });
});
