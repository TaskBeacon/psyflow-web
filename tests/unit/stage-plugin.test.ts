import { describe, expect, it } from "vitest";

import PsyflowStagePlugin from "../../src/jspsych/PsyflowStagePlugin";

describe("PsyflowStagePlugin", () => {
  it("updates elapsed-millisecond text while a response window is open", async () => {
    const display = document.createElement("div");
    display.className = "psyflow-runtime-root";
    display.dataset.psyflowDefaultUnits = "pix";
    document.body.appendChild(display);
    const plugin = new PsyflowStagePlugin({} as never);

    const resultPromise = plugin.trial(display, {
      stage: {
        unit_label: "target",
        op: "capture_response",
        phase: "target"
      },
      resolve_stage: () => ({
        context: {
          trial_id: "trial_dynamic",
          phase: "target",
          deadline_s: 0.08,
          valid_keys: ["space"]
        },
        duration: 0.08,
        min_wait: 0,
        response_cfg: {
          keys: ["space"],
          correct_keys: ["space"],
          terminate_on_response: true
        },
        stimuli: [
          {
            stim_id: "counter",
            spec: {
              type: "text",
              text: "00000",
              height: 72,
              dynamic_text: { mode: "elapsed_ms", digits: 5 }
            }
          }
        ]
      })
    } as never);

    await new Promise((resolve) => window.setTimeout(resolve, 35));
    const counter = display.querySelector<HTMLElement>('[data-psyflow-dynamic-text="elapsed_ms"]');
    expect(counter?.textContent).toMatch(/^\d{5}$/);
    expect(Number(counter?.textContent ?? 0)).toBeGreaterThan(0);
    expect(counter?.style.fontSize).toBe("72px");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space" }));
    await resultPromise;
  });

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
    expect(result.response_times).toHaveLength(3);
    expect(result.response_times?.every((value) => typeof value === "number" && value >= 0)).toBe(true);
  });
});
