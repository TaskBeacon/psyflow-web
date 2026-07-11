import { describe, expect, it } from "vitest";
import { StimBank, TaskSettings, TrialBuilder, type RuntimeView, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000064-sustained-attention-to-response-task/src/run_trial";
import { generateTrialPlans, type TrialPlan } from "../../../H000064-sustained-attention-to-response-task/src/utils";

function build(plan: TrialPlan) {
  const settings = TaskSettings.from_dict({ response_key: "space", digit_duration: 0.25, mask_duration: 0.9 }) as TaskSettings & Record<string, unknown>;
  settings.triggers = { map: { digit_go: 20, digit_no_go: 21, mask: 30, go_response: 40, commission_error: 41, omission_error: 42 } };
  const stimuli = Object.fromEntries(["digit", "mask_ring", "mask_bar_forward", "mask_bar_backward"].map((id) => [id, { type: "text", text: id }]));
  const trial = new TrialBuilder({ trial_id: 1, block_id: "scored", trial_index: 0, condition: plan.condition });
  run_trial(trial, plan, { settings, stimBank: new StimBank(stimuli as never) }); return trial.build();
}
function finalize(compiled: ReturnType<typeof build>, units: TrialSnapshot["units"]) {
  const state: Record<string, unknown> = { ...compiled.trial_state };
  const snapshot = { trial_id: compiled.trial_id, block_id: compiled.block_id, trial_index: compiled.trial_index, condition: compiled.condition, units, trial_state: state } satisfies TrialSnapshot;
  compiled.finalizers[0](snapshot, { getReducedRows: () => [], sumReducedField: () => 0 } satisfies RuntimeView, { setTrialState: (key, value) => { state[key] = value; }, getUnitState: (label, key) => units[label]?.[key] }); return state;
}

describe("H000064 SART", () => {
  it("balances every digit and size exactly", () => {
    const plans = generateTrialPlans({ repetitions_per_digit: 25, seed: 64064, block_idx: 0, is_practice: false });
    expect(plans).toHaveLength(225);
    for (let digit = 1; digit <= 9; digit += 1) {
      expect(plans.filter((p) => p.digit === digit)).toHaveLength(25);
      for (const size of [48, 72, 94, 100, 120]) expect(plans.filter((p) => p.digit === digit && p.font_points === size)).toHaveLength(5);
    }
    expect(plans.filter((p) => p.condition === "no_go")).toHaveLength(25);
  });
  it("compiles fixed timing and four outcomes", () => {
    const plans = generateTrialPlans({ repetitions_per_digit: 2, seed: 64064, block_idx: 0, is_practice: false });
    const go = plans.find((p) => p.condition === "go")!; const noGo = plans.find((p) => p.condition === "no_go")!;
    const compiled = build(go);
    expect(compiled.units.find((u) => u.unit_label === "digit")).toMatchObject({ duration: 0.25, op: "capture_response" });
    expect(compiled.units.find((u) => u.unit_label === "mask_response")).toMatchObject({ duration: 0.9, op: "capture_response" });
    expect(finalize(build(go), { digit: { response: "space", rt: 0.2 } })).toMatchObject({ outcome: "hit", response_rt: 0.2 });
    expect(finalize(build(go), { digit: { response: null, rt: null }, mask_response: { response: null, rt: null } })).toMatchObject({ outcome: "omission", omission: true });
    expect(finalize(build(noGo), { digit: { response: null, rt: null }, mask_response: { response: "space", rt: 0.3 } })).toMatchObject({ outcome: "false_alarm", response_rt: 0.55 });
    expect(finalize(build(noGo), { digit: { response: null, rt: null }, mask_response: { response: null, rt: null } })).toMatchObject({ outcome: "correct_rejection", correct: true });
  });
});
