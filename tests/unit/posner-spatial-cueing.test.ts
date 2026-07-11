import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type RuntimeView, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000061-posner-spatial-cueing-task/src/run_trial";
import { generateTrialPlans, type TrialPlan } from "../../../H000061-posner-spatial-cueing-task/src/utils";

function fixtures() {
  const settings = TaskSettings.from_dict({
    response_key: "space",
    cue_duration: 0.1,
    target_duration: 0.1,
    response_window: 1,
    trial_onset_interval: 2,
    feedback_duration: 0.5
  }) as TaskSettings & Record<string, unknown>;
  settings.triggers = { map: { cue_valid: 20, cue_invalid: 21, cue_neutral: 22, cue_no_cue: 23, cue_catch: 24, cue_target_interval: 30, target_left: 40, target_right: 41, catch_window: 42, target_response: 50, false_alarm: 51, response_timeout: 52, practice_feedback: 60, iti: 70 } };
  const ids = [
    "center_left", "center_right", "box_left", "box_right", "fixation", "cue_left", "cue_right",
    "target_circle_left", "target_circle_right", "target_diamond_left", "target_diamond_right",
    "feedback_correct", "feedback_incorrect"
  ];
  const stimuli = Object.fromEntries(ids.map((id) => [id, { type: "text", text: id }]));
  return { settings, stimBank: new StimBank(stimuli as never) };
}

function build(plan: TrialPlan) {
  const { settings, stimBank } = fixtures();
  const trial = new TrialBuilder({ trial_id: 1, block_id: "block_1", trial_index: 0, condition: plan.condition });
  run_trial(trial, plan, { settings, stimBank });
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

describe("H000061 Posner spatial cueing", () => {
  it("generates exact deterministic balanced condition plans", () => {
    const options = {
      block_idx: 0,
      condition_counts: { valid: 32, invalid: 8, neutral: 8, no_cue: 8, catch: 4 },
      seed: 61061,
      cue_target_intervals: [0.4, 0.7]
    };
    const plans = generateTrialPlans(options);
    expect(generateTrialPlans(options)).toEqual(plans);
    expect(plans).toHaveLength(60);
    expect(Object.fromEntries(["valid", "invalid", "neutral", "no_cue", "catch"].map((condition) => [condition, plans.filter((plan) => plan.condition === condition).length]))).toEqual({ valid: 32, invalid: 8, neutral: 8, no_cue: 8, catch: 4 });
    expect(new Set(plans.map((plan) => plan.cue_target_interval))).toEqual(new Set([0.4, 0.7]));
    expect(plans.filter((plan) => plan.condition === "valid").every((plan) => plan.cue_side === plan.target_side)).toBe(true);
    expect(plans.filter((plan) => plan.condition === "invalid").every((plan) => plan.cue_side !== plan.target_side)).toBe(true);
    expect(plans.filter((plan) => plan.condition === "catch").every((plan) => !plan.target_present && plan.target_side == null)).toBe(true);
  });

  it("compiles the split target response window and fixed cue-onset interval", () => {
    const plan = generateTrialPlans({ block_idx: 0, condition_counts: { valid: 1 }, seed: 61061, cue_target_intervals: [0.4, 0.7] })[0];
    const compiled = build(plan);
    expect(compiled.units.find((unit) => unit.unit_label === "cue")).toMatchObject({ duration: 0.1, onset_trigger: 20 });
    expect(compiled.units.find((unit) => unit.unit_label === "cue_target_interval")?.duration).toBeCloseTo(plan.cue_target_interval - 0.1);
    const target = compiled.units.find((unit) => unit.unit_label === "target");
    expect(target).toMatchObject({ op: "capture_response", duration: 0.1 });
    expect(target?.response_cfg).toMatchObject({ terminate_on_response: false });
    const postTarget = compiled.units.find((unit) => unit.unit_label === "post_target_response");
    expect(postTarget).toMatchObject({ op: "capture_response", duration: 0.9 });
    expect(postTarget?.response_cfg).toMatchObject({ terminate_on_response: false });
    expect(compiled.units.find((unit) => unit.unit_label === "post_target_hold")).toMatchObject({ op: "show", duration: 0.9 });
    expect(compiled.units.find((unit) => unit.unit_label === "iti")?.duration).toBeCloseTo(1 - plan.cue_target_interval);
  });

  it("scores early hit, late hit, omission, false alarm, and correct rejection", () => {
    const targetPlan = generateTrialPlans({ block_idx: 0, condition_counts: { valid: 1 }, seed: 61061, cue_target_intervals: [0.4, 0.7] })[0];
    expect(finalize(build(targetPlan), { target: { response: "space", rt: 0.08 } })).toMatchObject({ outcome: "hit", correct: true, response_rt: 0.08 });
    const lateHit = finalize(build(targetPlan), { target: { response: null, rt: null }, post_target_response: { response: "space", rt: 0.2 } });
    expect(lateHit).toMatchObject({ outcome: "hit", correct: true });
    expect(lateHit.response_rt).toBeCloseTo(0.3);
    expect(finalize(build(targetPlan), { target: { response: null, rt: null }, post_target_response: { response: null, rt: null } })).toMatchObject({ outcome: "omission", correct: false, omission: true });

    const catchPlan = generateTrialPlans({ block_idx: 0, condition_counts: { catch: 1 }, seed: 61061, cue_target_intervals: [0.4, 0.7] })[0];
    expect(finalize(build(catchPlan), { catch_response_window: { response: "space", rt: 0.4 } })).toMatchObject({ outcome: "false_alarm", correct: false, false_alarm: true, response_rt: 0.4 });
    expect(finalize(build(catchPlan), { catch_response_window: { response: null, rt: null } })).toMatchObject({ outcome: "correct_rejection", correct: true, response_rt: null });
  });
});
