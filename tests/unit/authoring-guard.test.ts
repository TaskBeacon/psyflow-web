import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("MID example authoring layer", () => {
  it("does not import jsPsych directly from task files", () => {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const baseDir = path.resolve(dirname, "../../../H000006-mid");
    const files = ["main.ts", "src/run_trial.ts", "src/controller.ts", "src/utils.ts"];

    for (const file of files) {
      const source = readFileSync(path.join(baseDir, file), "utf8");
      expect(source).not.toMatch(/from\s+["']jspsych["']/);
      expect(source).not.toMatch(/from\s+["']@jspsych\//);
    }
  });
});
