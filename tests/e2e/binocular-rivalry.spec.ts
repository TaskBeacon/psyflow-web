import { expect, test, type Page } from "@playwright/test";

async function currentUnit(page: Page, label: string) {
  return page.locator(`[data-psyflow-unit-label="${label}"]`).filter({ visible: true });
}

async function finishRivalryTrial(page: Page, keys: string[]) {
  const unit = await currentUnit(page, "rivalry_report");
  await unit.waitFor({ state: "visible", timeout: 5_000 });
  const handle = await unit.elementHandle();
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(80);
  }
  await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 5_000 });
}

test("Binocular Rivalry renders calibrated gratings, retains continuous reports, and exports", async ({ page }) => {
  test.setTimeout(45_000);
  await page.route("**/*.yaml", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "timing: {alignment_duration: 2.0, practice_duration: 12.0, rivalry_duration: 120.0, iti_duration: 2.0}",
      "timing: {alignment_duration: 0.2, practice_duration: 0.5, rivalry_duration: 1.2, iti_duration: 0.1}"
    );
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000103-binocular-rivalry");
  const openPreview = page.getByRole("button", { name: "Open preview" });
  if (await openPreview.isVisible()) await openPreview.click();
  await page.locator('input[name="subject_id"]').fill("103");
  await page.locator('input[name="age"]').fill("30");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  await (await currentUnit(page, "instruction")).waitFor({ state: "visible" });
  await page.keyboard.press("Space");
  await (await currentUnit(page, "alignment_check")).waitFor({ state: "visible" });
  await page.keyboard.press("Space");
  await (await currentUnit(page, "practice_instruction")).waitFor({ state: "visible" });
  await page.keyboard.press("Space");
  const practice = await currentUnit(page, "practice_rivalry");
  await practice.waitFor({ state: "visible" });
  const canvas = practice.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveJSProperty("width", 512);
  await page.keyboard.press("f");
  await page.keyboard.press("j");

  await finishRivalryTrial(page, ["f", "Space", "j"]);
  await finishRivalryTrial(page, []);
  const blockBreak = await currentUnit(page, "block_break");
  await blockBreak.waitFor({ state: "visible" });
  await page.keyboard.press("Space");
  await finishRivalryTrial(page, ["j", "f"]);
  await finishRivalryTrial(page, []);

  const goodBye = await currentUnit(page, "good_bye");
  await goodBye.waitFor({ state: "visible" });
  await expect(goodBye).toContainText("共记录 5 次知觉报告");
  await page.keyboard.press("Space");
  await expect(page.locator("#psyflow-task-results")).toBeVisible();

  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  expect(rows).toHaveLength(4);
  expect(rows.map((row) => row.report_count)).toEqual([3, 0, 2, 0]);
  expect(rows.map((row) => row.outcome)).toEqual(["reported", "no_report", "reported", "no_report"]);
  expect(rows.map((row) => JSON.parse(String(row.report_sequence_json)))).toEqual([
    ["f", "space", "j"],
    [],
    ["j", "f"],
    []
  ]);
  expect(rows.filter((row) => row.condition === "red_left_cyan_right")).toHaveLength(2);
  expect(rows.filter((row) => row.condition === "red_right_cyan_left")).toHaveLength(2);

  for (const [label, filename] of [
    ["Download raw.jsonl", "H000103-binocular-rivalry_raw.jsonl"],
    ["Download reduced.csv", "H000103-binocular-rivalry_reduced.csv"],
    ["Download reduced.json", "H000103-binocular-rivalry_reduced.json"]
  ] as const) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: label }).click();
    expect((await download).suggestedFilename()).toBe(filename);
  }
});
