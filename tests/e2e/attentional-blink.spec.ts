import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(120_000);

async function waitForUnit(page: Page, unitLabel: string, timeout = 12_000): Promise<Locator> {
  await page.waitForSelector(`[data-psyflow-unit-label="${unitLabel}"]`, { timeout, state: "visible" });
  return page.locator(`[data-psyflow-unit-label="${unitLabel}"]`).first();
}

async function pressAndReplace(page: Page, unit: Locator, key: string): Promise<void> {
  const handle = await unit.elementHandle();
  await page.keyboard.press(key);
  await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 5_000 });
}

async function answerCurrentTrial(page: Page, makeFirstPresentError = false, screenshotAbsent = false): Promise<{ t2Present: boolean; madeError: boolean }> {
  const t1 = await waitForUnit(page, "t1_report");
  await expect(t1).toContainText("第一个数字");
  const digits = await page.evaluate(() => {
    const values = [...((window as unknown as { __AB_DIGITS__?: string[] }).__AB_DIGITS__ ?? [])];
    (window as unknown as { __AB_DIGITS__?: string[] }).__AB_DIGITS__ = [];
    return values;
  });
  expect(digits.length).toBeGreaterThanOrEqual(1);
  expect(digits.length).toBeLessThanOrEqual(2);
  await pressAndReplace(page, t1, digits[0]);
  const t2 = await waitForUnit(page, "t2_report");
  await expect(t2).toContainText("第二个数字");
  const correct = digits[1] ?? "0";
  if (screenshotAbsent && digits.length === 1) await page.screenshot({ path: "test-results/attentional-blink-t2-report.png", fullPage: true });
  const shouldError = makeFirstPresentError && digits.length === 2;
  const response = shouldError ? (["0", "2", "3", "4", "5", "6", "7", "8", "9"].find((key) => key !== correct) ?? "0") : correct;
  await pressAndReplace(page, t2, response);
  return { t2Present: digits.length === 2, madeError: shouldError };
}

test("Attentional Blink browser task runs hit, miss, absence, and export paths", async ({ page }) => {
  let configSeen = false;
  let configPatched = false;
  let configDebug = "route not observed";
  await page.route("**/*", async (route) => {
    if (!route.request().url().toLowerCase().includes(".yaml")) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("total_blocks: 4", "total_blocks: 1")
      .replace("total_trials: 408", "total_trials: 4")
      .replace("trial_per_block: 102", "trial_per_block: 4")
      .replace("condition_counts: {short_present: 48, long_present: 18, short_absent: 18, long_absent: 18}", "condition_counts: {short_present: 1, long_present: 1, short_absent: 1, long_absent: 1}")
      .replace("practice_condition_counts: {short_present: 16, long_present: 6, short_absent: 6, long_absent: 6}", "practice_condition_counts: {short_present: 1, long_present: 0, short_absent: 0, long_absent: 0}");
    configSeen = true;
    configPatched = body.includes("total_blocks: 1") && body.includes("total_trials: 4") && body.includes("short_present: 1, long_present: 0");
    configDebug = `${route.request().url()}\n${original.slice(0, 800)}`;
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000058-attentional-blink");
  await expect.poll(() => configSeen, { timeout: 10_000 }).toBeTruthy();
  expect(configPatched, configDebug).toBeTruthy();
  await page.locator('input[name="subject_id"]').fill("158");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();
  await pressAndReplace(page, await waitForUnit(page, "instruction"), "Space");
  const practiceIntro = await waitForUnit(page, "practice_intro");
  await page.evaluate(() => {
    const tracked = new WeakSet<Element>();
    (window as unknown as { __AB_DIGITS__?: string[] }).__AB_DIGITS__ = [];
    const observer = new MutationObserver(() => {
      document.querySelectorAll('[data-psyflow-unit-label^="rsvp_item_"]').forEach((element) => {
        if (tracked.has(element)) return;
        tracked.add(element);
        const text = (element.textContent ?? "").trim();
        if (/^[2-9]$/.test(text)) (window as unknown as { __AB_DIGITS__?: string[] }).__AB_DIGITS__?.push(text);
      });
    });
    observer.observe(document.querySelector("#psyflow-task-runtime")!, { childList: true, subtree: true });
  });
  await pressAndReplace(page, practiceIntro, "Space");

  await answerCurrentTrial(page);
  const feedback = await page.waitForSelector('[data-psyflow-unit-label^="practice_feedback_"]', { timeout: 3_000, state: "visible" });
  await page.waitForFunction((element) => !element?.isConnected, feedback, { timeout: 3_000 });

  let madeError = false;
  let capturedAbsent = false;
  let scoredAnswered = 0;
  while (scoredAnswered < 8) {
    await page.waitForSelector('[data-psyflow-unit-label="t1_report"], [data-psyflow-unit-label="good_bye"]', { timeout: 12_000, state: "visible" });
    if (await page.locator('[data-psyflow-unit-label="good_bye"]').isVisible()) break;
    const result = await answerCurrentTrial(page, !madeError, !capturedAbsent);
    madeError ||= result.madeError;
    capturedAbsent ||= !result.t2Present;
    scoredAnswered += 1;
  }
  expect(scoredAnswered).toBe(4);
  expect(madeError).toBeTruthy();
  expect(capturedAbsent).toBeTruthy();

  await pressAndReplace(page, await waitForUnit(page, "good_bye"), "Space");
  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  expect(result.aborted).toBeFalsy();
  expect(result.reduced_rows).toHaveLength(5);
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  expect(rows.filter((row) => row.is_practice === true)).toHaveLength(1);
  expect(rows.filter((row) => row.is_practice === false)).toHaveLength(4);
  expect(new Set(rows.filter((row) => row.is_practice === false).map((row) => row.condition))).toEqual(new Set(["short_present", "long_present", "short_absent", "long_absent"]));
  expect(rows.some((row) => row.response_correct === true)).toBeTruthy();
  expect(rows.some((row) => row.t2_correct === false)).toBeTruthy();
  expect(rows.some((row) => row.t2_present === false && row.t2_response === "0" && row.t2_correct === true)).toBeTruthy();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("H000058-attentional-blink_reduced.csv");
});
