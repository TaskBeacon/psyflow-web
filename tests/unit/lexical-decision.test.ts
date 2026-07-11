import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, parseCsvRows, type RuntimeView, type TrialSnapshot } from "../../src";
import stimuliText from "../../../H000062-lexical-decision-task/assets/stimuli.csv?raw";
import { run_trial } from "../../../H000062-lexical-decision-task/src/run_trial";
import { generateTrialBlocks, type StimulusRow, type TrialPlan } from "../../../H000062-lexical-decision-task/src/utils";

function fixtures() {
  const settings = TaskSettings.from_dict({
    word_key: "f",
    nonword_key: "j",
    display_case: "upper",
    fixation_duration: 0.5,
    response_window: 2,
    error_feedback_duration: 0.75,
    iti_duration: 0.15
  }) as TaskSettings & Record<string, unknown>;
  settings.triggers = { map: { fixation: 20, stimulus_high_frequency_word: 30, stimulus_low_frequency_word: 31, stimulus_pseudoword: 32, word_response: 40, nonword_response: 41, response_timeout: 42, error_feedback: 50, iti: 60 } };
  const stimuli = {
    fixation: { type: "text", text: "+" },
    letter_string: { type: "text", text: "{letter_string}" },
    feedback_error: { type: "text", text: "ERROR" },
    blank: { type: "text", text: "" }
  };
  return { settings, stimBank: new StimBank(stimuli as never) };
}

function generated() {
  return generateTrialBlocks({
    pool: parseCsvRows<StimulusRow>(stimuliText),
    block_counts: [
      { high_frequency_word: 8, low_frequency_word: 7, pseudoword: 15 },
      { high_frequency_word: 7, low_frequency_word: 8, pseudoword: 15 },
      { high_frequency_word: 8, low_frequency_word: 7, pseudoword: 15 },
      { high_frequency_word: 7, low_frequency_word: 8, pseudoword: 15 }
    ],
    practice_trials: 30,
    seed: 62062
  });
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

describe("H000062 Lexical Decision", () => {
  it("parses and schedules the canonical pool with exact no-repeat counts", () => {
    const first = generated();
    expect(generated()).toEqual(first);
    expect(first.practice).toHaveLength(30);
    expect(first.practice.filter((plan) => plan.lexicality === "word")).toHaveLength(15);
    const scored = first.blocks.flat();
    expect(scored).toHaveLength(120);
    expect(new Set(scored.map((plan) => plan.item_id)).size).toBe(120);
    expect(scored.filter((plan) => plan.condition === "high_frequency_word")).toHaveLength(30);
    expect(scored.filter((plan) => plan.condition === "low_frequency_word")).toHaveLength(30);
    expect(scored.filter((plan) => plan.condition === "pseudoword")).toHaveLength(60);
    expect(first.blocks.map((block) => block.filter((plan) => plan.lexicality === "word").length)).toEqual([15, 15, 15, 15]);
  });

  it("compiles the source-aligned timing, response mapping, and conditional error stage", () => {
    const plan = generated().blocks.flat().find((candidate) => candidate.condition === "pseudoword")!;
    const compiled = build(plan);
    expect(compiled.units.find((unit) => unit.unit_label === "fixation")).toMatchObject({ op: "show", duration: 0.5, onset_trigger: 20 });
    const decision = compiled.units.find((unit) => unit.unit_label === "lexical_decision");
    expect(decision).toMatchObject({ op: "capture_response", duration: 2, onset_trigger: 32 });
    expect(decision?.response_cfg).toMatchObject({ keys: ["f", "j"], correct_keys: ["j"], terminate_on_response: true });
    expect(compiled.units.find((unit) => unit.unit_label === "error_feedback")).toMatchObject({ op: "show", duration: 0.75, onset_trigger: 50 });
    expect(compiled.units.find((unit) => unit.unit_label === "iti")).toMatchObject({ op: "show", duration: 0.15, onset_trigger: 60 });
  });

  it("scores correct, wrong-key, and timeout outcomes and gates ERROR correctly", () => {
    const plan = generated().blocks.flat().find((candidate) => candidate.condition === "high_frequency_word")!;
    const compiled = build(plan);
    expect(finalize(compiled, { lexical_decision: { response: "f", rt: 0.55 } })).toMatchObject({ correct: true, outcome: "correct", response_rt: 0.55 });
    expect(finalize(compiled, { lexical_decision: { response: "j", rt: 0.62 } })).toMatchObject({ correct: false, outcome: "error", response_rt: 0.62 });
    expect(finalize(compiled, { lexical_decision: { response: null, rt: null } })).toMatchObject({ correct: false, outcome: "timeout", response_rt: null });
    const errorUnit = compiled.units.find((unit) => unit.unit_label === "error_feedback")!;
    const runtime = { getReducedRows: () => [], sumReducedField: () => 0 } satisfies RuntimeView;
    const snapshot = (key: string | null) => ({ trial_id: 1, block_id: "block_1", trial_index: 0, condition: plan.condition, units: { lexical_decision: { response: key } }, trial_state: {} }) satisfies TrialSnapshot;
    expect((errorUnit.when as (value: TrialSnapshot, runtime: RuntimeView) => boolean)(snapshot("j"), runtime)).toBe(true);
    expect((errorUnit.when as (value: TrialSnapshot, runtime: RuntimeView) => boolean)(snapshot("f"), runtime)).toBe(false);
    expect((errorUnit.when as (value: TrialSnapshot, runtime: RuntimeView) => boolean)(snapshot(null), runtime)).toBe(false);
  });
});
