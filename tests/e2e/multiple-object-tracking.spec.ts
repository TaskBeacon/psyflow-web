import { expect, test, type Page } from "@playwright/test";

test.setTimeout(180_000);

async function visible(page: Page) {
  return page.locator("[data-psyflow-unit-label]:visible").first();
}

test("MOT plays canonical video, covers every cell, and exports", async ({ page }) => {
  await page.route("**/*.yaml", async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original
      .replace("trajectory_variants: 3", "trajectory_variants: 1")
      .replace("fixation_duration: 0.5", "fixation_duration: 0.01")
      .replace("cue_duration: 2.0", "cue_duration: 0.01")
      .replace("tracking_duration: 4.0", "tracking_duration: 1.0")
      .replace("response_window: 3.0", "response_window: 0.2")
      .replace("feedback_duration: 0.75", "feedback_duration: 0.01")
      .replace("iti_duration: 0.5", "iti_duration: 0.01");
    await route.fulfill({ response, body });
  });

  await page.goto("/?task=H000071-multiple-object-tracking-task");
  await page.locator('input[name="subject_id"]').fill("171");
  await page.locator('#psyflow-task-form button[type="submit"]').click();
  await page.locator("#psyflow-task-preflight .psyflow-task-button").click();

  let inspectedMovie = false;
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    const current = await visible(page);
    const label = await current.getAttribute("data-psyflow-unit-label");
    if (label === "good_bye") {
      await page.keyboard.press("Space");
      break;
    }
    if (label === "instruction" || label === "practice_summary") {
      await page.keyboard.press("Space");
    } else if (label === "tracking" && !inspectedMovie) {
      const video = current.locator("video");
      await expect(video).toBeVisible();
      await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
      await page.screenshot({ path: "test-results/mot-tracking-stage.png" });
      const before = await video.evaluate((element) => (element as HTMLVideoElement).currentTime);
      await page.waitForTimeout(140);
      const media = await video.evaluate((element) => {
        const movie = element as HTMLVideoElement;
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 48;
        const context = canvas.getContext("2d")!;
        context.drawImage(movie, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let litPixels = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 60) litPixels += 1;
        }
        return { currentTime: movie.currentTime, width: movie.videoWidth, height: movie.videoHeight, litPixels };
      });
      expect(media).toMatchObject({ width: 640, height: 480 });
      expect(media.currentTime).toBeGreaterThan(before);
      expect(media.litPixels).toBeGreaterThan(5);
      inspectedMovie = true;
    } else if (label === "probe") {
      await page.keyboard.press("f");
    } else {
      await page.waitForTimeout(5);
      continue;
    }
    await page.waitForTimeout(5);
  }

  expect(inspectedMovie).toBeTruthy();
  await expect(page.locator("#psyflow-task-results")).toBeVisible();
  const result = await page.evaluate(() => window.__PSYFLOW_WEB_LAST_RESULT__ ?? null);
  expect(result).not.toBeNull();
  if (!result) return;
  const rows = result.reduced_rows as Array<Record<string, unknown>>;
  const scored = rows.filter((row) => row.is_practice === false);
  expect(rows).toHaveLength(18);
  expect(scored).toHaveLength(12);
  for (const targetCount of [2, 4, 6]) {
    for (const speed of ["slow", "fast"]) {
      for (const probeStatus of ["target", "distractor"]) {
        expect(
          scored.filter(
            (row) =>
              Number(row.target_count) === targetCount &&
              row.speed === speed &&
              row.probe_status === probeStatus
          )
        ).toHaveLength(1);
      }
    }
  }
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download reduced.csv" }).click();
  expect((await download).suggestedFilename()).toBe("H000071-multiple-object-tracking-task_reduced.csv");
});
