import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(45_000);

async function waitForUnit(page: Page, label: string, timeout = 5_000): Promise<Locator> {
  await page.waitForSelector(`[data-psyflow-unit-label="${label}"]`, { state: "visible", timeout });
  return page.locator(`[data-psyflow-unit-label="${label}"]`).first();
}

async function pressAndReplace(page: Page, unit: Locator, key = "Space") {
  const handle = await unit.elementHandle();
  await page.keyboard.press(key);
  await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 5_000 });
}

async function tracePath(page: Page, transform: "identity" | "mirror_x", withError = false) {
  const unit = await waitForUnit(page, "tracing");
  const handle = await unit.elementHandle();
  const displayPoints = await unit.locator('[data-psyflow-trace-surface="true"]').evaluate((svg) => {
    const rect = svg.getBoundingClientRect();
    return (svg.querySelector("polyline")?.getAttribute("points") ?? "").trim().split(/\s+/).map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x: rect.left + x, y: rect.top + y };
    });
  });
  const centerX = displayPoints[0].x;
  const physical = displayPoints.map((point) => ({
    x: transform === "mirror_x" ? 2 * centerX - point.x : point.x,
    y: point.y
  }));
  await page.mouse.move(physical[0].x, physical[0].y);
  await page.mouse.down();
  for (let index = 1; index < physical.length; index += 1) {
    if (withError && index === 5) {
      await page.mouse.move(centerX, (displayPoints[0].y + displayPoints[6].y) / 2, { steps: 4 });
      await expect(unit.locator('[data-psyflow-trace-cursor="true"]')).toHaveAttribute("fill", "#ef4444");
    }
    await page.mouse.move(physical[index].x, physical[index].y, { steps: 5 });
    if (index === 1) await page.waitForTimeout(60);
  }
  await page.mouse.up();
  await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 5_000 });
}

test("Mirror Tracing runs complete, excursion, timeout, and export", async ({ page }) => {
  let configPatched = false;
  await page.route("**/*.yaml", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace("total_blocks: 3", "total_blocks: 1")
      .replace("total_trials: 30", "total_trials: 2")
      .replace("trial_per_block: 10", "trial_per_block: 2")
      .replace("trace_deadline_s: 60.0", "trace_deadline_s: 2.0")
      .replace("feedback_duration: 1.5", "feedback_duration: 0.05")
      .replace("iti_duration: 0.75", "iti_duration: 0.03");
    configPatched = body.includes("total_trials: 2") && body.includes("trace_deadline_s: 2.0");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000101-mirror-tracing");
  await expect.poll(() => configPatched, { timeout: 10_000 }).toBeTruthy();
  await page.locator('input[name="subject_id"]').fill("101");
  await page.locator('input[name="age"]').fill("25");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  await pressAndReplace(page, await waitForUnit(page, "instruction"));
  await tracePath(page, "identity");
  await pressAndReplace(page, await waitForUnit(page, "scored_instruction"));
  await tracePath(page, "mirror_x", true);
  const timeoutStage = await waitForUnit(page, "tracing");
  const timeoutHandle = await timeoutStage.elementHandle();
  await page.waitForFunction((element) => !element?.isConnected, timeoutHandle, { timeout: 4_000 });
  await pressAndReplace(page, await waitForUnit(page, "good_bye"));

  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatchObject({ condition: "normal_practice", completed: true, outcome: "complete" });
  expect(rows[1]).toMatchObject({ condition: "mirror", completed: true, outcome: "complete" });
  expect(Number(rows[1].error_excursions)).toBeGreaterThanOrEqual(1);
  expect(rows[2]).toMatchObject({ condition: "mirror", completed: false, timed_out: true, outcome: "timeout" });
  expect(rows.every((row) => Array.isArray(row.tracing_physical_positions))).toBeTruthy();
  expect(rows.every((row) => Array.isArray(row.tracing_display_positions))).toBeTruthy();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await download).suggestedFilename()).toBe("H000101-mirror-tracing_reduced.csv");
});
