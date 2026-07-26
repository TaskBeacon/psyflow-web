import { describe, expect, it } from "vitest";

import {
  StimBank,
  TaskSettings,
  TrialBuilder,
  type RuntimeView,
  type TrialSnapshot
} from "../../src";
import { run_trial } from "../../../H000073-gaze-cueing-task/src/run_trial";
import { plans } from "../../../H000073-gaze-cueing-task/src/utils";

describe("H000073 gaze cueing", () => {
  it("preserves the canonical practice and scored factorial plans", () => {
    const practice = plans({ practice: true, seed: 73073 });
    const scored = plans({
      practice: false,
      seed: 73073,
      repetitionsPerCell: 2
    });
    expect(practice).toHaveLength(6);
    expect(scored).toHaveLength(48);
    for (const validity of ["congruent", "incongruent"]) {
      for (const soaMs of [100, 300, 700]) {
        const cell = scored.filter(
          (plan) => plan.validity === validity && plan.soa_ms === soaMs
        );
        expect(cell).toHaveLength(8);
        expect(cell.filter((plan) => plan.target_side === "left")).toHaveLength(
          4
        );
        expect(cell.filter((plan) => plan.target_letter === "T")).toHaveLength(
          4
        );
      }
    }
    expect(
      scored.every((plan) =>
        plan.validity === "congruent"
          ? plan.gaze_direction === plan.target_side
          : plan.gaze_direction !== plan.target_side
      )
    ).toBeTruthy();
  });

  it("compiles canonical phases, timings, triggers, and outcomes", () => {
    const plan = plans({ practice: true, seed: 73073 }).find(
      (item) => item.soa_ms === 300
    )!;
    const settings = TaskSettings.from_dict({
      total_blocks: 2,
      total_trials: 54,
      trial_per_block: 27,
      conditions: [
        "congruent_soa100",
        "incongruent_soa100",
        "congruent_soa300",
        "incongruent_soa300",
        "congruent_soa700",
        "incongruent_soa700"
      ],
      fixation_duration: 0.675,
      face_preview_duration: 0.9,
      response_window: 3.8,
      feedback_duration: 0.675
    }) as TaskSettings & Record<string, unknown>;
    settings.triggers = {
      map: {
        fixation: 20,
        face_preview: 21,
        gaze_left_300: 32,
        gaze_right_300: 33,
        target_congruent_left: 40,
        target_congruent_right: 41,
        target_incongruent_left: 42,
        target_incongruent_right: 43,
        response_t: 50,
        response_l: 51,
        timeout: 52,
        feedback: 60
      }
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "*" },
      face_blank: { type: "image", image: "face_blank.png" },
      face_left: { type: "image", image: "face_left.png" },
      face_right: { type: "image", image: "face_right.png" },
      target: { type: "text", text: "T", pos: [-6, 0] },
      feedback_correct: { type: "text", text: "+" },
      feedback_incorrect: { type: "text", text: "-" }
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "practice",
      trial_index: 0,
      condition: plan.condition
    });
    run_trial(trial, plan, { settings, stimBank });
    const compiled = trial.build();
    expect(compiled.units.map((unit) => unit.unit_label)).toEqual([
      "fixation",
      "face_preview",
      "gaze_cue",
      "target",
      "feedback"
    ]);
    expect(compiled.units.find((unit) => unit.unit_label === "fixation"))
      .toMatchObject({ duration: 0.675 });
    expect(compiled.units.find((unit) => unit.unit_label === "face_preview"))
      .toMatchObject({ duration: 0.9 });
    expect(compiled.units.find((unit) => unit.unit_label === "gaze_cue"))
      .toMatchObject({ duration: 0.3 });
    expect(
      compiled.units.find((unit) => unit.unit_label === "target")?.response_cfg
    ).toMatchObject({
      keys: ["h", "space"],
      correct_keys: [plan.correct_key],
      timeout_trigger: 52,
      terminate_on_response: true
    });

    const state = { ...compiled.trial_state };
    const units: TrialSnapshot["units"] = {
      target: { response: plan.correct_key, rt: 0.41 }
    };
    compiled.finalizers[0](
      {
        trial_id: 1,
        block_id: "practice",
        trial_index: 0,
        condition: plan.condition,
        units,
        trial_state: state
      },
      {
        getReducedRows: () => [],
        sumReducedField: () => 0
      } as RuntimeView,
      {
        setTrialState: (key, value) => {
          state[key] = value;
        },
        getUnitState: (label, key) => units[label]?.[key]
      }
    );
    expect(state).toMatchObject({
      response_key: plan.correct_key,
      response_rt: 0.41,
      correct: true,
      outcome: "correct"
    });
  });
});
