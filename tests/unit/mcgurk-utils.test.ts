import { describe, expect, it } from "vitest";

import {
  generate_mcgurk_conditions,
  parse_mcgurk_condition,
  summarizeBlock
} from "../../../H000026-mcgurk/src/utils";

describe("H000026 mcgurk utils", () => {
  it("matches canonical Python concrete McGurk condition generation", () => {
    const decoded = generate_mcgurk_conditions(
      6,
      ["congruent", "incongruent", "audio_only"],
      ["ba", "da", "ga"],
      [
        ["ba", "ga"],
        ["ga", "ba"]
      ],
      2025
    ).map(parse_mcgurk_condition);

    expect(decoded).toEqual([
      { condition: "incongruent", audio_syllable: "ga", visual_syllable: "ba", expected_percept: "da" },
      { condition: "audio_only", audio_syllable: "da", visual_syllable: "none", expected_percept: "da" },
      { condition: "audio_only", audio_syllable: "ga", visual_syllable: "none", expected_percept: "ga" },
      { condition: "congruent", audio_syllable: "ba", visual_syllable: "ba", expected_percept: "ba" },
      { condition: "congruent", audio_syllable: "ba", visual_syllable: "ba", expected_percept: "ba" },
      { condition: "incongruent", audio_syllable: "ga", visual_syllable: "ba", expected_percept: "da" }
    ]);
  });

  it("keeps summary rates numeric for canonical percent formatting", () => {
    expect(
      summarizeBlock(
        [
          {
            block_id: "block_0",
            condition: "incongruent",
            decision_timed_out: false,
            reported_syllable: "da",
            decision_rt: 0.42
          },
          {
            block_id: "block_0",
            condition: "congruent",
            decision_timed_out: false,
            reported_syllable: "ba",
            decision_rt: 0.38
          },
          {
            block_id: "block_0",
            condition: "audio_only",
            decision_timed_out: true,
            reported_syllable: "none",
            decision_rt: null
          }
        ],
        "block_0"
      )
    ).toEqual({
      total_trials: 3,
      responded_trials: 2,
      incongruent_responded: 1,
      response_rate: 2 / 3,
      fusion_rate: 1,
      ba_rate: 0.5,
      da_rate: 0.5,
      ga_rate: 0,
      mean_rt_ms: 400
    });
  });
});
