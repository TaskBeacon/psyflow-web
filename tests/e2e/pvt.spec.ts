import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(180_000);

async function waitForUnit(page: Page, unitLabel: string, timeout = 15_000): Promise<Locator> {
  await page.waitForSelector(`[data-psyflow-unit-label="${unitLabel}"]`, {
    timeout,
    state: "visible"
  });
  return page.locator(`[data-psyflow-unit-label="${unitLabel}"]`).first();
}

async function completeSubInfo(page: Page): Promise<void> {
  await page.locator('input[name="subject_id"]').fill("156");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();
}

async function pressUntilReplaced(page: Page, locator: Locator, key: string): Promise<void> {
  const handle = await locator.elementHandle();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press(key);
    await page.waitForTimeout(120);
    const replaced = await page.evaluate((element) => !element?.isConnected, handle);
    if (replaced) return;
  }
  await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 5_000 });
}

test("PVT preview preserves counter timing, false starts, lapses, and exports", async ({ page }) => {
  await page.route("**/config/config.yaml", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace("total_trials: 90", "total_trials: 12")
      .replace("trial_per_block: 90", "trial_per_block: 12");
    await route.fulfill({ response, body });
  });
  await page.goto("/?task=H000056-psychomotor-vigilance-task");
  await completeSubInfo(page);
  await waitForUnit(page, "instruction");
  await page.keyboard.press("Space");

  let madePrematureResponse = false;
  let checkedCounter = false;
  let madeLapse = false;

  while (true) {
    const currentUnit = await page.evaluate(
      () => document.querySelector("[data-psyflow-unit-label]")?.getAttribute("data-psyflow-unit-label") ?? ""
    );

    if (currentUnit === "good_bye") {
      break;
    }

    if (currentUnit === "isi" && !madePrematureResponse) {
      const isi = await waitForUnit(page, "isi");
      await page.waitForTimeout(100);
      await pressUntilReplaced(page, isi, "Space");
      madePrematureResponse = true;
      continue;
    }

    if (currentUnit === "target") {
      const target = await waitForUnit(page, "target");
      const counter = target.locator('[data-psyflow-dynamic-text="elapsed_ms"]');
      await expect(counter).toHaveText(/^\d{5}$/);
      const counterBox = await counter.boundingBox();
      const targetBox = await target.boundingBox();
      expect(counterBox).not.toBeNull();
      expect(targetBox).not.toBeNull();
      if (counterBox && targetBox) {
        expect(counterBox.width).toBeLessThan(targetBox.width * 0.8);
        expect(counterBox.height).toBeLessThan(targetBox.height * 0.4);
      }
      if (!checkedCounter) {
        await page.waitForTimeout(120);
        expect(Number(await counter.textContent())).toBeGreaterThan(0);
        await page.screenshot({ path: "test-results/pvt-target.png", fullPage: true });
        checkedCounter = true;
      }
      if (!madeLapse) {
        await page.waitForTimeout(650);
        madeLapse = true;
      } else {
        await page.waitForTimeout(250);
      }
      await pressUntilReplaced(page, target, "Space");
      const feedback = await page.waitForSelector('[data-psyflow-unit-label="feedback"]', {
        timeout: 2_000,
        state: "visible"
      });
      expect(await feedback.textContent()).toContain("ms");
      await page.waitForFunction((element) => !element?.isConnected, feedback);
      continue;
    }

    await page.waitForTimeout(25);
  }

  await waitForUnit(page, "good_bye", 5_000);
  await page.keyboard.press("Space");
  await expect(page.locator("#psyflow-task-results")).toBeVisible();

  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  expect(result.aborted).toBeFalsy();
  expect(result.reduced_rows).toHaveLength(12);
  expect(result.reduced_rows.filter((row: Record<string, unknown>) => row.condition === "standard")).toHaveLength(12);
  expect(result.reduced_rows.some((row: Record<string, unknown>) => row.false_start === true)).toBeTruthy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => row.valid_response === true)).toBeTruthy();
  expect(result.reduced_rows.some((row: Record<string, unknown>) => row.lapse === true)).toBeTruthy();
  expect(result.reduced_rows.every((row: Record<string, unknown>) => row.outcome !== undefined)).toBeTruthy();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("H000056-psychomotor-vigilance-task_reduced.csv");
});
