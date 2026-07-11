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

async function answerTrial(page: Page, direction: "forward" | "backward", mode: "correct" | "incorrect" | "timeout", screenshot = false): Promise<void> {
  const recall = await waitForUnit(page, "recall");
  const recallHandle = await recall.elementHandle();
  const sequence = await page.evaluate(() => {
    const state = window as unknown as { __CORSI_FLASHES__?: string[] };
    const values = [...(state.__CORSI_FLASHES__ ?? [])];
    state.__CORSI_FLASHES__ = [];
    return values;
  });
  expect(sequence.length).toBeGreaterThanOrEqual(2);
  if (screenshot) await page.screenshot({ path: "test-results/corsi-recall.png", fullPage: true });
  if (mode === "timeout") {
    await page.waitForFunction((element) => !element?.isConnected, recallHandle, { timeout: 3_000 });
    return;
  }
  const currentSequence = sequence.slice(-2);
  const expected = direction === "forward" ? currentSequence : [...currentSequence].reverse();
  const response = [...expected];
  if (mode === "incorrect") {
    response[0] = Array.from({ length: 9 }, (_, index) => `block_${index + 1}`).find((name) => !expected.includes(name)) ?? "block_1";
  }
  for (const target of response) {
    await page.locator(`[data-psyflow-stim-id="${target}"]`).click();
  }
  await page.waitForFunction((element) => !element?.isConnected, recallHandle, { timeout: 3_000 });
}

test("Corsi browser task runs forward/backward hit, miss, timeout, adaptive stop, and export", async ({ page }) => {
  let configPatched = false;
  await page.route("**/*", async (route) => {
    if (!route.request().url().toLowerCase().includes(".yaml")) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("total_trials: 38", "total_trials: 4")
      .replace("trial_per_block: 19", "trial_per_block: 2")
      .replace("max_length: 9", "max_length: 2")
      .replace("practice_trials_per_direction: 3", "practice_trials_per_direction: 0")
      .replace("sequence_ready_duration: 0.5", "sequence_ready_duration: 0.03")
      .replace("flash_duration: 0.5", "flash_duration: 0.03")
      .replace("flash_ioi: 1.0", "flash_ioi: 0.06")
      .replace("recall_timeout: 30.0", "recall_timeout: 2.0")
      .replace("feedback_duration: 0.75", "feedback_duration: 0.03")
      .replace("iti_duration: 0.5", "iti_duration: 0.03");
    configPatched = body.includes("trial_per_block: 2") && body.includes("practice_trials_per_direction: 0") && body.includes("recall_timeout: 2.0");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000060-corsi-block-tapping-task");
  await expect.poll(() => configPatched, { timeout: 10_000 }).toBeTruthy();
  await page.locator('input[name="subject_id"]').fill("160");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  await page.evaluate(() => {
    const tracked = new WeakSet<Element>();
    (window as unknown as { __CORSI_FLASHES__?: string[] }).__CORSI_FLASHES__ = [];
    const observer = new MutationObserver(() => {
      document.querySelectorAll('[data-psyflow-unit-label^="sequence_flash_"]').forEach((stage) => {
        if (tracked.has(stage)) return;
        tracked.add(stage);
        const active = stage.querySelector<HTMLElement>('[data-psyflow-stim-id^="active_block_"]')?.dataset.psyflowStimId;
        if (active) (window as unknown as { __CORSI_FLASHES__?: string[] }).__CORSI_FLASHES__?.push(active.replace("active_", ""));
      });
    });
    observer.observe(document.querySelector("#psyflow-task-runtime")!, { childList: true, subtree: true });
  });

  await pressAndReplace(page, await waitForUnit(page, "instruction_general"), "Space");
  for (let blockIndex = 0; blockIndex < 2; blockIndex += 1) {
    await page.waitForSelector('[data-psyflow-unit-label="instruction_forward"], [data-psyflow-unit-label="instruction_backward"]', { state: "visible" });
    const direction = await page.locator('[data-psyflow-unit-label="instruction_forward"]').isVisible() ? "forward" : "backward";
    await pressAndReplace(page, await waitForUnit(page, `instruction_${direction}`), "Space");
    await answerTrial(page, direction, blockIndex === 0 ? "correct" : "incorrect", blockIndex === 0);
    await answerTrial(page, direction, blockIndex === 0 ? "incorrect" : "timeout");
    await pressAndReplace(page, await waitForUnit(page, `summary_${direction}`), "Space");
  }

  await pressAndReplace(page, await waitForUnit(page, "good_bye"), "Space");
  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  expect(result.aborted).toBeFalsy();
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  expect(rows).toHaveLength(4);
  expect(rows.filter((row) => row.is_practice === true)).toHaveLength(0);
  const scored = rows.filter((row) => row.is_practice === false);
  expect(scored).toHaveLength(4);
  expect(new Set(scored.map((row) => row.direction))).toEqual(new Set(["forward", "backward"]));
  expect(new Set(scored.map((row) => row.outcome))).toEqual(new Set(["correct", "incorrect", "timeout"]));
  expect(scored.every((row) => Array.isArray(row.selected_sequence) && Array.isArray(row.response_times))).toBeTruthy();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("H000060-corsi-block-tapping-task_reduced.csv");
});
