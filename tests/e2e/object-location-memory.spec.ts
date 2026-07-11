import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(120_000);

const objectCodes: Record<string, string> = {
  BANANA: "BA", BELL: "BE", BOOK: "BO", LETTER: "LE", "PAPER CLIP": "CL", CUPBOARD: "CU",
  TREE: "TR", CLOCK: "CK", "LIGHT BULB": "BU", UMBRELLA: "UM", TELEPHONE: "PH", AIRPLANE: "PL",
  PENCIL: "PE", KEY: "KE", PADLOCK: "LO", "TRASH CAN": "BI", "WATER TAP": "TA", BICYCLE: "BC", MAGNET: "MA"
};

async function waitForUnit(page: Page, unitLabel: string, timeout = 12_000): Promise<Locator> {
  await page.waitForSelector(`[data-psyflow-unit-label="${unitLabel}"]`, { timeout, state: "visible" });
  return page.locator(`[data-psyflow-unit-label="${unitLabel}"]`).first();
}

async function pressAndReplace(page: Page, unit: Locator, key: string): Promise<void> {
  const handle = await unit.elementHandle();
  await page.keyboard.press(key);
  await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 5_000 });
}

function gridCells(text: string): string[] {
  return text.split("\n").filter((line) => line.trim().startsWith("|")).flatMap((line) => line.split("|").slice(1, -1).map((value) => value.trim()));
}

async function answerArray(page: Page, makeFirstError = false, screenshot = false): Promise<void> {
  for (let queryIndex = 0; queryIndex < 10; queryIndex += 1) {
    const unit = await waitForUnit(page, `assignment_${String(queryIndex + 1).padStart(2, "0")}`);
    const recallText = (await unit.textContent()) ?? "";
    const query = recallText.match(/Which position contained ([A-Z ]+)\?/i)?.[1]?.toUpperCase();
    expect(query).toBeTruthy();
    const studyText = await page.evaluate(() => (window as unknown as { __OLM_STUDY__?: string }).__OLM_STUDY__ ?? "");
    const code = objectCodes[query ?? ""];
    expect(code).toBeTruthy();
    const studyCells = gridCells(studyText);
    const recallCells = gridCells(recallText);
    const cellIndex = studyCells.indexOf(code);
    expect(cellIndex).toBeGreaterThanOrEqual(0);
    const correct = recallCells[cellIndex];
    expect(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]).toContain(correct);
    if (screenshot && queryIndex === 0) await page.screenshot({ path: "test-results/object-location-memory-assignment.png", fullPage: true });
    const response = makeFirstError && queryIndex === 0 ? (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].find((key) => key !== correct) ?? "0") : correct;
    await pressAndReplace(page, unit, response);
  }
}

test("Object-Location Memory browser task runs both conditions, hit/miss scoring, and export", async ({ page }) => {
  let configPatched = false;
  await page.route("**/*", async (route) => {
    if (!route.request().url().toLowerCase().includes(".yaml")) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("total_trials: 4", "total_trials: 2")
      .replace("trial_per_block: 2", "trial_per_block: 1")
      .replace("fixation_duration: 0.500", "fixation_duration: 0.050")
      .replace("study_duration: 30.000", "study_duration: 0.100")
      .replace("retention_duration: 0.500", "retention_duration: 0.050")
      .replace("assignment_window: 10.000", "assignment_window: 2.000")
      .replace("practice_feedback_duration: 1.500", "practice_feedback_duration: 0.100")
      .replace("iti_duration: 0.500", "iti_duration: 0.050");
    configPatched = body.includes("trial_per_block: 1") && body.includes("study_duration: 0.100");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000059-object-location-memory");
  await expect.poll(() => configPatched, { timeout: 10_000 }).toBeTruthy();
  await page.locator('input[name="subject_id"]').fill("159");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();
  await pressAndReplace(page, await waitForUnit(page, "instruction"), "Space");

  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const study = document.querySelector('[data-psyflow-unit-label="study"]');
      if (study) (window as unknown as { __OLM_STUDY__?: string }).__OLM_STUDY__ = study.textContent ?? "";
    });
    observer.observe(document.querySelector("#psyflow-task-runtime")!, { childList: true, subtree: true });
  });

  await pressAndReplace(page, await waitForUnit(page, "suppression_intro"), "Space");
  await answerArray(page, false, true);
  const firstFeedback = await page.waitForSelector('[data-psyflow-unit-label="practice_feedback"]', { timeout: 4_000, state: "visible" });
  await page.waitForFunction((element) => !element?.isConnected, firstFeedback, { timeout: 4_000 });
  await answerArray(page, true);
  await pressAndReplace(page, await waitForUnit(page, "block_summary"), "Space");

  await pressAndReplace(page, await waitForUnit(page, "silent_intro"), "Space");
  await answerArray(page);
  const secondFeedback = await page.waitForSelector('[data-psyflow-unit-label="practice_feedback"]', { timeout: 4_000, state: "visible" });
  await page.waitForFunction((element) => !element?.isConnected, secondFeedback, { timeout: 4_000 });
  await answerArray(page);

  await pressAndReplace(page, await waitForUnit(page, "good_bye"), "Space");
  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  expect(result.aborted).toBeFalsy();
  expect(result.reduced_rows).toHaveLength(4);
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  expect(rows.filter((row) => row.is_practice === true)).toHaveLength(2);
  const scored = rows.filter((row) => row.is_practice === false);
  expect(scored).toHaveLength(2);
  expect(new Set(scored.map((row) => row.condition))).toEqual(new Set(["suppression", "silent"]));
  expect(scored.some((row) => row.correct_assignments === 9 && row.mislocated_percentage === 10)).toBeTruthy();
  expect(scored.some((row) => row.correct_assignments === 10 && row.assignment_accuracy === 1)).toBeTruthy();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("H000059-object-location-memory_reduced.csv");
});

