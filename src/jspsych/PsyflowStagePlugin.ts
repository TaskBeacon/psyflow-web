import { ParameterType, type JsPsych, type JsPsychPlugin, type TrialType } from "jspsych";

import type { CompiledStage, ResponseConfig, SoundStimSpec, SpeechStimSpec, StimSpec, TrialContextSpec } from "../core/types";
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

export interface SkippedStageExecution {
  skip: true;
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
  esc: "escape",
  left: "arrowleft",
  right: "arrowright",
  up: "arrowup",
  down: "arrowdown"
};

const DOM_TO_PSYFLOW: Record<string, string> = {
  " ": "space",
  space: "space",
  spacebar: "space",
  enter: "enter",
  escape: "escape",
  arrowleft: "left",
  arrowright: "right",
  arrowup: "up",
  arrowdown: "down"
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

function verticesToSvgPoints(vertices: Array<[number, number]>): string {
  if (vertices.length === 0) {
    return "";
  }
  const xs = vertices.map(([x]) => x);
  const ys = vertices.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  return vertices
    .map(([x, y]) => `${((x - minX) / width) * 100},${((maxY - y) / height) * 100}`)
    .join(" ");
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

function isSkippedStageExecution(
  execution: ResolvedStageExecution | SkippedStageExecution
): execution is SkippedStageExecution {
  return "skip" in execution && execution.skip;
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
    case "shape": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim";
      applyBaseStimStyle(element, spec);
      element.style.width = toLength(spec.size, spec.units, spec.size);
      element.style.height = toLength(spec.size, spec.units, spec.size);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("points", verticesToSvgPoints(spec.vertices));
      polygon.setAttribute("fill", spec.fillColor ?? "transparent");
      polygon.setAttribute("stroke", spec.lineColor && spec.lineColor.length > 0 ? spec.lineColor : "transparent");
      polygon.setAttribute("stroke-width", "2");
      svg.appendChild(polygon);
      element.appendChild(svg);
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
    case "sound": {
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

function playSoundStimuli(specs: StimSpec[]): (() => void) | null {
  const soundSpecs = specs.filter((spec): spec is SoundStimSpec => spec.type === "sound");
  if (soundSpecs.length === 0) {
    return null;
  }
  const audios = soundSpecs.map((spec) => {
    const audio = new Audio(spec.file);
    audio.preload = "auto";
    if (typeof spec.volume === "number") {
      audio.volume = Math.max(0, Math.min(1, spec.volume));
    }
    void audio.play().catch(() => {
      // Audio playback is best-effort in browsers.
    });
    return audio;
  });
  return () => {
    for (const audio of audios) {
      audio.pause();
      audio.currentTime = 0;
    }
  };
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
    const resolved = trial.resolve_stage() as ResolvedStageExecution | SkippedStageExecution;
    if (isSkippedStageExecution(resolved)) {
      return Promise.resolve({
        onset_time: 0,
        onset_time_global: Date.now() / 1000,
        close_time: 0,
        close_time_global: Date.now() / 1000,
        duration: 0,
        response: null,
        key_press: false,
        rt: null,
        response_time: null,
        response_time_global: null,
        hit: null,
        timeout_triggered: false,
        timeout_time: null,
        resolved_stim_id: null,
        resolved_deadline_s: null
      });
    }
    const execution: ResolvedStageExecution = resolved;

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
    for (const stim of execution.stimuli) {
      renderStimulus(stageRoot, stim.spec);
    }
    const stopSpeech = speakStimuli(execution.stimuli.map((stim: ResolvedStageStimulus) => stim.spec));
    const stopSounds = playSoundStimuli(execution.stimuli.map((stim: ResolvedStageStimulus) => stim.spec));

    const onsetEpochSeconds = Date.now() / 1000;
    const stageStart = performance.now();
    const primaryStimId = execution.context.stim_id ?? execution.stimuli[0]?.stim_id ?? null;
    const deadlineSeconds =
      execution.context.deadline_s == null
        ? execution.duration
        : Number(execution.context.deadline_s);

    return new Promise<PsyflowStageResult>((resolve) => {
      let finished = false;
      let timerId: number | null = null;
      let response: string | null = null;
      let rtSeconds: number | null = null;
      let hit: boolean | null = stage.op === "capture_response" ? false : null;
      let timeoutTriggered = false;
      let timeoutTime: number | null = null;
      let keyboardListening = false;
      const validKeys = (execution.response_cfg?.keys ?? ["space"]).map((key: string) => key.toLowerCase());
      const correctKeys = (execution.response_cfg?.correct_keys ?? execution.response_cfg?.keys ?? []).map(
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
          hit = correctKeys.length > 0 ? correctKeys.includes(normalizeKeyForListener(response)) : true;
        }
        if (execution.response_cfg?.terminate_on_response ?? false) {
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
        stopSounds?.();
        window.removeEventListener("keydown", keydownListener, true);
        document.removeEventListener("keydown", keydownListener, true);
        display_element.removeEventListener("keydown", keydownListener, true);
        stageRoot.removeEventListener("keydown", keydownListener, true);
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
            : execution.duration ?? elapsedSeconds;
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
        display_element.addEventListener("keydown", keydownListener, true);
        stageRoot.addEventListener("keydown", keydownListener, true);
      };

      if (stage.op === "show") {
        timerId = window.setTimeout(() => finish(execution.duration ?? 0), (execution.duration ?? 0) * 1000);
        return;
      }

      if (stage.op === "wait_and_continue") {
        const minWaitMs = Math.max(0, execution.min_wait * 1000);
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
      if (execution.duration != null) {
        const timeoutMs = Math.max(0, execution.duration * 1000);
        timerId = window.setTimeout(() => {
          if (response == null) {
            timeoutTriggered = true;
            timeoutTime = execution.duration ?? null;
            hit = false;
          }
          finish((performance.now() - stageStart) / 1000);
        }, timeoutMs);
      }
    });
  }
}

export default PsyflowStagePlugin;
