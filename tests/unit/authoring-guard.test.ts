import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("HTML task authoring layer", () => {
  it("does not import jsPsych directly from task files", () => {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const taskFiles: Record<string, string[]> = {
      "../../../H000001-ax-cpt": ["main.ts", "src/run_trial.ts"],
      "../../../H000002-bart": ["main.ts", "src/run_trial.ts", "src/utils.ts"],
      "../../../H000006-mid": ["main.ts", "src/run_trial.ts", "src/controller.ts", "src/utils.ts"],
      "../../../H000012-sst": ["main.ts", "src/run_trial.ts", "src/controller.ts", "src/utils.ts"]
    };

    for (const [taskDir, files] of Object.entries(taskFiles)) {
      const baseDir = path.resolve(dirname, taskDir);
      for (const file of files) {
        const source = readFileSync(path.join(baseDir, file), "utf8");
        expect(source).not.toMatch(/from\s+["']jspsych["']/);
        expect(source).not.toMatch(/from\s+["']@jspsych\//);
      }
    }
  });
});
