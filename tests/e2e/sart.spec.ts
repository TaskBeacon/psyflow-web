import { expect, test } from "@playwright/test";

test.setTimeout(75_000);
test("SART browser task covers fixed timing, masks, outcomes, and export", async ({ page }) => {
  await page.route("**/*", async (route) => {
    if (!route.request().url().toLowerCase().includes(".yaml")) return route.continue();
    const response = await route.fetch(); const original = await response.text();
    const body = original.replace("practice_repetitions_per_digit: 2", "practice_repetitions_per_digit: 1")
      .replace("scored_repetitions_per_digit: 25", "scored_repetitions_per_digit: 2")
      .replace("digit_duration: 0.25", "digit_duration: 0.40").replace("mask_duration: 0.90", "mask_duration: 0.60");
    await route.fulfill({ response, body });
  });
  await page.goto("/?task=H000064-sustained-attention-to-response-task");
  await page.locator('input[name="subject_id"]').fill("164"); await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click(); await page.keyboard.press("Space"); await page.keyboard.press("Space");
  let trial = 0; let maskShot = false;
  while (!(await page.locator('[data-psyflow-unit-label="practice_summary"], [data-psyflow-unit-label="good_bye"]').filter({ visible: true }).isVisible())) {
    const digit = page.locator('[data-psyflow-unit-label="digit"]').filter({ visible: true }); await digit.waitFor({ state: "visible", timeout: 8000 });
    trial += 1; const value = Number((await digit.textContent())?.trim()); const handle = await digit.elementHandle();
    if (trial !== 10 && value !== 3) await page.keyboard.press("Space");
    await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 3000 });
    const mask = page.locator('[data-psyflow-unit-label="mask_response"], [data-psyflow-unit-label="mask_hold"]').filter({ visible: true });
    await mask.waitFor({ state: "visible", timeout: 3000 });
    if (!maskShot) { await mask.screenshot({ path: "test-results/sart-mask-stage.png" }); maskShot = true; }
    const maskHandle = await mask.elementHandle();
    if (trial === 11) await page.keyboard.press("Space");
    await page.waitForFunction((element) => !element?.isConnected, maskHandle, { timeout: 3000 });
    if (trial === 9) break;
  }
  await page.keyboard.press("Space");
  let scoredSeen = 0; let noGoSeen = 0; let omissionPlanned = false;
  while (true) {
    await page.waitForSelector('[data-psyflow-unit-label="digit"], [data-psyflow-unit-label="good_bye"], #psyflow-task-results', { state: "visible", timeout: 8000 });
    if (await page.locator('[data-psyflow-unit-label="good_bye"]').isVisible() || await page.locator("#psyflow-task-results").isVisible()) break;
    const digit = page.locator('[data-psyflow-unit-label="digit"]').filter({ visible: true });
    scoredSeen += 1; const value = Number((await digit.textContent())?.trim()); const digitHandle = await digit.elementHandle();
    if (value !== 3) {
      if (scoredSeen > 1 && !omissionPlanned) omissionPlanned = true;
      else await page.keyboard.press("Space");
    }
    await page.waitForFunction((element) => !element?.isConnected, digitHandle, { timeout: 3000 });
    const mask = page.locator('[data-psyflow-unit-label="mask_response"], [data-psyflow-unit-label="mask_hold"]').filter({ visible: true }); await mask.waitFor({ state: "visible", timeout: 3000 });
    const maskHandle = await mask.elementHandle();
    if (value === 3) {
      noGoSeen += 1;
      if (noGoSeen === 1) { await page.waitForTimeout(100); await page.keyboard.press("Space"); }
    }
    await page.waitForFunction((element) => !element?.isConnected, maskHandle, { timeout: 3000 });
  }
  if (await page.locator('[data-psyflow-unit-label="good_bye"]').isVisible()) await page.keyboard.press("Space");
  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null); expect(result).not.toBeNull(); if (!result) return;
  const scored = (result.reduced_rows as Array<Record<string, unknown>>).filter((row) => row.is_practice === false);
  expect(scored).toHaveLength(18); expect(new Set(scored.map((row) => row.outcome))).toEqual(new Set(["hit", "omission", "false_alarm", "correct_rejection"]));
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await download).suggestedFilename()).toBe("H000064-sustained-attention-to-response-task_reduced.csv");
});
