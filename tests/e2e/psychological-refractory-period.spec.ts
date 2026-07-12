import { expect, test, type Page } from "@playwright/test";

test.setTimeout(180_000);

async function visible(page: Page) {
  return page.locator("[data-psyflow-unit-label]:visible").first();
}

test("PRP runs five SOAs and exports", async ({ page }) => {
  await page.route("**/*.yaml", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("scored_repetitions_per_cell: 8", "scored_repetitions_per_cell: 1")
      .replace("fixation_duration: 0.5", "fixation_duration: 0.01")
      .replace("iti_duration: 0.5", "iti_duration: 0.01");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000070-psychological-refractory-period-task");
  await page.locator('input[name="subject_id"]').fill("170");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    const current = await visible(page);
    const label = await current.getAttribute("data-psyflow-unit-label");
    if (label === "good_bye") {
      await page.keyboard.press("Space");
      break;
    }
    if (label === "instruction" || label === "practice_summary") await page.keyboard.press("Space");
    else if (label === "s1_soa" || label === "late_task1_response") await page.keyboard.press("f");
    else if (label === "task2_response" || label === "late_task2_response") await page.keyboard.press("k");
    else {
      await page.waitForTimeout(10);
      continue;
    }
    await page.waitForTimeout(5);
  }

  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  const scored = rows.filter((row) => row.is_practice === false);
  expect(rows).toHaveLength(40);
  expect(scored).toHaveLength(20);
  for (const soa of [50, 150, 300, 600, 1000]) {
    expect(scored.filter((row) => Number(row.soa_ms) === soa)).toHaveLength(4);
  }
  expect(rows.every((row) => row.response_order === "R1-R2")).toBeTruthy();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await download).suggestedFilename()).toBe("H000070-psychological-refractory-period-task_reduced.csv");
});
