import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);

async function visible(page: Page) {
  return page.locator("[data-psyflow-unit-label]:visible").first();
}

test("Gaze Cueing preserves conditions, outcomes, assets, and export", async ({
  page
}) => {
  await page.route("**/*.yaml", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("total_trials: 54", "total_trials: 12")
      .replace("trial_per_block: 27", "trial_per_block: 6")
      .replace("compact_scored: false", "compact_scored: true")
      .replace("fixation_duration: 0.675", "fixation_duration: 0.01")
      .replace("face_preview_duration: 0.9", "face_preview_duration: 0.01")
      .replace("response_window: 3.8", "response_window: 0.20")
      .replace("feedback_duration: 0.675", "feedback_duration: 0.01");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000073-gaze-cueing-task");
  await page.locator('input[name="subject_id"]').fill("173");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  let targetCount = 0;
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
    } else if (label === "target") {
      const text = (await current.textContent()) ?? "";
      const correctKey = text.includes("T") ? "h" : "Space";
      if (targetCount === 0) {
        await current.screenshot({
          path: "test-results/gaze-cueing-target.png"
        });
        const handle = await current.elementHandle();
        await page.waitForFunction((element) => !element?.isConnected, handle, {
          timeout: 2000
        });
      } else if (targetCount === 1) {
        await page.keyboard.press(correctKey === "h" ? "Space" : "h");
      } else {
        await page.keyboard.press(correctKey);
      }
      targetCount += 1;
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
  expect(rows).toHaveLength(12);
  expect(scored).toHaveLength(6);
  expect(new Set(rows.map((row) => row.outcome))).toEqual(
    new Set(["correct", "incorrect", "timeout"])
  );
  expect(new Set(scored.map((row) => row.condition))).toEqual(
    new Set([
      "congruent_soa100",
      "incongruent_soa100",
      "congruent_soa300",
      "incongruent_soa300",
      "congruent_soa700",
      "incongruent_soa700"
    ])
  );
  expect(
    rows.every((row) =>
      row.validity === "congruent"
        ? row.gaze_direction === row.target_side
        : row.gaze_direction !== row.target_side
    )
  ).toBeTruthy();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await download).suggestedFilename()).toBe(
    "H000073-gaze-cueing-task_reduced.csv"
  );
});
