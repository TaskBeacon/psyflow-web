import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  generateSessionPlan,
  goodmanKruskalGamma,
  recallIsCorrect,
  type Materials,
  type SettingsView
} from "../../../H000102-judgment-of-learning/src/utils";

const materials = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "../H000102-judgment-of-learning/assets/word_pairs.json"), "utf8")
) as Materials;

const settings = {
  practice_pairs: 6,
  scored_pairs: 60,
  pairs_per_block: 30,
  filler_trials: 120,
  filler_keys: { odd: "f", even: "j" },
  plan_seed: 102102,
  overall_seed: 102102
} as unknown as SettingsView;

describe("Judgment-of-Learning web plan", () => {
  it("preserves the canonical schedule and exact Python plan", () => {
    const plan = generateSessionPlan(settings, materials);
    expect(createHash("sha256").update(JSON.stringify(plan)).digest("hex")).toBe(
      "540b21673e93daa6481c3bd1d9ca0cc14e73b0cfedcce61eed8de14e1a2059a0"
    );
    expect(plan.study_blocks).toHaveLength(2);
    expect(plan.filler).toHaveLength(120);
    expect(plan.recall).toHaveLength(60);

    for (const schedule of plan.study_blocks) {
      const study = schedule.filter((trial) => trial.stage === "study");
      const jol = schedule.filter((trial) => trial.stage === "jol");
      expect(study).toHaveLength(30);
      expect(jol).toHaveLength(30);
      expect(study.filter((trial) => trial.jol_timing === "immediate_jol")).toHaveLength(15);
      expect(study.filter((trial) => trial.jol_timing === "delayed_jol")).toHaveLength(15);
      for (let index = 0; index <= study.length - 4; index += 1) {
        expect(new Set(study.slice(index, index + 4).map((trial) => trial.jol_timing)).size).toBeGreaterThan(1);
      }
      for (const item of study.filter((trial) => trial.jol_timing === "delayed_jol")) {
        const studyIndex = schedule.findIndex((trial) => trial.pair_id === item.pair_id && trial.stage === "study");
        const jolIndex = schedule.findIndex((trial) => trial.pair_id === item.pair_id && trial.stage === "jol");
        expect(jolIndex - studyIndex - 1).toBeGreaterThanOrEqual(10);
      }
    }

    expect(new Set(plan.recall.map((trial) => trial.pair_id)).size).toBe(60);
    expect(plan.filler.every((trial) => trial.correct_key === (trial.parity === "odd" ? "f" : "j"))).toBe(true);
  });

  it("uses the canonical prefix recall and gamma semantics", () => {
    expect(recallIsCorrect("TREE", "tree", 3)).toBe(true);
    expect(recallIsCorrect("treasure", "tree", 3)).toBe(true);
    expect(recallIsCorrect("truck", "tree", 3)).toBe(false);
    expect(goodmanKruskalGamma([
      { jol_probability: 0.8, recall_correct: true },
      { jol_probability: 0.2, recall_correct: false }
    ])).toBe(1);
  });
});
