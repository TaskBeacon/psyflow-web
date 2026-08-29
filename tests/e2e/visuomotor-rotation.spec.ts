import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(45_000);

async function waitForUnit(page: Page, label: string, timeout = 5_000): Promise<Locator> {
  await page.waitForSelector(`[data-psyflow-unit-label="${label}"]`, { state: "visible", timeout });
  return page.locator(`[data-psyflow-unit-label="${label}"]`).first();
}

async function pressAndReplace(page: Page, unit: Locator, key: string) {
  const handle = await unit.elementHandle();
  await page.keyboard.press(key);
  await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 5_000 });
}

async function prepareReach(page: Page) {
  const unit = await waitForUnit(page, "reach");
  const handle = await unit.elementHandle();
  const box = await unit.boundingBox();
  if (!box) throw new Error("reach stage has no bounding box");
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.waitForTimeout(550);
  const targetBox = await unit.locator('[data-psyflow-stim-id="__pointer_reach_target"]').boundingBox();
  if (!targetBox) throw new Error("target has no bounding box after start hold");
  return {
    unit,
    handle,
    center,
    target: { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 }
  };
}

async function completeDirectReach(page: Page) {
  const reach = await prepareReach(page);
  await page.mouse.move(reach.target.x, reach.target.y);
  await page.waitForFunction((element) => !element?.isConnected, reach.handle, { timeout: 5_000 });
}

test("Visuomotor rotation runs hit, miss, timeout, no-feedback, and export", async ({ page }) => {
  let configPatched = false;
  await page.route("**/*.yaml", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace("total_trials: 90", "total_trials: 5")
      .replace("trial_per_block: 30", "trial_per_block: 2")
      .replace("baseline_trials: 30", "baseline_trials: 2")
      .replace("adaptation_trials: 54", "adaptation_trials: 2")
      .replace("aftereffect_trials: 6", "aftereffect_trials: 1")
      .replace("attention_check_after_trial: 10", "attention_check_after_trial: 1");
    configPatched = body.includes("total_trials: 5") && body.includes("aftereffect_trials: 1");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000105-visuomotor-rotation-adaptation");
  await expect.poll(() => configPatched, { timeout: 10_000 }).toBeTruthy();
  await page.locator('input[name="subject_id"]').fill("123");
  await page.locator('input[name="age"]').fill("25");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  await pressAndReplace(page, await waitForUnit(page, "instruction"), "Space");
  await pressAndReplace(page, await waitForUnit(page, "comprehension_check"), "KeyA");
  await completeDirectReach(page);
  await pressAndReplace(page, await waitForUnit(page, "attention_check"), "KeyB");

  const timeout = await prepareReach(page);
  await page.mouse.move(timeout.center.x + 60, timeout.center.y);
  await page.waitForFunction((element) => !element?.isConnected, timeout.handle, { timeout: 2_000 });
  await expect(await waitForUnit(page, "too_slow")).toContainText("太慢了");

  await pressAndReplace(page, await waitForUnit(page, "adaptation_instruction"), "Space");
  await completeDirectReach(page);
  await completeDirectReach(page);
  await pressAndReplace(page, await waitForUnit(page, "aftereffect_instruction"), "Space");

  const after = await prepareReach(page);
  await page.mouse.move((after.center.x + after.target.x) / 2, (after.center.y + after.target.y) / 2);
  await expect(after.unit.locator('[data-psyflow-stim-id="__pointer_reach_cursor"]')).toHaveCSS("visibility", "hidden");
  await page.mouse.move(after.target.x, after.target.y);
  await page.waitForFunction((element) => !element?.isConnected, after.handle, { timeout: 5_000 });
  await pressAndReplace(page, await waitForUnit(page, "good_bye"), "Space");

  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  expect(rows).toHaveLength(5);
  expect(rows[0]).toMatchObject({ condition: "baseline", completed: true, cursor_hit: true, outcome: "complete" });
  expect(rows[1]).toMatchObject({ condition: "baseline", completed: false, timed_out: true, outcome: "timeout" });
  expect(rows[2]).toMatchObject({ condition: "adaptation", completed: true, cursor_hit: false, outcome: "complete" });
  expect(rows[3]).toMatchObject({ condition: "adaptation", completed: true, cursor_hit: false, outcome: "complete" });
  expect(rows[4]).toMatchObject({ condition: "aftereffect", feedback_mode: "none", completed: true, outcome: "complete" });
  expect(rows.every((row) => Array.isArray(row.trajectory_physical))).toBeTruthy();
  expect(rows.every((row) => Array.isArray(row.trajectory_display))).toBeTruthy();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await download).suggestedFilename()).toBe("H000105-visuomotor-rotation-adaptation_reduced.csv");
});
