import { describe, expect, it } from "vitest";

import {
  StimBank,
  TaskSettings,
  TrialBuilder,
  type RuntimeView,
  type TrialSnapshot
} from "../../src";
import { run_trial } from "../../../H000056-psychomotor-vigilance-task/src/run_trial";

function buildTrial() {
  const settings = TaskSettings.from_dict({
    total_blocks: 1,
    total_trials: 1,
    trial_per_block: 1,
    conditions: ["standard"],
    key_list: ["space"],
    isi_duration: [2, 10],
    response_window_duration: 65,
    feedback_duration: 0.5,
    false_start_threshold: 0.1,
    lapse_threshold: 0.5
  }) as TaskSettings & Record<string, unknown>;
  settings.triggers = {
    isi_onset: 20,
    false_start_response: 21,
    target_onset: 30,
    target_response: 31,
    target_timeout: 32,
    feedback_onset: 40
  };
  const stimBank = new StimBank({
    blank_screen: { type: "text", text: "" },
    target_counter: {
      type: "text",
      text: "00000",
      dynamic_text: { mode: "elapsed_ms", digits: 5 }
    },
    rt_feedback: { type: "text", text: "{rt_ms} ms" }
  });
  const trial = new TrialBuilder({
    trial_id: 1,
    block_id: "block_0",
    trial_index: 0,
    condition: "standard"
  });
  run_trial(trial, "standard", {
    settings,
    stimBank,
    block_id: "block_0",
    block_idx: 0
  });
  return trial.build();
}

function finalize(compiled: ReturnType<typeof buildTrial>, units: TrialSnapshot["units"]) {
  const state: Record<string, unknown> = { ...compiled.trial_state };
  const snapshot = {
    trial_id: compiled.trial_id,
    block_id: compiled.block_id,
    trial_index: compiled.trial_index,
    condition: compiled.condition,
    units,
    trial_state: state
  } satisfies TrialSnapshot;
  compiled.finalizers[0](
    snapshot,
    { getReducedRows: () => [], sumReducedField: () => 0 } satisfies RuntimeView,
    {
      setTrialState: (key, value) => {
        state[key] = value;
      },
      getUnitState: (label, key) => units[label]?.[key]
    }
  );
  return state;
}

describe("H000056 PVT trial", () => {
  it("preserves the canonical conditional stage contract", () => {
    const compiled = buildTrial();
    expect(compiled.units.map((stage) => stage.context?.phase)).toEqual([
      "isi",
      "target",
      "feedback"
    ]);
    expect(compiled.units[0].duration).toEqual([2, 10]);
    expect(compiled.units[1].duration).toBe(65);
    expect(compiled.units[2].duration).toBe(0.5);
    expect(compiled.units[0].response_cfg?.response_trigger).toEqual({ space: 21 });
    expect(compiled.units[1].response_cfg?.response_trigger).toEqual({ space: 31 });
    expect(typeof compiled.units[1].when).toBe("function");
    expect(typeof compiled.units[2].when).toBe("function");
  });

  it("reduces premature, lapse, and no-response outcomes like T000056", () => {
    expect(
      finalize(buildTrial(), {
        isi: { response: "space", rt: 0.4 }
      })
    ).toMatchObject({ false_start: true, valid_response: false, outcome: "false_start" });

    expect(
      finalize(buildTrial(), {
        isi: { response: null, rt: null },
        target: { response: "space", rt: 0.62 },
        feedback: { duration: 0.5 }
      })
    ).toMatchObject({ lapse: true, valid_response: true, response_rt: 0.62, outcome: "lapse" });

    expect(
      finalize(buildTrial(), {
        isi: { response: null, rt: null },
        target: { response: null, rt: null }
      })
    ).toMatchObject({ no_response: true, valid_response: false, outcome: "no_response" });
  });
});

