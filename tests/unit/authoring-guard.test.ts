import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

describe("HTML task authoring layer", () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(dirname, "../../..");

  function discoverHtmlTaskDirs(): string[] {
    return readdirSync(repoRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^H\d{6}-.+/.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  function findCanonicalTaskDir(htmlTaskDir: string): string {
    const numericId = htmlTaskDir.match(/^H(\d{6})-/)?.[1];
    const canonicalDir = readdirSync(repoRoot, { withFileTypes: true }).find(
      (entry) => entry.isDirectory() && entry.name.startsWith(`T${numericId}-`)
    );

    if (!canonicalDir) {
      throw new Error(`Canonical T task not found for ${htmlTaskDir}`);
    }

    return canonicalDir.name;
  }

  function readYamlFile(filePath: string): Record<string, unknown> {
    return (parse(readFileSync(filePath, "utf8")) ?? {}) as Record<string, unknown>;
  }

  it("does not import jsPsych directly from task files", () => {
    for (const taskDir of discoverHtmlTaskDirs()) {
      const baseDir = path.join(repoRoot, taskDir);
      const files = ["main.ts", "src/run_trial.ts", "src/controller.ts", "src/utils.ts"];

      for (const file of files.filter((candidate) => existsSync(path.join(baseDir, candidate)))) {
        const source = readFileSync(path.join(baseDir, file), "utf8");
        expect(source).not.toMatch(/from\s+["']jspsych["']/);
        expect(source).not.toMatch(/from\s+["']@jspsych\//);
      }
    }
  });

  it("keeps H task ids and slugs aligned to canonical T tasks", () => {
    for (const taskDir of discoverHtmlTaskDirs()) {
      const canonicalDir = findCanonicalTaskDir(taskDir);
      const taskConfig = readYamlFile(path.join(repoRoot, taskDir, "taskbeacon.yaml"));
      const canonicalConfig = readYamlFile(path.join(repoRoot, canonicalDir, "taskbeacon.yaml"));
      const expectedId = `H${String(canonicalConfig.id).replace(/^T/, "")}`;

      expect(taskConfig.id, `${taskDir} id`).toBe(expectedId);
      expect(taskConfig.slug, `${taskDir} slug`).toBe(canonicalConfig.slug);
    }
  });

  it("keeps every H task on the task-py2js source-only web contract", () => {
    const taskDirs = discoverHtmlTaskDirs();

    expect(taskDirs).toHaveLength(55);

    for (const taskDir of taskDirs) {
      const taskPath = path.join(repoRoot, taskDir);
      const taskConfig = readYamlFile(path.join(taskPath, "taskbeacon.yaml"));
      const contracts = (taskConfig.contracts ?? {}) as Record<string, unknown>;
      const runtime = (taskConfig.runtime ?? {}) as Record<string, unknown>;

      expect(taskConfig.variant, `${taskDir} variant`).toBe("html");
      expect(contracts.taps, `${taskDir} contracts.taps`).toBe("v0.2.0");
      expect(runtime.profile, `${taskDir} runtime.profile`).toBe("web");

      for (const requiredFile of [
        "main.ts",
        "README.md",
        "taskbeacon.yaml",
        "config/config.yaml",
        "src/run_trial.ts",
        ".github/workflows/notify-psyflow-web.yml"
      ]) {
        expect(existsSync(path.join(taskPath, requiredFile)), `${taskDir} ${requiredFile}`).toBe(
          true
        );
      }

      for (const forbiddenPath of ["dist", "node_modules", "vite.config.ts", "package.json"]) {
        expect(existsSync(path.join(taskPath, forbiddenPath)), `${taskDir} ${forbiddenPath}`).toBe(
          false
        );
      }
    }
  });
});
