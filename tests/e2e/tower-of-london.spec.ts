import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);

async function visible(page: Page) {
  return page.locator("[data-psyflow-unit-label]:visible").first();
}

function moveKeyFromImage(source: string): string {
  const match = source.match(/\/(?:P|M)([2-5])(?:_|\.png)/);
  if (!match) throw new Error(`Cannot infer move load from ${source}`);
  return match[1];
}

test("Tower of London preserves boards, loads, outcomes, and export", async ({
  page
}) => {
  await page.route("**/*.yaml", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("total_trials: 28", "total_trials: 8")
      .replace("trial_per_block: 14", "trial_per_block: 4")
      .replace("scored_per_load_limit: 6", "scored_per_load_limit: 1")
      .replace("fixation_duration: 0.5", "fixation_duration: 0.01")
      .replace("goal_preview_duration: 5.0", "goal_preview_duration: 0.01")
      .replace("planning_window: 15.0", "planning_window: 0.20")
      .replace("choice_window: 5.0", "choice_window: 0.20")
      .replace(
        "practice_feedback_duration: 0.75",
        "practice_feedback_duration: 0.01"
      )
      .replace("iti_duration: 0.75", "iti_duration: 0.01");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000074-tower-of-london-task");
  await page.locator('input[name="subject_id"]').fill("174");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  let planningCount = 0;
  let choiceCount = 0;
  const deadline = Date.now() + 80_000;
  while (Date.now() < deadline) {
    const current = await visible(page);
    const label = await current.getAttribute("data-psyflow-unit-label");
    if (label === "good_bye") {
      await page.keyboard.press("Space");
      break;
    }
    if (label === "instruction" || label === "practice_summary") {
      await page.keyboard.press("Space");
    } else if (label === "planning") {
      if (planningCount === 0) {
        await current.screenshot({
          path: "test-results/tower-of-london-planning.png"
        });
      }
      await page.keyboard.press("Space");
      planningCount += 1;
    } else if (label === "choice") {
      const source =
        (await current.locator("img").first().getAttribute("src")) ?? "";
      const correctKey = moveKeyFromImage(source);
      if (choiceCount === 0) {
        await current.screenshot({
          path: "test-results/tower-of-london-choice.png"
        });
        const handle = await current.elementHandle();
        await page.waitForFunction((element) => !element?.isConnected, handle, {
          timeout: 2000
        });
      } else if (choiceCount === 1) {
        await page.keyboard.press(correctKey === "2" ? "3" : "2");
      } else {
        await page.keyboard.press(correctKey);
      }
      choiceCount += 1;
    } else {
      await page.waitForTimeout(5);
      continue;
    }
    await page.waitForTimeout(5);
  }

  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(
    () => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null
  );
  expect(result).not.toBeNull();
  if (!result) return;
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  const scored = rows.filter((row) => row.is_practice === false);
  expect(rows).toHaveLength(8);
  expect(scored).toHaveLength(4);
  expect(new Set(rows.map((row) => row.outcome))).toEqual(
    new Set(["correct", "incorrect", "timeout"])
  );
  expect(new Set(scored.map((row) => row.condition))).toEqual(
    new Set(["moves2", "moves3", "moves4", "moves5"])
  );
  expect(rows.every((row) => row.plan_ready === true)).toBeTruthy();
  expect(rows.every((row) => Number.isFinite(Number(row.planning_rt))))
    .toBeTruthy();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await download).suggestedFilename()).toBe(
    "H000074-tower-of-london-task_reduced.csv"
  );
});
