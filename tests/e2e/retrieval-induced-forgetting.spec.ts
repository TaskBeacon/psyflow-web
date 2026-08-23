import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

const bank: Record<string, Record<string, string>> = {
  水果: { 苹: "苹果", 香: "香蕉", 橙: "橙子", 葡: "葡萄" },
  动物: { 老: "老虎", 狮: "狮子", 大: "大象", 猴: "猴子" },
  乐器: { 钢: "钢琴", 小: "小提琴", 吉: "吉他", 长: "长笛" },
  颜色: { 红: "红色", 蓝: "蓝色", 绿: "绿色", 黄: "黄色" }
};

function answerFor(screenText: string): string {
  const category = Object.keys(bank).find((value) => screenText.includes(value));
  if (!category) throw new Error(`Missing category in ${screenText}`);
  const initial = Object.keys(bank[category]).find((value) => screenText.includes(`${value}＿`));
  if (!initial) throw new Error(`Missing cue in ${screenText}`);
  return bank[category][initial];
}

test("Retrieval-Induced Forgetting supports Chinese typed hit/miss recall and exports", async ({ page }) => {
  await page.route("**/*.yaml", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace("total_trials: 252", "total_trials: 40")
      .replace("trial_per_block: 63", "trial_per_block: 10")
      .replace("trials_per_block: 63", "trials_per_block: 10")
      .replace("category_count: 8", "category_count: 4")
      .replace("items_per_category: 6", "items_per_category: 4")
      .replace("practiced_category_count: 4", "practiced_category_count: 2")
      .replace("practiced_items_per_category: 3", "practiced_items_per_category: 2")
      .replace("practice_repetitions: 3", "practice_repetitions: 1")
      .replace("distractor_trials: 120", "distractor_trials: 4")
      .replace("study_duration_s: 5.0", "study_duration_s: 0.05")
      .replace("practice_response_window_s: 10.0", "practice_response_window_s: 0.50")
      .replace("distractor_trial_duration_s: 10.0", "distractor_trial_duration_s: 0.40")
      .replace("final_test_response_window_s: 7.0", "final_test_response_window_s: 0.50");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000090-retrieval-induced-forgetting");
  await page.locator('input[name="subject_id"]').fill("190");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();
  await page.keyboard.press("Space");
  await page.locator('[data-psyflow-unit-label="study_instruction"]').waitFor({ state: "visible" });
  await page.keyboard.press("Space");

  await page.locator('[data-psyflow-unit-label="retrieval_practice_instruction"]').waitFor({ state: "visible" });
  await page.keyboard.press("Space");
  for (let index = 0; index < 4; index += 1) {
    const screen = page.locator('[data-psyflow-unit-label="practice_cue"]').filter({ visible: true });
    await screen.waitFor({ state: "visible" });
    if (index === 0) await screen.screenshot({ path: "test-results/rif-practice.png" });
    const expected = answerFor((await screen.textContent()) ?? "");
    await screen.locator('input[data-psyflow-text-entry="true"]').fill(index === 0 ? "错误" : expected);
    const handle = await screen.elementHandle();
    await page.keyboard.press("Enter");
    await page.waitForFunction((element) => !element?.isConnected, handle);
  }

  await page.locator('[data-psyflow-unit-label="distractor_instruction"]').waitFor({ state: "visible" });
  await page.keyboard.press("Space");
  for (let index = 0; index < 4; index += 1) {
    const problem = page.locator('[data-psyflow-unit-label="distractor_problem"]').filter({ visible: true });
    await problem.waitFor({ state: "visible" });
    const handle = await problem.elementHandle();
    await page.keyboard.press(index % 2 === 0 ? "f" : "j");
    await page.waitForFunction((element) => !element?.isConnected, handle);
  }

  await page.locator('[data-psyflow-unit-label="final_test_instruction"]').waitFor({ state: "visible" });
  await page.keyboard.press("Space");
  for (let index = 0; index < 16; index += 1) {
    const screen = page.locator('[data-psyflow-unit-label="final_test_cue"]').filter({ visible: true });
    await screen.waitFor({ state: "visible" });
    if (index === 0) await screen.screenshot({ path: "test-results/rif-final-test.png" });
    const expected = answerFor((await screen.textContent()) ?? "");
    await screen.locator('input[data-psyflow-text-entry="true"]').fill(index === 0 ? "错误" : expected);
    const handle = await screen.elementHandle();
    await page.keyboard.press("Enter");
    await page.waitForFunction((element) => !element?.isConnected, handle);
  }

  await page.locator('[data-psyflow-unit-label="good_bye"]').waitFor({ state: "visible" });
  await page.keyboard.press("Space");
  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  expect(rows.filter((row) => row.stage === "study")).toHaveLength(16);
  expect(rows.filter((row) => row.stage === "retrieval_practice")).toHaveLength(4);
  expect(rows.filter((row) => row.stage === "distractor")).toHaveLength(4);
  const finalRows = rows.filter((row) => row.stage === "final_test");
  expect(finalRows).toHaveLength(16);
  expect(finalRows.filter((row) => row.response_correct === true)).toHaveLength(15);
  expect(finalRows.filter((row) => row.response_correct === false)).toHaveLength(1);
  expect(finalRows[0].response_text).toBe("错误");
  expect(new Set(finalRows.map((row) => row.response_key))).toEqual(new Set(["return"]));
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await download).suggestedFilename()).toBe("H000090-retrieval-induced-forgetting_reduced.csv");
});
