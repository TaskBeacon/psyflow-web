import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  StimBank,
  TaskSettings,
  TrialBuilder,
  type RuntimeView,
  type TrialSnapshot
} from "../../src";
import { run_trial } from "../../../H000072-semantic-priming-task/src/run_trial";
import {
  parseStimuliCsv,
  plans,
  resolveCounterbalance
} from "../../../H000072-semantic-priming-task/src/utils";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const rows = parseStimuliCsv(
  readFileSync(
    path.join(repoRoot, "H000072-semantic-priming-task/assets/stimuli.csv"),
    "utf8"
  )
);

describe("H000072 semantic priming", () => {
  it("preserves canonical A/B item and condition balance", () => {
    expect(rows.filter((row) => row.phase === "practice")).toHaveLength(3);
    expect(rows.filter((row) => row.phase === "scored")).toHaveLength(24);
    expect(resolveCounterbalance("171")).toBe("A");
    expect(resolveCounterbalance("172")).toBe("B");

    for (const listName of ["A", "B"] as const) {
      const scored = plans(rows, {
        practice: false,
        listName,
        seed: 72072,
        itemLimit: 24
      });
      expect(scored).toHaveLength(48);
      expect(scored.filter((plan) => plan.relation === "related")).toHaveLength(
        12
      );
      expect(
        scored.filter((plan) => plan.relation === "unrelated")
      ).toHaveLength(12);
      expect(
        scored.filter((plan) => plan.lexicality === "nonword")
      ).toHaveLength(24);
      expect(new Set(scored.map((plan) => plan.target)).size).toBe(48);
    }
  });

  it("compiles the canonical stages, timings, triggers, and outcomes", () => {
    const plan = plans(rows, {
      practice: true,
      listName: "A",
      seed: 72072
    }).find((item) => item.lexicality === "word")!;
    const settings = TaskSettings.from_dict({
      total_blocks: 2,
      total_trials: 54,
      trial_per_block: 27,
      conditions: ["word_related", "word_unrelated", "nonword_none"],
      fixation_duration: 0.5,
      prime_duration: 0.15,
      isi_duration: 0.05,
      response_window: 3,
      feedback_duration: 0.5,
      iti_duration: 1.5
    }) as TaskSettings & Record<string, unknown>;
    settings.triggers = {
      map: {
        fixation: 20,
        prime_related: 30,
        prime_unrelated: 31,
        prime_nonword_trial: 32,
        isi: 40,
        target_word: 50,
        target_nonword: 51,
        response_word: 60,
        response_nonword: 61,
        timeout: 62,
        feedback: 70,
        iti: 80
      }
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      prime: { type: "text", text: "PRIME" },
      blank: { type: "text", text: "" },
      target: { type: "text", text: "target" },
      feedback_correct: { type: "text", text: "CORRECT" },
      feedback_incorrect: { type: "text", text: "INCORRECT" },
      feedback_timeout: { type: "text", text: "TOO SLOW" }
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
      "prime",
      "isi",
      "target",
      "practice_feedback",
      "iti"
    ]);
    expect(compiled.units.find((unit) => unit.unit_label === "prime")).toMatchObject({
      duration: 0.15
    });
    expect(
      compiled.units.find((unit) => unit.unit_label === "target")?.response_cfg
    ).toMatchObject({
      keys: ["f", "j"],
      correct_keys: ["f"],
      timeout_trigger: 62,
      terminate_on_response: true
    });

    const state = { ...compiled.trial_state };
    const units: TrialSnapshot["units"] = {
      target: { response: "f", rt: 0.48 }
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
      response_key: "f",
      response_rt: 0.48,
      correct: true,
      outcome: "correct"
    });
  });
});
