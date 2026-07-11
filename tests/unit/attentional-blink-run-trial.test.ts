import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type RuntimeView, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000058-attentional-blink/src/run_trial";
import { generateAttentionalBlinkPlans, type BlinkCondition } from "../../../H000058-attentional-blink/src/utils";

const triggerMap = { fixation_onset: 20, rsvp_distractor_onset: 30, t1_onset: 31, t2_onset: 32, t2_absent_onset: 33, rsvp_gap_onset: 34, retention_onset: 40, t1_report_onset: 50, t1_response_timeout: 51, t1_response_2: 52, t1_response_3: 53, t1_response_4: 54, t1_response_5: 55, t1_response_6: 56, t1_response_7: 57, t1_response_8: 58, t1_response_9: 59, t2_report_onset: 60, t2_response_0: 61, t2_response_2: 62, t2_response_3: 63, t2_response_4: 64, t2_response_5: 65, t2_response_6: 66, t2_response_7: 67, t2_response_8: 68, t2_response_9: 69, t2_response_timeout: 70, practice_feedback_onset: 80, iti_onset: 90 };

function buildTrial(condition: BlinkCondition = "short_present") {
  const plan = generateAttentionalBlinkPlans({ blockIdx: 0, counts: { [condition]: 1 }, seed: 2026 })[0];
  const settings = TaskSettings.from_dict({
    total_blocks: 1,
    total_trials: 1,
    trial_per_block: 1,
    conditions: [condition],
    t1_keys: ["2", "3", "4", "5", "6", "7", "8", "9"],
    t2_keys: ["0", "2", "3", "4", "5", "6", "7", "8", "9"],
    fixation_duration: 1.78,
    rsvp_item_duration: 0.05,
    rsvp_blank_duration: 0.034,
    post_stream_delay: 1,
    report_window: 5,
    practice_feedback_duration: 0.8,
    iti_duration: 0.2
  }) as TaskSettings & Record<string, unknown>;
  settings.triggers = { map: triggerMap };
  const stimBank = new StimBank({
    fixation: { type: "text", text: "+" },
    blank: { type: "text", text: "" },
    rsvp_character: { type: "text", text: "{character}" },
    t1_report_prompt: { type: "text", text: "T1?" },
    t1_report_options: { type: "text", text: "2-9" },
    t2_report_prompt: { type: "text", text: "T2?" },
    t2_report_options: { type: "text", text: "0,2-9" },
    practice_feedback_both_correct: { type: "text", text: "both" },
    practice_feedback_t1_only: { type: "text", text: "t1" },
    practice_feedback_t2_only: { type: "text", text: "t2" },
    practice_feedback_both_wrong: { type: "text", text: "wrong" }
  });
  const trial = new TrialBuilder({ trial_id: 1, block_id: "block_0", trial_index: 0, condition });
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

describe("H000058 attentional blink", () => {
  it("generates exact canonical condition counts and target lags", () => {
    const plans = generateAttentionalBlinkPlans({ blockIdx: 0, counts: { short_present: 48, long_present: 18, short_absent: 18, long_absent: 18 }, seed: 2026 });
    expect(plans).toHaveLength(102);
    expect(Object.fromEntries(["short_present", "long_present", "short_absent", "long_absent"].map((condition) => [condition, plans.filter((plan) => plan.condition === condition).length]))).toEqual({ short_present: 48, long_present: 18, short_absent: 18, long_absent: 18 });
    plans.forEach((plan) => {
      expect(plan.t2_index - plan.t1_index).toBe(plan.lag);
      expect(plan.stream[plan.t1_index]).toBe(plan.t1);
      expect(plan.stream[plan.t2_index]).toBe(plan.t2_present ? plan.t2 : "");
    });
  });

  it("preserves RSVP phase timing, triggers, response keys, and reduced semantics", () => {
    const { compiled, plan } = buildTrial("short_present");
    expect(compiled.units[0]).toMatchObject({ phase: "fixation", duration: 1.78, onset_trigger: 20 });
    expect(compiled.units.find((unit) => unit.unit_label === `rsvp_item_${String(plan.t1_index + 1).padStart(2, "0")}`)?.onset_trigger).toBe(31);
    expect(compiled.units.find((unit) => unit.unit_label === `rsvp_item_${String(plan.t2_index + 1).padStart(2, "0")}`)?.onset_trigger).toBe(32);
    expect(compiled.units.find((unit) => unit.unit_label === "t1_report")?.response_cfg).toMatchObject({ keys: ["2", "3", "4", "5", "6", "7", "8", "9"], correct_keys: [plan.t1], timeout_trigger: 51 });
    expect(compiled.units.find((unit) => unit.unit_label === "t2_report")?.response_cfg).toMatchObject({ correct_keys: [plan.t2], timeout_trigger: 70 });
    expect(finalize(compiled, { t1_report: { response: plan.t1, rt: 0.5 }, t2_report: { response: plan.t2, rt: 0.7 } })).toMatchObject({ condition_id: plan.condition_id, t1_correct: true, t2_correct: true, t2_correct_given_t1: true, response_correct: true });

    const absent = buildTrial("short_absent");
    expect(finalize(absent.compiled, { t1_report: { response: absent.plan.t1, rt: 0.5 }, t2_report: { response: "0", rt: 0.7 } })).toMatchObject({ t1_correct: true, t2_correct: true, t2_correct_given_t1: true });
  });
});
