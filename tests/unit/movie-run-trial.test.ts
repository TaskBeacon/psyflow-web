import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import { run_trial } from "../../../H000007-movie/src/run_trial";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("H000007 movie trial", () => {
  it("uses the canonical movie asset filename", () => {
    const config = parse(
      readFileSync(path.join(repoRoot, "H000007-movie/config/config.yaml"), "utf8")
    ) as { stimuli: { movie: { filename: string } } };

    expect(config.stimuli.movie.filename).toBe("assets/reference_movie.mp4");
  });

  it("preserves movie playback context and offset trigger metadata", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["movie"],
      key_list: ["space"],
      pre_movie_fixation_duration: 0.05,
      movie_lead_in_duration: 0.05,
      movie_duration: 4
    });
    settings.triggers = {
      movie_offset: 2
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      movie: { type: "movie", filename: "assets/reference_movie.mp4" }
    });
    const trial = new TrialBuilder({
      trial_id: "movie_1",
      block_id: "block_0",
      trial_index: 0,
      condition: "movie"
    });

    run_trial(trial, "movie", {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_movie_fixation",
      "movie_lead_in",
      "movie_playback"
    ]);
    expect(compiled.units[2].response_cfg).toMatchObject({
      keys: [],
      timeout_trigger: 2,
      terminate_on_response: false
    });
  });
});
