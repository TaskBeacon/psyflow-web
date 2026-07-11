import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { parse } from "csv-parse/sync";

test.setTimeout(60_000);

const stimulusPath = fileURLToPath(new URL("../../../H000062-lexical-decision-task/assets/stimuli.csv", import.meta.url));
const stimulusRows = parse(readFileSync(stimulusPath, "utf8"), { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string, string>>;
const lexicalityByString = new Map(stimulusRows.map((row) => [row.letter_string.toUpperCase(), row.lexicality]));

async function waitForUnit(page: Page, unitLabel: string, timeout = 10_000): Promise<Locator> {
  await page.waitForSelector(`[data-psyflow-unit-label="${unitLabel}"]`, { timeout, state: "visible" });
  return page.locator(`[data-psyflow-unit-label="${unitLabel}"]`).first();
}

async function pressAndReplace(page: Page, unit: Locator, key: string): Promise<void> {
  const handle = await unit.elementHandle();
  await page.keyboard.press(key);
  await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 5_000 });
}

test("Lexical Decision browser task covers all classes, outcomes, ERROR gating, and export", async ({ page }) => {
  let configPatched = false;
  await page.route("**/*", async (route) => {
    if (!route.request().url().toLowerCase().includes(".yaml")) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("total_blocks: 4", "total_blocks: 1")
      .replace("total_trials: 120", "total_trials: 6")
      .replace("trial_per_block: 30", "trial_per_block: 6")
      .replace(/  block_counts:\r?\n(?:    - \{[^\n]+\}\r?\n){4}/, "  block_counts:\n    - {high_frequency_word: 2, low_frequency_word: 2, pseudoword: 2}\n")
      .replace("practice_trials: 30", "practice_trials: 0")
      .replace("fixation_duration: 0.5", "fixation_duration: 0.05")
      .replace("response_window: 2.0", "response_window: 1.50")
      .replace("error_feedback_duration: 0.75", "error_feedback_duration: 0.20")
      .replace("iti_duration: 0.15", "iti_duration: 0.05");
    configPatched = body.includes("total_trials: 6") && body.includes("pseudoword: 2") && body.includes("practice_trials: 0");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000062-lexical-decision-task");
  await expect.poll(() => configPatched, { timeout: 10_000 }).toBeTruthy();
  await page.locator('input[name="subject_id"]').fill("162");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();
  await pressAndReplace(page, await waitForUnit(page, "instruction"), "Space");

  let trialCount = 0;
  let errorFeedbackCount = 0;
  let screenshotTaken = false;
  while (!(await page.locator('[data-psyflow-unit-label="good_bye"]').isVisible())) {
    await page.waitForSelector('[data-psyflow-unit-label="lexical_decision"], [data-psyflow-unit-label="good_bye"]', { state: "visible", timeout: 10_000 });
    if (await page.locator('[data-psyflow-unit-label="good_bye"]').isVisible()) break;
    const decision = page.locator('[data-psyflow-unit-label="lexical_decision"]');
    const handle = await decision.elementHandle();
    const letterString = (await decision.textContent())?.trim() ?? "";
    const lexicality = lexicalityByString.get(letterString);
    expect(lexicality, `unknown displayed string ${letterString}`).toBeDefined();
    trialCount += 1;
    if (!screenshotTaken) {
      await decision.screenshot({ path: "test-results/lexical-decision-string.png" });
      screenshotTaken = true;
    }

    const correctKey = lexicality === "word" ? "f" : "j";
    if (trialCount === 3) {
      await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 3_000 });
      continue;
    }
    const key = trialCount === 2 ? (correctKey === "f" ? "j" : "f") : correctKey;
    await page.keyboard.press(key);
    await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 3_000 });
    if (trialCount === 2) {
      const feedback = await waitForUnit(page, "error_feedback");
      errorFeedbackCount += 1;
      expect((await feedback.textContent())?.trim()).toBe("错误");
    } else {
      await expect(page.locator('[data-psyflow-unit-label="error_feedback"]')).toHaveCount(0);
    }
  }

  expect(trialCount).toBe(6);
  expect(errorFeedbackCount).toBe(1);
  await pressAndReplace(page, await waitForUnit(page, "good_bye"), "Space");
  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  expect(result.aborted).toBeFalsy();
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  expect(rows).toHaveLength(6);
  expect(new Set(rows.map((row) => row.condition))).toEqual(new Set(["high_frequency_word", "low_frequency_word", "pseudoword"]));
  expect(new Set(rows.map((row) => row.outcome))).toEqual(new Set(["correct", "error", "timeout"]));
  expect(new Set(rows.map((row) => row.item_id)).size).toBe(6);
  expect(rows.filter((row) => row.outcome === "error")).toHaveLength(1);
  expect(rows.filter((row) => row.outcome === "timeout")).toHaveLength(1);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("H000062-lexical-decision-task_reduced.csv");
});
