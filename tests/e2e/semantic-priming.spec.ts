import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);

async function visible(page: Page) {
  return page.locator("[data-psyflow-unit-label]:visible").first();
}

test("Semantic Priming preserves SOA, outcomes, counterbalance, and export", async ({
  page
}) => {
  await page.route("**/*.yaml", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("total_trials: 54", "total_trials: 10")
      .replace("trial_per_block: 27", "trial_per_block: 5")
      .replace("scored_item_limit: 24", "scored_item_limit: 2")
      .replace("fixation_duration: 0.5", "fixation_duration: 0.01")
      .replace("prime_duration: 0.15", "prime_duration: 0.03")
      .replace("isi_duration: 0.05", "isi_duration: 0.01")
      .replace("response_window: 3.0", "response_window: 0.20")
      .replace("feedback_duration: 0.5", "feedback_duration: 0.01")
      .replace("iti_duration: 1.5", "iti_duration: 0.01");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000072-semantic-priming-task");
  await page.locator('input[name="subject_id"]').fill("172");
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
      const handle = await current.elementHandle();
      if (targetCount === 0) {
        await current.screenshot({
          path: "test-results/semantic-priming-target.png"
        });
        await page.waitForFunction((element) => !element?.isConnected, handle, {
          timeout: 2000
        });
      } else {
        await page.keyboard.press("f");
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
  expect(rows).toHaveLength(10);
  expect(scored).toHaveLength(4);
  expect(new Set(rows.map((row) => row.outcome))).toEqual(
    new Set(["correct", "incorrect", "timeout"])
  );
  expect(rows.every((row) => row.counterbalance_list === "B")).toBeTruthy();
  expect(
    rows.every((row) =>
      ["word_related", "word_unrelated", "nonword_none"].includes(
        String(row.condition)
      )
    )
  ).toBeTruthy();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await download).suggestedFilename()).toBe(
    "H000072-semantic-priming-task_reduced.csv"
  );
});
