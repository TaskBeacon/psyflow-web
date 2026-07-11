import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type RuntimeView, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000063-navon-global-local-task/src/run_trial";
import {
  generateTrialPlans,
  makeCompoundText,
  makeMaskText,
  type TrialPlan
} from "../../../H000063-navon-global-local-task/src/utils";

function fixtures() {
  const settings = TaskSettings.from_dict({
    h_key: "f",
    s_key: "j",
    fixation_duration: 0.5,
    stimulus_duration: 0.04,
    response_window: 2,
    feedback_duration: 0.5,
    iti_duration: 0.5,
    mask_grid_size: 33
  }) as TaskSettings & Record<string, unknown>;
  settings.triggers = { map: {
    fixation: 20,
    stimulus_global_consistent: 30,
    stimulus_global_neutral: 31,
    stimulus_global_conflicting: 32,
    stimulus_local_consistent: 33,
    stimulus_local_neutral: 34,
    stimulus_local_conflicting: 35,
    mask: 40,
    response_h: 50,
    response_s: 51,
    response_timeout: 52,
    practice_feedback: 60,
    iti: 70
  } };
  const stimuli = Object.fromEntries([
    "fixation", "compound_letter", "mask", "feedback_correct", "feedback_error", "feedback_timeout", "blank"
  ].map((id) => [id, { type: "text", text: id }]));
  return { settings, stimBank: new StimBank(stimuli as never) };
}

function build(plan: TrialPlan) {
  const { settings, stimBank } = fixtures();
  const trial = new TrialBuilder({ trial_id: 1, block_id: "scored_global", trial_index: 0, condition: plan.condition });
  run_trial(trial, plan, { settings, stimBank });
  return trial.build();
}

function finalize(compiled: ReturnType<typeof build>, units: TrialSnapshot["units"]) {
  const state: Record<string, unknown> = { ...compiled.trial_state };
  const snapshot = {
    trial_id: compiled.trial_id,
    block_id: compiled.block_id,
    trial_index: compiled.trial_index,
    condition: compiled.condition,
    units,
    trial_state: state
  } satisfies TrialSnapshot;
  compiled.finalizers[0](snapshot, { getReducedRows: () => [], sumReducedField: () => 0 } satisfies RuntimeView, {
    setTrialState: (key, value) => { state[key] = value; },
    getUnitState: (label, key) => units[label]?.[key]
  });
  return state;
}

describe("H000063 Navon global-local", () => {
  it("generates exact deterministic identity and quadrant balance", () => {
    for (const target_level of ["global", "local"] as const) {
      const options = { target_level, repetitions_per_identity: 6, seed: 63063, block_idx: 0, is_practice: false };
      const plans = generateTrialPlans(options);
      expect(generateTrialPlans(options)).toEqual(plans);
      expect(plans).toHaveLength(36);
      for (const consistency of ["consistent", "neutral", "conflicting"]) {
        expect(plans.filter((plan) => plan.consistency === consistency)).toHaveLength(12);
        for (const letter of ["H", "S"]) {
          expect(plans.filter((plan) => plan.consistency === consistency && plan.attended_letter === letter)).toHaveLength(6);
        }
      }
      for (const position of ["upper_left", "upper_right", "lower_left", "lower_right"]) {
        expect(plans.filter((plan) => plan.position === position)).toHaveLength(9);
      }
    }
  });

  it("renders H, S, rectangular neutral figures and a 33-square mask", () => {
    expect(makeCompoundText("H", "S").split("\n")).toEqual(["S   S", "S   S", "SSSSS", "S   S", "S   S"]);
    expect(makeCompoundText("S", "H").split("\n")).toEqual(["HHHHH", "H", "HHHHH", "    H", "HHHHH"]);
    expect(makeCompoundText("O", "H").split("\n")).toEqual(["HHHHH", "H   H", "H   H", "H   H", "HHHHH"]);
    const mask = makeMaskText(33).split("\n");
    expect(mask).toHaveLength(33);
    expect(mask.every((row) => row.length === 33)).toBe(true);
  });

  it("compiles canonical timing and scores early, masked, error, and timeout responses", () => {
    const plan = generateTrialPlans({ target_level: "global", repetitions_per_identity: 2, seed: 63063, block_idx: 0, is_practice: false })[0];
    const compiled = build(plan);
    expect(compiled.units.find((unit) => unit.unit_label === "fixation")?.duration).toBe(0.5);
    expect(compiled.units.find((unit) => unit.unit_label === "compound_stimulus")).toMatchObject({ op: "capture_response", duration: 0.04 });
    expect(compiled.units.find((unit) => unit.unit_label === "postexposure_mask")).toMatchObject({ op: "capture_response", duration: 1.96 });
    const correct = plan.attended_letter === "H" ? "f" : "j";
    const wrong = correct === "f" ? "j" : "f";
    expect(finalize(compiled, { compound_stimulus: { response: correct, rt: 0.03 } })).toMatchObject({ outcome: "correct", correct: true, response_rt: 0.03 });
    expect(finalize(compiled, { compound_stimulus: { response: null, rt: null }, postexposure_mask: { response: correct, rt: 0.40 } })).toMatchObject({ outcome: "correct", correct: true, response_rt: 0.44 });
    expect(finalize(compiled, { compound_stimulus: { response: null, rt: null }, postexposure_mask: { response: wrong, rt: 0.45 } })).toMatchObject({ outcome: "error", correct: false, response_rt: 0.49 });
    expect(finalize(compiled, { compound_stimulus: { response: null, rt: null }, postexposure_mask: { response: null, rt: null } })).toMatchObject({ outcome: "timeout", omission: true, response_rt: null });
  });
});
