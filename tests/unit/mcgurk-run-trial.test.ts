import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder, type TrialSnapshot } from "../../src";
import { Controller } from "../../../H000026-mcgurk/src/controller";
import { run_trial } from "../../../H000026-mcgurk/src/run_trial";

describe("H000026 mcgurk trial", () => {
  it("preserves canonical McGurk triggers and response semantics", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["congruent", "incongruent", "audio_only"],
      key_list: ["f", "j", "k", "space"],
      ba_key: "f",
      da_key: "j",
      ga_key: "k",
      fixation_duration: [0.5, 0.8],
      av_duration: 1.1,
      decision_deadline: 1.8,
      feedback_duration: 0.7,
      iti_duration: [0.5, 0.9]
    });
    settings.triggers = {
      fixation_onset: 20,
      incongruent_av_onset: 31,
      incongruent_decision_onset: 41,
      response_ba: 50,
      response_da: 51,
      response_ga: 52,
      incongruent_no_response: 61,
      response_recorded_fb_onset: 70,
      timeout_fb_onset: 71,
      iti_onset: 80
    };
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      avatar_face: { type: "circle", radius: 1 },
      eye_left: { type: "circle", radius: 1 },
      eye_right: { type: "circle", radius: 1 },
      nose: { type: "shape", size: 1, vertices: [[0, 0]] },
      mouth_ba: { type: "text", text: "ba mouth" },
      speech_prompt: { type: "text", text: "listen" },
      audio_ga: { type: "sound", file: "ga.wav" },
      decision_prompt: { type: "text", text: "?" },
      key_hint: { type: "text", text: "{ba_key}/{da_key}/{ga_key}" },
      feedback_recorded: { type: "text", text: "{reported_syllable}/{response_key}" },
      feedback_timeout: { type: "text", text: "timeout" }
    });
    const controller = Controller.from_dict({
      syllables: ["ba", "da", "ga"],
      incongruent_pairs: [
        ["ba", "ga"],
        ["ga", "ba"]
      ],
      random_seed: null,
      enable_logging: false
    });
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "incongruent"
    });

    run_trial(
      trial,
      JSON.stringify({
        condition: "incongruent",
        audio_syllable: "ga",
        visual_syllable: "ba",
        expected_percept: "da"
      }),
      {
        settings,
        stimBank,
        controller,
        block_id: "block_0",
        block_idx: 0
      }
    );

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "fixation",
      "av_stimulus",
      "decision",
      "feedback",
      "inter_trial_interval"
    ]);
    expect(compiled.units[0].onset_trigger).toBe(20);
    expect(compiled.units[1].onset_trigger).toBe(31);
    expect(compiled.units[2].onset_trigger).toBe(41);
    expect(compiled.units[4].onset_trigger).toBe(80);
    expect(compiled.units[2].response_cfg).toMatchObject({
      response_trigger: { f: 50, j: 51, k: 52 },
      timeout_trigger: 61
    });

    const daSnapshot = {
      units: {
        decision: { response: "j", response_key: "j", reported_syllable: "da", timed_out: false }
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[2].state_patch?.reported_syllable as (snapshot: TrialSnapshot) => string)(daSnapshot)).toBe(
      "da"
    );
    expect((compiled.units[2].state_patch?.fusion_da as (snapshot: TrialSnapshot) => boolean)(daSnapshot)).toBe(true);
    expect((compiled.units[3].onset_trigger as (snapshot: TrialSnapshot) => number)(daSnapshot)).toBe(70);
    expect((compiled.units[3].context?.stim_id as (snapshot: TrialSnapshot) => string)(daSnapshot)).toBe(
      "feedback_recorded"
    );

    const timeoutSnapshot = {
      units: {
        decision: { timed_out: true }
      }
    } as unknown as TrialSnapshot;
    expect((compiled.units[3].onset_trigger as (snapshot: TrialSnapshot) => number)(timeoutSnapshot)).toBe(71);
    expect((compiled.units[3].context?.stim_id as (snapshot: TrialSnapshot) => string)(timeoutSnapshot)).toBe(
      "feedback_timeout"
    );
  });
});
