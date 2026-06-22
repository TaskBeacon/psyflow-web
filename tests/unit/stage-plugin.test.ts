import { describe, expect, it } from "vitest";

import PsyflowStagePlugin from "../../src/jspsych/PsyflowStagePlugin";

describe("PsyflowStagePlugin", () => {
  it("can count repeated valid responses within one response window", async () => {
    const display = document.createElement("div");
    document.body.appendChild(display);
    const plugin = new PsyflowStagePlugin({} as never);

    const resultPromise = plugin.trial(display, {
      stage: {
        unit_label: "effort_execution",
        op: "capture_response",
        phase: "effort_execution_window"
      },
      resolve_stage: () => ({
        context: {
          trial_id: "trial_1",
          phase: "effort_execution_window",
          deadline_s: 0.04,
          valid_keys: ["space"]
        },
        duration: 0.04,
        min_wait: 0,
        response_cfg: {
          keys: ["space"],
          correct_keys: ["space"],
          terminate_on_response: false,
          count_responses: true
        },
        stimuli: []
      })
    } as never);

    for (let index = 0; index < 3; index += 1) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space" }));
    }

    const result = await resultPromise;
    expect(result.response).toBe("space");
    expect(result.key_press).toBe(true);
    expect(result.response_count).toBe(3);
  });
});
