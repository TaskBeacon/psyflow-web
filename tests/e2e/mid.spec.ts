import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(120_000);

async function waitForUnit(page: Page, unitLabel: string, timeout = 5000): Promise<Locator> {
  await page.waitForSelector(`[data-psyflow-unit-label="${unitLabel}"]`, { timeout, state: "visible" });
  return page.locator(`[data-psyflow-unit-label="${unitLabel}"]`).first();
}

test("MID example runs end-to-end and exports psyflow-style results", async ({ page }) => {
  await page.goto("/?task=H000006-mid");

  await page.locator('input[name="subject_id"]').fill("sub-e2e");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  await waitForUnit(page, "instruction_text");
  await page.keyboard.press("Space");

  await waitForUnit(page, "target", 15000);
  await page.waitForTimeout(30);
  await page.keyboard.press("Space");

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
  expect(result.reduced_rows).toHaveLength(18);
  expect(result.raw_rows.length).toBeGreaterThan(70);
  expect(result.aborted).toBeFalsy();
  expect(result.abort_reason).toBeNull();
  expect(result.reduced_rows.every((row: Record<string, unknown>) => row.trial_id !== undefined)).toBeTruthy();
  expect(
    result.reduced_rows.some((row: Record<string, unknown>) => Boolean(row.target_hit))
  ).toBeTruthy();
  expect(
    result.reduced_rows.some((row: Record<string, unknown>) => Boolean(row.feedback_hit))
  ).toBeTruthy();
  expect(
    result.reduced_rows.some((row: Record<string, unknown>) => Number(row.feedback_delta ?? 0) !== 0)
  ).toBeTruthy();
  expect(
    result.reduced_rows.some((row: Record<string, unknown>) => Boolean(row.target_timeout_triggered))
  ).toBeTruthy();
});

test("MID runtime hides cursor for keyboard mode and supports force quit", async ({ page }) => {
  await page.goto("/?task=H000006-mid");

  await page.locator('input[name="subject_id"]').fill("sub-force-quit");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  await waitForUnit(page, "instruction_text");

  const runtimeCursor = await page.evaluate(() => {
    const runtime = document.querySelector<HTMLElement>("#psyflow-task-runtime");
    if (!runtime) {
      return null;
    }
    return window.getComputedStyle(runtime).cursor;
  });
  expect(runtimeCursor).toBe("none");

  await page.keyboard.down("Control");
  await page.keyboard.press("Q");
  await page.keyboard.up("Control");

  await expect(page.locator("#psyflow-task-results")).toBeVisible();

  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) {
    return;
  }
  expect(result.aborted).toBeTruthy();
  expect(result.abort_reason).toBe("force_quit");
});
