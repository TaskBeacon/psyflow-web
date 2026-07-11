import { expect, test, type Locator, type Page } from "@playwright/test";

test.setTimeout(90_000);

async function waitForUnit(page: Page, labels: string[], timeout = 12_000): Promise<Locator> {
  const selector = labels.map((label) => `[data-psyflow-unit-label="${label}"]`).join(", ");
  await page.waitForSelector(selector, { timeout, state: "visible" });
  return page.locator(selector).filter({ visible: true }).first();
}

function correctKey(text: string, targetLevel: "global" | "local"): "f" | "j" {
  const lines = text.split("\n").map((line) => line.trimEnd()).filter(Boolean);
  if (targetLevel === "global") return lines[0].includes(" ") ? "f" : "j";
  return text.replace(/\s/g, "")[0] === "H" ? "f" : "j";
}

test("Navon browser task preserves hierarchy, masking, both levels, outcomes, and export", async ({ page }) => {
  let configPatched = false;
  await page.route("**/*", async (route) => {
    if (!route.request().url().toLowerCase().includes(".yaml")) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("total_trials: 72", "total_trials: 24")
      .replace("trial_per_block: 36", "trial_per_block: 12")
      .replace("scored_repetitions_per_identity: 6", "scored_repetitions_per_identity: 2")
      .replace("fixation_duration: 0.5", "fixation_duration: 0.01")
      .replace("stimulus_duration: 0.04", "stimulus_duration: 0.50")
      .replace("response_window: 2.0", "response_window: 1.20")
      .replace("feedback_duration: 0.5", "feedback_duration: 0.01")
      .replace("iti_duration: 0.5", "iti_duration: 0.01");
    configPatched = body.includes("scored_repetitions_per_identity: 2") && body.includes("stimulus_duration: 0.50");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000063-navon-global-local-task");
  await expect.poll(() => configPatched, { timeout: 10_000 }).toBeTruthy();
  await page.locator('input[name="subject_id"]').fill("162");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();
  await page.keyboard.press("Space");

  let compoundCount = 0;
  let targetLevel: "global" | "local" = "global";
  let levelTrialCount = 0;
  let screenshotTaken = false;
  let earlyResponseCovered = false;
  while (!(await page.locator('[data-psyflow-unit-label="good_bye"]').isVisible())) {
    const unit = await waitForUnit(page, ["level_intro_global", "level_intro_local", "compound_stimulus", "level_break", "good_bye"]);
    const label = await unit.getAttribute("data-psyflow-unit-label");
    if (label === "good_bye") break;
    if (label?.startsWith("level_intro") || label === "level_break") {
      if (label === "level_intro_global") {
        targetLevel = "global";
        levelTrialCount = 0;
      } else if (label === "level_intro_local") {
        targetLevel = "local";
        levelTrialCount = 0;
      }
      const handle = await unit.elementHandle();
      await page.keyboard.press("Space");
      await page.waitForFunction((element) => !element?.isConnected, handle, { timeout: 5_000 });
      continue;
    }

    compoundCount += 1;
    levelTrialCount += 1;
    const compoundText = (await unit.textContent()) ?? "";
    expect(compoundText.split("\n").filter((line) => line.trim().length > 0).length).toBeGreaterThanOrEqual(5);
    if (!screenshotTaken && targetLevel === "global" && levelTrialCount === 1) {
      await unit.screenshot({ path: "test-results/navon-compound-stage.png" });
      screenshotTaken = true;
    }
    const visibleStimulus = unit.locator(".psyflow-stage-stim").first();
    const box = await visibleStimulus.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const viewport = page.viewportSize();
      expect(Math.abs(box.x + box.width / 2 - (viewport?.width ?? 1280) / 2)).toBeGreaterThan(15);
    }
    const correct = correctKey(compoundText, targetLevel);
    const wrong = correct === "f" ? "j" : "f";
    const compoundHandle = await unit.elementHandle();
    if (targetLevel === "global" && levelTrialCount === 15) {
      await page.keyboard.press(correct);
      earlyResponseCovered = true;
      await page.waitForFunction((element) => !element?.isConnected, compoundHandle, { timeout: 3_000 });
      continue;
    }
    await page.waitForFunction((element) => !element?.isConnected, compoundHandle, { timeout: 3_000 });
    const mask = await waitForUnit(page, ["postexposure_mask"], 3_000);
    expect(((await mask.textContent()) ?? "").replace(/\s/g, "").length).toBe(33 * 33);
    const maskHandle = await mask.elementHandle();
    if (levelTrialCount === 13) await page.keyboard.press(wrong);
    else if (levelTrialCount !== 14) await page.keyboard.press(correct);
    await page.waitForFunction((element) => !element?.isConnected, maskHandle, { timeout: 3_000 });
  }

  expect(compoundCount).toBeGreaterThanOrEqual(47);
  expect(earlyResponseCovered).toBe(true);
  await page.keyboard.press("Space");
  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  expect(result.aborted).toBeFalsy();
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  const scored = rows.filter((row) => row.is_practice === false);
  expect(scored).toHaveLength(24);
  expect(new Set(scored.map((row) => row.target_level))).toEqual(new Set(["global", "local"]));
  expect(new Set(scored.map((row) => row.consistency))).toEqual(new Set(["consistent", "neutral", "conflicting"]));
  expect(new Set(scored.map((row) => row.position))).toEqual(new Set(["upper_left", "upper_right", "lower_left", "lower_right"]));
  expect(new Set(scored.map((row) => row.outcome))).toEqual(new Set(["correct", "error", "timeout"]));
  expect(scored.filter((row) => row.target_level === "global" && row.outcome === "error")).toHaveLength(1);
  expect(scored.filter((row) => row.target_level === "local" && row.outcome === "timeout")).toHaveLength(1);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("H000063-navon-global-local-task_reduced.csv");
});
