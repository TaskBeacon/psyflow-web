import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  StimBank,
  TaskSettings,
  TrialBuilder,
  parseCsvRows,
  type RuntimeView,
  type TrialSnapshot
} from "../../src";
import { run_trial } from "../../../H000074-tower-of-london-task/src/run_trial";
import {
  distanceAndPathCount,
  plans,
  validateProblems,
  type ProblemRow
} from "../../../H000074-tower-of-london-task/src/utils";

const csv = readFileSync(
  path.resolve(
    process.cwd(),
    "../H000074-tower-of-london-task/assets/problems.csv"
  ),
  "utf8"
);
const problems = validateProblems(parseCsvRows<ProblemRow>(csv));

describe("H000074 Tower of London", () => {
  it("preserves the canonical legal problem set and condition balance", () => {
    const practice = plans(problems, { practice: true, seed: 74074 });
    const scored = plans(problems, {
      practice: false,
      seed: 74074,
      scoredPerLoadLimit: 6
    });
    expect(practice).toHaveLength(4);
    expect(scored).toHaveLength(24);
    expect(practice.map((plan) => plan.min_moves)).toEqual([2, 3, 4, 5]);
    for (const load of [2, 3, 4, 5]) {
      expect(scored.filter((plan) => plan.min_moves === load)).toHaveLength(6);
    }
    for (const problem of problems) {
      expect(
        distanceAndPathCount(problem.start_state, problem.goal_state)
      ).toEqual({ distance: problem.min_moves, pathCount: 1 });
    }
  });

  it("compiles canonical phases, timings, practice branch, and outcomes", () => {
    const plan = plans(problems, { practice: true, seed: 74074 })[1];
    const settings = TaskSettings.from_dict({
      total_blocks: 2,
      total_trials: 28,
      trial_per_block: 14,
      conditions: ["moves2", "moves3", "moves4", "moves5"],
      fixation_duration: 0.5,
      goal_preview_duration: 5,
      planning_window: 15,
      choice_window: 5,
      practice_feedback_duration: 0.75,
      iti_duration: 0.75
    }) as TaskSettings & Record<string, unknown>;
    settings.triggers = {
      map: {
        fixation: 20,
        goal_preview: 30,
        planning: 40,
        planning_ready: 41,
        planning_timeout: 42,
        choice: 50,
        response_2: 52,
        response_3: 53,
        response_4: 54,
        response_5: 55,
        choice_timeout: 56,
        feedback: 60,
        iti: 70
      }
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      goal_board: { type: "image", image: "goal.png" },
      problem_board: { type: "image", image: "problem.png" },
      planning_prompt: { type: "text", text: "Plan" },
      choice_prompt: { type: "text", text: "Choose" },
      feedback_correct: { type: "text", text: "CORRECT" },
      feedback_incorrect: { type: "text", text: "INCORRECT" },
      feedback_timeout: { type: "text", text: "TOO SLOW" },
      blank: { type: "text", text: "" }
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
      "goal_preview",
      "planning",
      "choice",
      "feedback",
      "iti"
    ]);
    expect(compiled.units.find((unit) => unit.unit_label === "goal_preview"))
      .toMatchObject({ duration: 5 });
    expect(
      compiled.units.find((unit) => unit.unit_label === "planning")
        ?.response_cfg
    ).toMatchObject({
      keys: ["space"],
      timeout_trigger: 42,
      terminate_on_response: true
    });
    expect(compiled.units.find((unit) => unit.unit_label === "planning"))
      .toMatchObject({ duration: 15 });
    expect(
      compiled.units.find((unit) => unit.unit_label === "choice")?.response_cfg
    ).toMatchObject({
      keys: ["2", "3", "4", "5"],
      correct_keys: [plan.correct_key],
      timeout_trigger: 56,
      terminate_on_response: true
    });
    expect(compiled.units.find((unit) => unit.unit_label === "choice"))
      .toMatchObject({ duration: 5 });

    const state = { ...compiled.trial_state };
    const units: TrialSnapshot["units"] = {
      planning: { response: "space", rt: 1.2 },
      choice: { response: plan.correct_key, rt: 0.4 }
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
      plan_ready: true,
      planning_rt: 1.2,
      response_key: plan.correct_key,
      choice_rt: 0.4,
      response_rt: 0.4,
      correct: true,
      outcome: "correct"
    });

    const scoredPlan = plans(problems, {
      practice: false,
      seed: 74074,
      scoredPerLoadLimit: 1
    })[0];
    const scoredTrial = new TrialBuilder({
      trial_id: 2,
      block_id: "scored",
      trial_index: 0,
      condition: scoredPlan.condition
    });
    run_trial(scoredTrial, scoredPlan, { settings, stimBank });
    expect(scoredTrial.build().units.map((unit) => unit.unit_label)).toEqual([
      "fixation",
      "goal_preview",
      "planning",
      "choice",
      "iti"
    ]);
  });
});
