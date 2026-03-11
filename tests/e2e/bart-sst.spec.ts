import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(180_000);

async function waitForUnit(page: Page, unitLabel: string, timeout = 5000): Promise<Locator> {
  await page.waitForSelector(`[data-psyflow-unit-label="${unitLabel}"]`, { timeout, state: "visible" });
  return page.locator(`[data-psyflow-unit-label="${unitLabel}"]`).first();
}

async function completeSubInfo(page: Page, subjectId: string): Promise<void> {
  await page.locator('input[name="subject_id"]').fill(subjectId);
  await page.locator('input[name="subname"]').fill("tester");
  await page.locator('input[name="age"]').fill("18");
  await page.locator('select[name="gender"]').selectOption("Male");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();
}

async function playBartPreview(page: Page, totalTrials: number): Promise<void> {
  let completedTrials = 0;
  let previousUnit = "";
  while (completedTrials < totalTrials) {
    const currentUnit = await page.evaluate(
      () => document.querySelector("[data-psyflow-unit-label]")?.getAttribute("data-psyflow-unit-label") ?? ""
    );
    if (currentUnit.startsWith("pump_") && previousUnit !== currentUnit) {
      completedTrials += 1;
      await page.keyboard.press("ArrowRight");
    }
    previousUnit = currentUnit;
    await page.waitForTimeout(50);
  }
}

async function playSstPreview(page: Page, totalTrials: number): Promise<void> {
  let respondedTrials = 0;
  let previousUnit = "";
  while (respondedTrials < totalTrials) {
    const currentUnit = await page.evaluate(
      () => document.querySelector("[data-psyflow-unit-label]")?.getAttribute("data-psyflow-unit-label") ?? ""
    );
    if ((currentUnit === "go" || currentUnit === "go_ssd") && previousUnit !== currentUnit) {
      respondedTrials += 1;
      await page.keyboard.press("f");
    }
    previousUnit = currentUnit;
    await page.waitForTimeout(25);
  }
}

test("BART preview runs end-to-end through the shared runner", async ({ page }) => {
  await page.goto("/?task=H000002-bart");

  await completeSubInfo(page, "102");
  await waitForUnit(page, "instruction_text");
  await page.keyboard.press("Space");

  await playBartPreview(page, 9);

  await waitForUnit(page, "block", 90_000);
  await page.keyboard.press("Space");

  await waitForUnit(page, "goodbye", 10_000);
  await page.keyboard.press("Space");

  await expect(page.locator("#psyflow-task-results")).toBeVisible();

  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) {
    return;
  }

  expect(result.reduced_rows).toHaveLength(9);
  expect(result.raw_rows.length).toBeGreaterThan(30);
  expect(result.aborted).toBeFalsy();
  expect(result.reduced_rows.every((row: Record<string, unknown>) => row.condition !== undefined)).toBeTruthy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => row.feedback_fb_type === "cash")).toBeTruthy();
});

test("SST preview runs end-to-end through the shared runner", async ({ page }) => {
  await page.goto("/?task=H000012-sst");

  await completeSubInfo(page, "103");
  await waitForUnit(page, "instruction_text");
  await page.keyboard.press("Space");

  await playSstPreview(page, 28);

  await waitForUnit(page, "block", 90_000);
  await page.keyboard.press("Space");

  await waitForUnit(page, "goodbye", 10_000);
  await page.keyboard.press("Space");

  await expect(page.locator("#psyflow-task-results")).toBeVisible();

  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) {
    return;
  }

  expect(result.reduced_rows).toHaveLength(28);
  expect(result.raw_rows.length).toBeGreaterThan(60);
  expect(result.aborted).toBeFalsy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => String(row.condition ?? "").startsWith("go"))).toBeTruthy();
  expect(
    result.reduced_rows.some((row: Record<string, unknown>) => String(row.condition ?? "").startsWith("stop"))
  ).toBeTruthy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => Boolean(row.go_key_press))).toBeTruthy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => Boolean(row.stop_failed))).toBeTruthy();
});
