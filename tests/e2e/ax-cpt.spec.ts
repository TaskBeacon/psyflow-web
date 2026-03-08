import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(120_000);

async function waitForUnit(page: Page, unitLabel: string, timeout = 5000): Promise<Locator> {
  await page.waitForSelector(`[data-psyflow-unit-label="${unitLabel}"]`, { timeout, state: "visible" });
  return page.locator(`[data-psyflow-unit-label="${unitLabel}"]`).first();
}

async function getUnitText(page: Page, unitLabel: string, timeout = 5000): Promise<string> {
  const unit = await waitForUnit(page, unitLabel, timeout);
  return (await unit.textContent())?.trim() ?? "";
}

async function waitForProbeResponses(page: Page, totalTrials: number): Promise<string[]> {
  const responses: string[] = [];
  let currentCue = "";
  let previousUnit = "";

  while (responses.length < totalTrials) {
    const state = await page.evaluate(() => ({
      unit: document.querySelector("[data-psyflow-unit-label]")?.getAttribute("data-psyflow-unit-label") ?? "",
      text: document.querySelector("[data-psyflow-unit-label]")?.textContent?.trim() ?? ""
    }));

    if (state.unit === "cue" && previousUnit !== "cue") {
      currentCue = state.text;
    }

    if (state.unit === "probe" && previousUnit !== "probe") {
      const key = currentCue === "A" && state.text === "X" ? "f" : "j";
      responses.push(key);
      await page.keyboard.press(key);
    }

    previousUnit = state.unit;
    await page.waitForTimeout(50);
  }

  return responses;
}

test("AX-CPT preview runs end-to-end with aligned reduced exports", async ({ page }) => {
  await page.goto("/?task=H000001-ax-cpt");

  await page.locator('input[name="subject_id"]').fill("101");
  await page.locator('input[name="subname"]').fill("tester");
  await page.locator('input[name="age"]').fill("18");
  await page.locator('select[name="gender"]').selectOption("Male");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  await waitForUnit(page, "instruction_text");
  await page.keyboard.press("Space");

  const responses = await waitForProbeResponses(page, 24);

  await waitForUnit(page, "block", 30000);
  await page.keyboard.press("Space");

  await waitForUnit(page, "goodbye", 10000);
  await page.keyboard.press("Space");

  await expect(page.locator("#psyflow-task-results")).toBeVisible();

  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) {
    return;
  }

  expect(result.reduced_rows).toHaveLength(24);
  expect(result.raw_rows.length).toBeGreaterThan(120);
  expect(result.aborted).toBeFalsy();
  expect(result.abort_reason).toBeNull();
  expect(result.reduced_rows.every((row: Record<string, unknown>) => row.condition !== undefined)).toBeTruthy();
  expect(result.reduced_rows.every((row: Record<string, unknown>) => row.correct_response !== undefined)).toBeTruthy();
  expect(result.reduced_rows.every((row: Record<string, unknown>) => row.probe_response !== undefined)).toBeTruthy();
  expect(result.reduced_rows.every((row: Record<string, unknown>) => row.feedback_feedback_type !== undefined)).toBeTruthy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => row.condition === "AX")).toBeTruthy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => row.condition === "AY")).toBeTruthy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => row.condition === "BX")).toBeTruthy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => row.condition === "BY")).toBeTruthy();
  expect(result.reduced_rows.every((row: Record<string, unknown>) => row.probe_hit === true)).toBeTruthy();
  expect(new Set(responses)).toEqual(new Set(["f", "j"]));
});
