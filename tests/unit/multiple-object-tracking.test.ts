import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type RuntimeView, type TrialSnapshot } from "../../src";
import { run_trial } from "../../../H000071-multiple-object-tracking-task/src/run_trial";
import {
  plans,
  type StimulusRecord
} from "../../../H000071-multiple-object-tracking-task/src/utils";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const records = JSON.parse(
  readFileSync(
    path.join(repoRoot, "H000071-multiple-object-tracking-task/assets/generated/stimuli.json"),
    "utf8"
  )
) as StimulusRecord[];

describe("H000071 multiple object tracking", () => {
  it("preserves 36 valid clips across 12 factorial cells", () => {
    const scored = plans(records, false, 3);
    expect(scored).toHaveLength(36);
    expect(plans(records, true, 1)).toHaveLength(6);
    for (const targetCount of [2, 4, 6]) {
      for (const speed of ["slow", "fast"]) {
        for (const probeStatus of ["target", "distractor"]) {
          expect(
            scored.filter(
              (plan) =>
                plan.target_count === targetCount &&
                plan.speed === speed &&
                plan.probe_status === probeStatus
            )
          ).toHaveLength(3);
        }
      }
    }
    for (const plan of scored) {
      expect(plan.target_ids).toHaveLength(plan.target_count);
      expect(plan.target_ids.includes(plan.probe_id)).toBe(plan.probe_status === "target");
      expect(plan.correct_key).toBe(plan.probe_status === "target" ? "f" : "j");
    }
  });

  it("compiles canonical stages, media, triggers, and outcome fields", () => {
    const plan = plans(records, false, 1).find((item) => item.probe_status === "target")!;
    const settings = TaskSettings.from_dict({
      total_blocks: 2,
      total_trials: 42,
      trial_per_block: 21,
      conditions: [plan.condition],
      fixation_duration: 0.5,
      cue_duration: 2,
      tracking_duration: 4,
      response_window: 3,
      feedback_duration: 0.75,
      iti_duration: 0.5
    }) as TaskSettings & Record<string, unknown>;
    settings.triggers = {
      map: {
        fixation: 20,
        cue_2: 32,
        cue_4: 34,
        cue_6: 36,
        tracking_slow: 40,
        tracking_fast: 41,
        probe_target: 50,
        probe_distractor: 51,
        target_response: 60,
        distractor_response: 61,
        timeout: 62,
        feedback: 70,
        iti: 80
      }
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      cue_image: { type: "image", image: "cue.png" },
      tracking_movie: { type: "movie", filename: "track.mp4", muted: true },
      probe_image: { type: "image", image: "probe.png" },
      feedback_correct: { type: "text", text: "CORRECT" },
      feedback_incorrect: { type: "text", text: "INCORRECT" }
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "scored",
      trial_index: 0,
      condition: plan.condition
    });
    run_trial(trial, plan, { settings, stimBank });
    const compiled = trial.build();
    expect(compiled.units.map((unit) => unit.unit_label)).toEqual([
      "fixation",
      "target_cue",
      "tracking",
      "probe",
      "practice_feedback",
      "iti"
    ]);
    expect(compiled.units.find((unit) => unit.unit_label === "tracking")).toMatchObject({
      duration: 4,
      onset_trigger: plan.speed === "slow" ? 40 : 41
    });
    expect(compiled.units.find((unit) => unit.unit_label === "probe")?.response_cfg).toMatchObject({
      keys: ["f", "j"],
      correct_keys: ["f"],
      timeout_trigger: 62,
      terminate_on_response: true
    });

    const state = { ...compiled.trial_state };
    const units: TrialSnapshot["units"] = { probe: { response: "f", rt: 0.42 } };
    compiled.finalizers[0](
      { trial_id: 1, block_id: "scored", trial_index: 0, condition: plan.condition, units, trial_state: state },
      { getReducedRows: () => [], sumReducedField: () => 0 } as RuntimeView,
      { setTrialState: (key, value) => { state[key] = value; }, getUnitState: (label, key) => units[label]?.[key] }
    );
    expect(state).toMatchObject({ response_key: "f", response_rt: 0.42, correct: true, outcome: "correct" });
  });
});

