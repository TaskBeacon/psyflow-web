import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import { run_trial } from "../../../H000010-rest/src/run_trial";

describe("H000010 rest trial", () => {
  it("preserves rest-window context and condition offset trigger metadata", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 4,
      trial_per_block: 4,
      conditions: ["EC", "EO"],
      key_list: ["space"],
      instruction_duration: 4,
      EC_duration: 180,
      EO_duration: 180
    });
    settings.triggers = {
      EC_offset: 11,
      EO_offset: 21
    };
    const stimBank = new StimBank({
      EC_instruction: { type: "text", text: "close eyes" },
      EC_instruction_voice: { type: "sound", file: "ec.mp3" },
      EC_stim: { type: "text", text: "EC" },
      EO_instruction: { type: "text", text: "open eyes" },
      EO_instruction_voice: { type: "sound", file: "eo.mp3" },
      EO_stim: { type: "text", text: "+" }
    });
    const trial = new TrialBuilder({
      trial_id: "rest_1",
      block_id: "block_0",
      trial_index: 0,
      condition: "EC"
    });

    run_trial(trial, "EC", {
      settings,
      stimBank,
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "block_instruction",
      "fixation"
    ]);
    expect(compiled.units[1].context).toMatchObject({
      valid_keys: [],
      stim_id: "EC_stim",
      task_factors: {
        condition: "EC",
        stage: "rest_window"
      }
    });
    expect(compiled.units[1].response_cfg).toMatchObject({
      keys: [],
      timeout_trigger: 11,
      terminate_on_response: false
    });
  });
});
