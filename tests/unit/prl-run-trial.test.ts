import { describe, expect, it } from "vitest";

import { StimBank, TaskSettings, TrialBuilder } from "../../src";
import { Controller } from "../../../H000009-prl/src/controller";
import { run_trial } from "../../../H000009-prl/src/run_trial";

describe("H000009 PRL trial", () => {
  it("preserves canonical phase context and reversal-padded response triggers", () => {
    const settings = TaskSettings.from_dict({
      total_blocks: 1,
      total_trials: 1,
      trial_per_block: 1,
      conditions: ["AB", "BA"],
      key_list: ["f", "j"],
      left_key: "f",
      right_key: "j",
      delta: 10,
      fixation_duration: [0.6, 0.8],
      choice_duration: 1.5,
      blank_duration: [0.4, 0.6],
      feedback_duration: 0.8
    });
    settings.triggers = {
      key_press: 3,
      no_response: 4
    };
    settings.block_seed = [73105];
    const stimBank = new StimBank({
      fixation: { type: "text", text: "+" },
      stima: { type: "image", image: "a.png" },
      stimb: { type: "image", image: "b.png" },
      blank: { type: "text", text: "" },
      win_feedback: { type: "text", text: "win" },
      lose_feedback: { type: "text", text: "lose" },
      no_response_feedback: { type: "text", text: "miss" }
    });
    const controller = Controller.from_dict({
      win_prob: 0.8,
      rev_win_prob: 0.9,
      sliding_window: 10,
      sliding_window_hits: 9
    });
    controller.reversal_count = 1;
    const trial = new TrialBuilder({
      trial_id: 1,
      block_id: "block_0",
      trial_index: 0,
      condition: "AB"
    });

    run_trial(trial, "AB", {
      settings,
      stimBank,
      controller,
      pair: {
        stima: { name: "a.png", url: "/a.png" },
        stimb: { name: "b.png", url: "/b.png" }
      },
      block_id: "block_0",
      block_idx: 0
    });

    const compiled = trial.build();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "pre_choice_fixation",
      "choice_response_window",
      "blank_screen",
      "feedback"
    ]);
    const responseCfg = compiled.units[1].response_cfg;
    expect(typeof responseCfg?.correct_keys).toBe("function");
    expect(typeof responseCfg?.response_trigger).toBe("function");
    expect(typeof responseCfg?.timeout_trigger).toBe("function");
    expect((responseCfg?.correct_keys as () => string)()).toBe("f");
    expect((responseCfg?.response_trigger as () => number)()).toBe(13);
    expect((responseCfg?.timeout_trigger as () => number)()).toBe(14);
    expect(compiled.units[2].context).toMatchObject({
      valid_keys: [],
      stim_id: "blank",
      task_factors: {
        stage: "blank_screen"
      }
    });
    expect(((compiled.units[2].context?.task_factors?.reversal_count as () => number)())).toBe(1);
    expect(compiled.units[3].context).toMatchObject({
      valid_keys: [],
      task_factors: {
        stage: "feedback"
      }
    });
    expect(((compiled.units[3].context?.task_factors?.reversal_count as () => number)())).toBe(1);
  });
});
