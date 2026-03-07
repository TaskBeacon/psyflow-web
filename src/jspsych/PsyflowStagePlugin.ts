import { ParameterType, type JsPsych, type JsPsychPlugin, type TrialType } from "jspsych";

import type { CompiledStage, ResponseConfig, SpeechStimSpec, StimSpec, TrialContextSpec } from "../core/types";
import { PSYFLOW_ABORT_EVENT } from "./sessionEvents";

export interface ResolvedStageStimulus {
  stim_id: string | null;
  spec: StimSpec;
}

export interface ResolvedStageExecution {
  context: TrialContextSpec;
  duration: number | null;
  min_wait: number;
  response_cfg?: ResponseConfig;
  stimuli: ResolvedStageStimulus[];
}

export interface PsyflowStageResult {
  onset_time: number;
  onset_time_global: number;
  close_time: number;
  close_time_global: number;
  duration: number;
  response: string | null;
  key_press: boolean;
  rt: number | null;
  response_time: number | null;
  response_time_global: number | null;
  hit: boolean | null;
  timeout_triggered: boolean;
  timeout_time: number | null;
  resolved_stim_id: string | null;
  resolved_deadline_s: number | null;
}

const info = {
  name: "psyflow-stage",
  version: "0.1.0",
  parameters: {
    stage: {
      type: ParameterType.COMPLEX
    },
    resolve_stage: {
      type: ParameterType.FUNCTION
    }
  },
  data: {
    onset_time: {
      type: ParameterType.FLOAT
    },
    onset_time_global: {
      type: ParameterType.FLOAT
    },
    close_time: {
      type: ParameterType.FLOAT
    },
    close_time_global: {
      type: ParameterType.FLOAT
    },
    duration: {
      type: ParameterType.FLOAT
    },
    response: {
      type: ParameterType.STRING
    },
    key_press: {
      type: ParameterType.BOOL
    },
    rt: {
      type: ParameterType.FLOAT
    },
    response_time: {
      type: ParameterType.FLOAT
    },
    response_time_global: {
      type: ParameterType.FLOAT
    },
    hit: {
      type: ParameterType.BOOL
    },
    timeout_triggered: {
      type: ParameterType.BOOL
    },
    timeout_time: {
      type: ParameterType.FLOAT
    },
    resolved_stim_id: {
      type: ParameterType.STRING
    },
    resolved_deadline_s: {
      type: ParameterType.FLOAT
    }
  }
} as const;

type Info = typeof info;

const KEY_TO_DOM: Record<string, string> = {
  space: " ",
  spacebar: " ",
  return: "enter",
  esc: "escape"
};

const DOM_TO_PSYFLOW: Record<string, string> = {
  " ": "space",
  space: "space",
  spacebar: "space",
  enter: "enter",
  escape: "escape"
};

function ensureStyles(): void {
  if (document.getElementById("psyflow-stage-styles")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "psyflow-stage-styles";
  style.textContent = `
    .psyflow-stage {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 100vh;
      overflow: hidden;
      font-family: "Segoe UI", "Helvetica Neue", sans-serif;
      color: #111827;
    }
    .psyflow-stage-stim {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      white-space: pre-wrap;
    }
    .psyflow-stage-text,
    .psyflow-stage-textbox {
      max-width: min(70ch, 90vw);
      line-height: 1.45;
    }
    .psyflow-stage-textbox {
      padding: 1rem 1.25rem;
    }
    .psyflow-stage-image {
      object-fit: contain;
      display: block;
    }
  `;
  document.head.appendChild(style);
}

function toLength(value: number | undefined, units: string | undefined, fallback = 0): string {
  const numeric = Number.isFinite(value) ? Number(value) : fallback;
  if (units === "px") {
    return `${numeric}px`;
  }
  if (units === "percent") {
    return `${numeric}%`;
  }
  return `${numeric * 2}vmin`;
}

function regularPolygonClipPath(edges: number): string {
  const safeEdges = Math.max(3, Math.floor(edges));
  const points: string[] = [];
  for (let index = 0; index < safeEdges; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / safeEdges;
    const x = 50 + Math.cos(angle) * 50;
    const y = 50 + Math.sin(angle) * 50;
    points.push(`${x}% ${y}%`);
  }
  return `polygon(${points.join(", ")})`;
}

function normalizeKeyForListener(key: string): string {
  const normalized = key.toLowerCase();
  return KEY_TO_DOM[normalized] ?? normalized;
}

function normalizeRecordedKey(key: string): string {
  const normalized = key.toLowerCase();
  return DOM_TO_PSYFLOW[normalized] ?? normalized;
}

function normalizeKeyboardEvent(event: KeyboardEvent): string {
  const code = event.code.toLowerCase();
  if (code === "space") {
    return "space";
  }
  if (code === "enter" || code === "numpadenter") {
    return "enter";
  }
  if (code === "escape") {
    return "escape";
  }
  return normalizeRecordedKey(event.key);
}

function applyBaseStimStyle(element: HTMLElement, spec: StimSpec): void {
  const units = spec.units;
  const [x = 0, y = 0] = spec.pos ?? [0, 0];
  element.style.left = `calc(50% + ${toLength(x, units)})`;
  element.style.top = `calc(50% - ${toLength(y, units)})`;
  if (spec.color) {
    element.style.color = spec.color;
  }
}

function renderStimulus(stageRoot: HTMLElement, spec: StimSpec): void {
  switch (spec.type) {
    case "text": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim psyflow-stage-text";
      element.textContent = spec.text;
      applyBaseStimStyle(element, spec);
      element.style.fontSize = toLength(spec.height ?? 1.1, spec.units, 1.1);
      if (spec.font) {
        element.style.fontFamily = spec.font;
      }
      if (spec.alignment) {
        element.style.textAlign = spec.alignment;
      }
      stageRoot.appendChild(element);
      return;
    }
    case "textbox": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim psyflow-stage-textbox";
      element.textContent = spec.text;
      applyBaseStimStyle(element, spec);
      if (spec.font) {
        element.style.fontFamily = spec.font;
      }
      if (spec.alignment) {
        element.style.textAlign = spec.alignment;
      }
      element.style.fontSize = toLength(spec.letterHeight ?? 1, spec.units, 1);
      if (spec.size) {
        element.style.width = toLength(spec.size[0], spec.units, spec.size[0]);
        element.style.minHeight = toLength(spec.size[1], spec.units, spec.size[1]);
      }
      stageRoot.appendChild(element);
      return;
    }
    case "circle": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim";
      applyBaseStimStyle(element, spec);
      element.style.width = toLength((spec.radius ?? 1) * 2, spec.units, 2);
      element.style.height = toLength((spec.radius ?? 1) * 2, spec.units, 2);
      element.style.borderRadius = "9999px";
      element.style.background = spec.fillColor ?? "transparent";
      element.style.border = `2px solid ${spec.lineColor ?? "transparent"}`;
      stageRoot.appendChild(element);
      return;
    }
    case "rect": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim";
      applyBaseStimStyle(element, spec);
      element.style.width = toLength(spec.width, spec.units, spec.width);
      element.style.height = toLength(spec.height, spec.units, spec.height);
      element.style.background = spec.fillColor ?? "transparent";
      element.style.border = `2px solid ${spec.lineColor ?? "transparent"}`;
      stageRoot.appendChild(element);
      return;
    }
    case "polygon": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim";
      applyBaseStimStyle(element, spec);
      element.style.width = toLength(spec.size, spec.units, spec.size);
      element.style.height = toLength(spec.size, spec.units, spec.size);
      element.style.background = spec.fillColor ?? "transparent";
      element.style.border = `2px solid ${spec.lineColor ?? "transparent"}`;
      element.style.clipPath = regularPolygonClipPath(spec.edges);
      stageRoot.appendChild(element);
      return;
    }
    case "image": {
      const element = document.createElement("img");
      element.className = "psyflow-stage-stim psyflow-stage-image";
      element.src = spec.image;
      applyBaseStimStyle(element, spec);
      if (spec.size) {
        element.style.width = toLength(spec.size[0], spec.units, spec.size[0]);
        element.style.height = toLength(spec.size[1], spec.units, spec.size[1]);
      }
      stageRoot.appendChild(element);
      return;
    }
    case "speech": {
      return;
    }
    default: {
      const exhaustiveCheck: never = spec;
      throw new Error(`Unsupported stimulus type: ${String(exhaustiveCheck)}`);
    }
  }
}

function pickSpeechVoice(spec: SpeechStimSpec): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  if (voices.length === 0) {
    return null;
  }
  if (spec.voice) {
    const exact = voices.find((voice) => voice.name === spec.voice);
    if (exact) {
      return exact;
    }
  }
  const requestedLang =
    spec.lang ??
    (typeof spec.voice === "string" && /^[a-z]{2}-[A-Z]{2}/.test(spec.voice)
      ? spec.voice.slice(0, 5)
      : undefined);
  if (requestedLang) {
    const langMatch = voices.find((voice) => voice.lang.toLowerCase() === requestedLang.toLowerCase());
    if (langMatch) {
      return langMatch;
    }
  }
  return null;
}

function speakStimuli(specs: StimSpec[]): (() => void) | null {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") {
    return null;
  }
  const speechSpecs = specs.filter((spec): spec is SpeechStimSpec => spec.type === "speech");
  if (speechSpecs.length === 0) {
    return null;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  for (const spec of speechSpecs) {
    const utterance = new SpeechSynthesisUtterance(spec.text);
    if (spec.lang) {
      utterance.lang = spec.lang;
    }
    if (typeof spec.rate === "number") {
      utterance.rate = spec.rate;
    }
    if (typeof spec.pitch === "number") {
      utterance.pitch = spec.pitch;
    }
    if (typeof spec.volume === "number") {
      utterance.volume = spec.volume;
    }
    const voice = pickSpeechVoice(spec);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    synth.speak(utterance);
  }
  return () => synth.cancel();
}

export class PsyflowStagePlugin implements JsPsychPlugin<Info> {
  static info = info;

  constructor(_jsPsych: JsPsych) {}

  trial(display_element: HTMLElement, trial: TrialType<Info>): Promise<PsyflowStageResult> {
    ensureStyles();
    const stage = trial.stage as CompiledStage;
    if (!trial.resolve_stage) {
      throw new Error("psyflow-stage requires a resolve_stage function.");
    }
    const resolved = trial.resolve_stage() as ResolvedStageExecution;

    display_element.innerHTML = "";
    display_element.tabIndex = 0;
    const stageRoot = document.createElement("div");
    stageRoot.className = "psyflow-stage";
    stageRoot.tabIndex = -1;
    stageRoot.dataset.psyflowUnitLabel = stage.unit_label;
    stageRoot.dataset.psyflowOp = stage.op;
    if (stage.phase) {
      stageRoot.dataset.psyflowPhase = stage.phase;
    }
    display_element.appendChild(stageRoot);
    display_element.focus();
    for (const stim of resolved.stimuli) {
      renderStimulus(stageRoot, stim.spec);
    }
    const stopSpeech = speakStimuli(resolved.stimuli.map((stim) => stim.spec));

    const onsetEpochSeconds = Date.now() / 1000;
    const stageStart = performance.now();
    const primaryStimId = resolved.context.stim_id ?? resolved.stimuli[0]?.stim_id ?? null;
    const deadlineSeconds =
      resolved.context.deadline_s == null
        ? resolved.duration
        : Number(resolved.context.deadline_s);

    return new Promise<PsyflowStageResult>((resolve) => {
      let finished = false;
      let timerId: number | null = null;
      let response: string | null = null;
      let rtSeconds: number | null = null;
      let hit: boolean | null = stage.op === "capture_response" ? false : null;
      let timeoutTriggered = false;
      let timeoutTime: number | null = null;
      let keyboardListening = false;
      const validKeys = (resolved.response_cfg?.keys ?? ["space"]).map((key) => key.toLowerCase());
      const correctKeys = (resolved.response_cfg?.correct_keys ?? resolved.response_cfg?.keys ?? []).map(
        normalizeKeyForListener
      );

      const keydownListener = (event: KeyboardEvent) => {
        if (!keyboardListening || finished || response !== null || event.repeat) {
          return;
        }
        if (event.timeStamp < stageStart) {
          return;
        }
        const recordedKey = normalizeKeyboardEvent(event);
        if (!validKeys.includes(recordedKey)) {
          return;
        }

        event.preventDefault();
        response = recordedKey;
        rtSeconds = (performance.now() - stageStart) / 1000;
        if (stage.op === "capture_response") {
          hit =
            correctKeys.length > 0
              ? correctKeys.includes(normalizeKeyForListener(response))
              : true;
        }
        if (resolved.response_cfg?.terminate_on_response ?? false) {
          finish(rtSeconds);
        }
      };

      const abortListener = () => {
        finish((performance.now() - stageStart) / 1000, true);
      };

      const cleanup = () => {
        if (timerId != null) {
          window.clearTimeout(timerId);
        }
        keyboardListening = false;
        stopSpeech?.();
        window.removeEventListener("keydown", keydownListener, true);
        document.removeEventListener("keydown", keydownListener, true);
        display_element.removeEventListener(PSYFLOW_ABORT_EVENT, abortListener as EventListener);
      };

      const finish = (elapsedSeconds: number, forceElapsed = false) => {
        if (finished) {
          return;
        }
        finished = true;
        cleanup();
        const duration =
          forceElapsed
            ? elapsedSeconds
            : stage.op === "wait_and_continue"
            ? elapsedSeconds
            : resolved.duration ?? elapsedSeconds;
        resolve({
          onset_time: 0,
          onset_time_global: onsetEpochSeconds,
          close_time: elapsedSeconds,
          close_time_global: onsetEpochSeconds + elapsedSeconds,
          duration,
          response,
          key_press: response !== null,
          rt: rtSeconds,
          response_time: rtSeconds,
          response_time_global: rtSeconds == null ? null : onsetEpochSeconds + rtSeconds,
          hit,
          timeout_triggered: timeoutTriggered,
          timeout_time: timeoutTime,
          resolved_stim_id: primaryStimId,
          resolved_deadline_s: deadlineSeconds ?? null
        });
      };

      display_element.addEventListener(PSYFLOW_ABORT_EVENT, abortListener as EventListener);

      const startKeyboardListener = () => {
        if (keyboardListening) {
          return;
        }
        keyboardListening = true;
        window.addEventListener("keydown", keydownListener, true);
        document.addEventListener("keydown", keydownListener, true);
      };

      if (stage.op === "show") {
        timerId = window.setTimeout(() => finish(resolved.duration ?? 0), (resolved.duration ?? 0) * 1000);
        return;
      }

      if (stage.op === "wait_and_continue") {
        const minWaitMs = Math.max(0, resolved.min_wait * 1000);
        if (minWaitMs > 0) {
          timerId = window.setTimeout(() => {
            timerId = null;
            startKeyboardListener();
          }, minWaitMs);
        } else {
          startKeyboardListener();
        }
        return;
      }

      startKeyboardListener();
      const timeoutMs = Math.max(0, (resolved.duration ?? 0) * 1000);
      timerId = window.setTimeout(() => {
        if (response == null) {
          timeoutTriggered = true;
          timeoutTime = resolved.duration ?? null;
          hit = false;
        }
        finish((performance.now() - stageStart) / 1000);
      }, timeoutMs);
    });
  }
}

export default PsyflowStagePlugin;
