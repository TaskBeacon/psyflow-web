import { expect, test, type Page } from "@playwright/test";

test.setTimeout(180_000);

async function completeSubInfo(page: Page, subjectId: string): Promise<void> {
  await page.locator('input[name="subject_id"]').fill(subjectId);
  await page.locator('input[name="subname"]').fill("tester");
  await page.locator('input[name="age"]').fill("18");
  await page.locator('select[name="gender"]').selectOption("Male");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();
}

async function waitForUnit(page: Page, unitLabel: string, timeout = 5000): Promise<void> {
  await page.waitForSelector(`[data-psyflow-unit-label="${unitLabel}"]`, { timeout, state: "visible" });
}

async function playEmoDotPreview(page: Page, totalTrials: number): Promise<void> {
  let respondedTrials = 0;
  let previousUnit = "";
  while (respondedTrials < totalTrials) {
    const currentUnit = await page.evaluate(
      () => document.querySelector("[data-psyflow-unit-label]")?.getAttribute("data-psyflow-unit-label") ?? ""
    );
    if (currentUnit === "target" && previousUnit !== currentUnit) {
      respondedTrials += 1;
      await page.keyboard.press(respondedTrials % 2 === 0 ? "j" : "f");
    }
    previousUnit = currentUnit;
    await page.waitForTimeout(25);
  }
}

test("EmoDot preview runs end-to-end through the shared runner", async ({ page }) => {
  await page.goto("/?task=H000003-emodot");

  await completeSubInfo(page, "104");
  await waitForUnit(page, "instruction_text", 15_000);
  await page.keyboard.press("Space");

  await playEmoDotPreview(page, 20);

  await waitForUnit(page, "block_feedback", 90_000);
  await page.keyboard.press("Space");

  await waitForUnit(page, "goodbye", 15_000);
  await page.keyboard.press("Space");

  await expect(page.locator("#psyflow-task-results")).toBeVisible();

  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) {
    return;
  }

  expect(result.reduced_rows).toHaveLength(20);
  expect(result.raw_rows.length).toBeGreaterThan(70);
  expect(result.aborted).toBeFalsy();
  expect(
    result.reduced_rows.some((row: Record<string, unknown>) => String(row.condition ?? "").startsWith("PN_"))
  ).toBeTruthy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => Boolean(row.target_key_press))).toBeTruthy();

  const resources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes(".bmp"))
  );
  expect(resources.some((name: string) => name.includes("HF") || name.includes("NEF"))).toBeTruthy();
});
