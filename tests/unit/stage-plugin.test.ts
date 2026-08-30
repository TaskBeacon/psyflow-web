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
    expect(result.responses).toEqual(["space", "space", "space"]);
    expect(result.response_times).toHaveLength(3);
    expect(result.response_times?.every((value) => typeof value === "number" && value >= 0)).toBe(true);
  });

  it("captures editable textbox content when Enter submits", async () => {
    const display = document.createElement("div");
    document.body.appendChild(display);
    const plugin = new PsyflowStagePlugin({} as never);

    const resultPromise = plugin.trial(display, {
      stage: { unit_label: "recall", op: "capture_response", phase: "recall" },
      resolve_stage: () => ({
        context: { trial_id: "typed_1", phase: "recall", deadline_s: 0.2, valid_keys: ["return"] },
        duration: 0.2,
        min_wait: 0,
        response_cfg: { keys: ["return"], terminate_on_response: true },
        stimuli: [{ stim_id: "entry", spec: { type: "textbox", text: "", editable: true, size: [320, 48] } }]
      })
    } as never);

    const input = display.querySelector<HTMLInputElement>('input[data-psyflow-text-entry="true"]');
    expect(input).not.toBeNull();
    input!.value = "苹果";
    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    const result = await resultPromise;

    expect(result.response).toBe("enter");
    expect(result.response_text).toBe("苹果");
    expect(result.timeout_triggered).toBe(false);
  });

  it("opts into a focused wrapping textarea and preserves newlines on F2 submission", async () => {
    const display = document.createElement("div");
    document.body.appendChild(display);
    const plugin = new PsyflowStagePlugin({} as never);
    const resultPromise = plugin.trial(display, {
      stage: { unit_label: "entry", op: "capture_response", phase: "entry" },
      resolve_stage: () => ({
        context: { trial_id: "multiline_1", phase: "entry", deadline_s: 1, valid_keys: ["f2", "f8"] },
        duration: 1, min_wait: 0,
        response_cfg: { keys: ["f2", "f8"], terminate_on_response: true },
        stimuli: [{ stim_id: "editor", spec: {
          type: "textbox", text: "", editable: true, multiline: true,
          placeholder: "Synthetic text only", maxLength: 500, size: [320, 200], units: "pix"
        } }]
      })
    } as never);
    const editor = display.querySelector<HTMLTextAreaElement>('textarea[data-psyflow-text-entry="true"]')!;
    expect(editor).not.toBeNull();
    expect(document.activeElement).toBe(editor);
    expect(editor.wrap).toBe("soft");
    expect(editor.style.height).toBe("200px");
    expect(editor.maxLength).toBe(500);
    // jsdom does not implement native text editing; real browser validation covers Enter insertion.
    editor.value = "合成第一行\n第二行";
    const enter = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
    editor.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    expect(display.contains(editor)).toBe(true);
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", code: "F2", bubbles: true }));
    const result = await resultPromise;
    expect(result.response).toBe("f2");
    expect(result.response_text).toBe("合成第一行\n第二行");
    expect(result.timeout_triggered).toBe(false);
    display.remove();
  });

  it("captures an ordered pointer sequence and stops at the requested length", async () => {
    const display = document.createElement("div");
    document.body.appendChild(display);
    const plugin = new PsyflowStagePlugin({} as never);

    const resultPromise = plugin.trial(display, {
      stage: { unit_label: "recall", op: "capture_pointer_sequence", phase: "recall" },
      resolve_stage: () => ({
        context: { trial_id: "pointer_1", phase: "recall", deadline_s: 0.2, valid_keys: ["a", "b"] },
        duration: 0.2,
        min_wait: 0,
        pointer_cfg: {
          target_ids: ["a", "b"],
          max_selections: 2,
          selection_trigger: { a: 41, b: 42 },
          complete_trigger: 49
        },
        stimuli: [
          { stim_id: "a", spec: { type: "rect", width: 30, height: 30, pos: [-30, 0] } },
          { stim_id: "b", spec: { type: "rect", width: 30, height: 30, pos: [30, 0] } }
        ]
      })
    } as never);

    const a = display.querySelector<HTMLElement>('[data-psyflow-stim-id="a"]');
    const b = display.querySelector<HTMLElement>('[data-psyflow-stim-id="b"]');
    a?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 20 }));
    b?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 30, clientY: 40 }));
    const result = await resultPromise;

    expect(result.responses).toEqual(["a", "b"]);
    expect(result.response).toBe("b");
    expect(result.response_count).toBe(2);
    expect(result.response_positions).toEqual([[10, 20], [30, 40]]);
    expect(result.selection_triggers).toEqual([41, 42]);
    expect(result.completion_trigger).toBe(49);
    expect(result.completed).toBe(true);
    expect(result.timeout_triggered).toBe(false);
  });

  it("captures a click-free rotated reach and records endpoint geometry", async () => {
    const display = document.createElement("div");
    display.className = "psyflow-runtime-root";
    display.dataset.psyflowDefaultUnits = "deg";
    document.body.appendChild(display);
    const plugin = new PsyflowStagePlugin({} as never);
    const resultPromise = plugin.trial(display, {
      stage: { unit_label: "reach", op: "capture_pointer_reach", phase: "reach" },
      resolve_stage: () => ({
        context: { trial_id: "reach_1", phase: "reach", deadline_s: 0.2, valid_keys: ["pointer_reach"] },
        duration: null,
        min_wait: 0,
        pointer_reach_cfg: {
          target_position: [0, 6], target_distance: 6, start_radius: 0.25, target_radius: 0.25,
          search_visibility_radius: 2, start_hold_duration: 0.005, movement_deadline: 0.2,
          reaction_threshold: 1, feedback_mode: "rotated", rotation_deg: -45,
          endpoint_freeze_duration: 0.001, hold_trigger: 21, target_trigger: 31,
          movement_trigger: 40, complete_trigger: 50, hit_trigger: 52, timeout_trigger: 51
        },
        stimuli: [
          { stim_id: "__pointer_reach_start", spec: { type: "circle", radius: 0.25, lineColor: "white" } },
          { stim_id: "__pointer_reach_target", spec: { type: "circle", radius: 0.25, fillColor: "blue", pos: [0, 6] } },
          { stim_id: "__pointer_reach_cursor", spec: { type: "circle", radius: 0.16, fillColor: "white" } }
        ]
      })
    } as never);
    const stage = display.querySelector<HTMLElement>('[data-psyflow-unit-label="reach"]')!;
    stage.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 512, clientY: 384 }));
    await new Promise((resolve) => window.setTimeout(resolve, 10));
    stage.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 500, clientY: 372 }));
    stage.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 446, clientY: 318 }));
    const result = await resultPromise;
    expect(result).toMatchObject({
      completed: true,
      cursor_hit: true,
      timeout_triggered: false,
      completion_trigger: 50,
      hit_trigger: 52,
      hold_trigger: 21,
      target_trigger: 31,
      movement_trigger: 40
    });
    expect(result.hand_angle_deg).toBeCloseTo(135, 0);
    expect(result.cursor_angle_deg).toBeCloseTo(90, 0);
    expect(result.physical_positions?.length).toBeGreaterThanOrEqual(2);
  });
});
