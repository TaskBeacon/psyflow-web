import { describe, expect, it } from "vitest";

import {
  StimBank,
  TaskSettings,
  TrialBuilder,
  type RuntimeView,
  type TrialSnapshot
} from "../../src";
import { run_trial } from "../../../H000076-random-dot-motion-confidence-task/src/run_trial";
import {
  canonicalConfidence,
  decodeCondition
} from "../../../H000076-random-dot-motion-confidence-task/src/utils";

const settings = () => {
  const value = TaskSettings.from_dict({
    total_blocks: 1,
    total_trials: 8,
    trial_per_block: 8,
    conditions: [
      "left_c12_lh",
      "left_c12_hl",
      "left_c28_lh",
      "left_c28_hl",
      "right_c12_lh",
      "right_c12_hl",
      "right_c28_lh",
      "right_c28_hl"
    ],
    direction_keys: { left: "f", right: "j" },
    confidence_keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    confidence_low_label: "猜测",
    confidence_high_label: "非常确定",
    overall_seed: 76076,
    fixation_duration: 0.5,
    motion_response_window: 1.2,
    post_decision_delay: [1.5, 4],
    confidence_response_window: 3,
    direction_timeout_duration: 0.75,
    iti_duration: 0.5
  }) as TaskSettings & Record<string, unknown>;
  value.triggers = {
    fixation: 20,
    motion_left_c12: 31,
    motion_right_c12: 32,
    motion_left_c28: 33,
    motion_right_c28: 34,
    direction_left_response: 40,
    direction_right_response: 41,
    direction_timeout: 42,
    post_decision_blank: 50,
    confidence_low_to_high: 61,
    confidence_high_to_low: 62,
    confidence_response: 63,
    confidence_timeout: 64,
    iti: 70
  };
  return value;
};

const bank = () =>
  new StimBank({
    fixation: { type: "text", text: "+" },
    random_dot_motion: {
      type: "random_dot_motion",
      direction: "left",
      coherence: 0.12,
      n_dots: 150,
      dot_size_deg: 0.1,
      dot_life_frames: 4,
      speed_deg_s: 6,
      aperture_diameter_deg: 6
    },
    blank: { type: "rect", width: 40, height: 30 },
    direction_timeout_message: { type: "text", text: "反应太慢" },
    confidence_prompt: { type: "text", text: "信心？" },
    confidence_scale_line: { type: "rect", width: 14, height: 0.08 },
    confidence_numbers: { type: "text", text: "1 2 3 4 5 6 7 8 9" },
    confidence_left_label: { type: "text", text: "猜测" },
    confidence_right_label: { type: "text", text: "非常确定" }
  });

describe("H000076 random-dot motion + confidence", () => {
  it("decodes all condition factors and canonicalizes reversed confidence", () => {
    expect(decodeCondition("right_c28_hl")).toMatchObject({
      direction: "right",
      coherence: 0.28,
      coherence_percent: 28,
      scale_orientation: "hl"
    });
    expect(canonicalConfidence("8", "lh")).toBe(8);
    expect(canonicalConfidence("2", "hl")).toBe(8);
  });

  it("compiles the canonical phase sequence and random-dot parameters", () => {
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_1",
      trial_index: 0,
      condition: "left_c12_lh"
    });
    run_trial(trial, "left_c12_lh", {
      settings: settings(),
      stimBank: bank(),
      block_id: "block_1",
      block_idx: 0
    });
    const compiled = trial.build();
    expect(compiled.units.map((unit) => unit.unit_label)).toEqual([
      "fixation",
      "motion_decision",
      "post_decision_blank",
      "timeout_message",
      "confidence",
      "iti"
    ]);
    expect(compiled.units[1]).toMatchObject({
      op: "capture_response",
      duration: 1.2,
      onset_trigger: 31
    });
    expect(compiled.units[1].stim_refs[0]).toMatchObject({
      type: "random_dot_motion",
      direction: "left",
      coherence: 0.12,
      n_dots: 150,
      dot_life_frames: 4,
      speed_deg_s: 6,
      aperture_diameter_deg: 6
    });
  });

  it("exports direction and confidence outcomes with canonical meaning", () => {
    const trial = new TrialBuilder({
      trial_id: 2,
      block_id: "block_1",
      trial_index: 1,
      condition: "right_c28_hl"
    });
    run_trial(trial, "right_c28_hl", {
      settings: settings(),
      stimBank: bank(),
      block_id: "block_1",
      block_idx: 0
    });
    const compiled = trial.build();
    const trialState = { ...compiled.trial_state };
    const units = {
      motion_decision: { response: "j", rt: 0.42 },
      confidence: { response: "2", rt: 0.55 }
    };
    const snapshot = {
      trial_id: 2,
      block_id: "block_1",
      trial_index: 1,
      condition: "right_c28_hl",
      units,
      trial_state: trialState
    } satisfies TrialSnapshot;
    const runtime = {
      getReducedRows: () => [],
      sumReducedField: () => 0
    } satisfies RuntimeView;
    compiled.finalizers[0](snapshot, runtime, {
      setTrialState: (key, value) => {
        trialState[key] = value;
      },
      getUnitState: (unit, key) => units[unit as keyof typeof units]?.[key as never]
    });
    expect(trialState).toMatchObject({
      direction_response: "j",
      direction_correct: true,
      confidence_position: 2,
      confidence_rating: 8,
      confidence_timed_out: false,
      outcome: "correct"
    });
  });
});
