import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(60_000);

async function waitForUnit(page: Page, unitLabel: string, timeout = 10_000): Promise<Locator> {
  await page.waitForSelector(`[data-psyflow-unit-label="${unitLabel}"]`, { timeout, state: "visible" });
  return page.locator(`[data-psyflow-unit-label="${unitLabel}"]`).first();
}

async function pressAndReplace(page: Page, unit: Locator, key: string): Promise<void> {
  const handle = await unit.elementHandle();
  await page.keyboard.press(key);
  await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 5_000 });
}

test("Posner browser task covers five conditions, four outcomes, visual geometry, and export", async ({ page }) => {
  let configPatched = false;
  await page.route("**/*", async (route) => {
    if (!route.request().url().toLowerCase().includes(".yaml")) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("total_blocks: 6", "total_blocks: 1")
      .replace("total_trials: 360", "total_trials: 6")
      .replace("trial_per_block: 60", "trial_per_block: 6")
      .replace("scored_counts_per_block: {valid: 32, invalid: 8, neutral: 8, no_cue: 8, catch: 4}", "scored_counts_per_block: {valid: 1, invalid: 1, neutral: 1, no_cue: 1, catch: 2}")
      .replace("practice_counts: {valid: 6, invalid: 2, neutral: 1, no_cue: 1, catch: 2}", "practice_counts: {valid: 0, invalid: 0, neutral: 0, no_cue: 0, catch: 0}")
      .replace("cue_target_intervals: [0.4, 0.7]", "cue_target_intervals: [0.10, 0.15]")
      .replace("cue_duration: 0.1", "cue_duration: 0.05")
      .replace("target_duration: 0.1", "target_duration: 1.50")
      .replace("response_window: 1.0", "response_window: 1.70")
      .replace("trial_onset_interval: 2.0", "trial_onset_interval: 1.90");
    configPatched = body.includes("total_trials: 6") && body.includes("catch: 2") && body.includes("response_window: 1.70");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000061-posner-spatial-cueing-task");
  await expect.poll(() => configPatched, { timeout: 10_000 }).toBeTruthy();
  await page.locator('input[name="subject_id"]').fill("161");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();
  await pressAndReplace(page, await waitForUnit(page, "instruction"), "Space");

  let targetCount = 0;
  let catchCount = 0;
  let screenshotTaken = false;
  while (!(await page.locator('[data-psyflow-unit-label="good_bye"]').isVisible())) {
    await page.waitForSelector('[data-psyflow-unit-label="target"], [data-psyflow-unit-label="catch_response_window"], [data-psyflow-unit-label="good_bye"]', { state: "visible", timeout: 10_000 });
    if (await page.locator('[data-psyflow-unit-label="good_bye"]').isVisible()) break;

    const target = page.locator('[data-psyflow-unit-label="target"]');
    if (await target.isVisible()) {
      targetCount += 1;
      const handle = await target.elementHandle();
      expect(await target.locator('[data-psyflow-stim-id="box_left"]').count()).toBe(1);
      expect(await target.locator('[data-psyflow-stim-id="box_right"]').count()).toBe(1);
      const stimIds = await target.locator("[data-psyflow-stim-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-psyflow-stim-id")));
      if (!screenshotTaken) {
        await target.screenshot({ path: "test-results/posner-target-stage.png" });
        screenshotTaken = true;
      }
      expect(stimIds.filter((id) => id?.startsWith("target_")), `rendered stimuli: ${stimIds.join(", ")}`).toHaveLength(1);
      if (targetCount !== 2) await page.keyboard.press("Space");
      await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 3_000 });
      continue;
    }

    const catchWindow = page.locator('[data-psyflow-unit-label="catch_response_window"]');
    catchCount += 1;
    const handle = await catchWindow.elementHandle();
    expect(await catchWindow.locator('[data-psyflow-stim-id^="target_"]').count()).toBe(0);
    if (catchCount === 1) await page.keyboard.press("Space");
    await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 3_000 });
  }

  await pressAndReplace(page, await waitForUnit(page, "good_bye"), "Space");
  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  expect(result.aborted).toBeFalsy();
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  expect(rows).toHaveLength(6);
  expect(new Set(rows.map((row) => row.condition))).toEqual(new Set(["valid", "invalid", "neutral", "no_cue", "catch"]));
  expect(new Set(rows.map((row) => row.outcome))).toEqual(new Set(["hit", "omission", "false_alarm", "correct_rejection"]));
  expect(rows.filter((row) => row.condition === "valid").every((row) => row.cue_side === row.target_side)).toBe(true);
  expect(rows.filter((row) => row.condition === "invalid").every((row) => row.cue_side !== row.target_side)).toBe(true);
  expect(rows.every((row) => row.cue_target_interval === 0.1 || row.cue_target_interval === 0.15)).toBe(true);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("H000061-posner-spatial-cueing-task_reduced.csv");
});
