import { ParameterType, type JsPsych, type JsPsychPlugin, type TrialType } from "jspsych";

import type {
  CompiledStage,
  ResponseConfig,
  SoundStimSpec,
  SpeechStimSpec,
  StimSpec,
  TrialContextSpec
} from "../core/types";
import { playSoundStimuli } from "./audio";
import { PSYFLOW_ABORT_EVENT } from "./sessionEvents";

export interface ResolvedStageStimulus {
  stim_id: string | null;
  spec: StimSpec;
}

export interface ResolvedStageExecution {
  context: TrialContextSpec;
  duration: number | null;
  min_wait: number;
  onset_trigger: number | null;
  response_cfg?: ResponseConfig;
  pointer_cfg?: {
    target_ids: string[];
    max_selections: number;
    selection_trigger?: number | Record<string, number> | null;
    complete_trigger?: number | null;
    timeout_trigger?: number | null;
    highlight_color?: string;
    highlight_duration_s?: number;
  };
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
  response_count?: number;
  response_times?: number[];
  responses?: string[];
  response_positions?: Array<[number, number]>;
  first_rt?: number | null;
  completed?: boolean;
  selection_triggers?: Array<number | null>;
  completion_trigger?: number | null;
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
    .psyflow-stage-movie {
      object-fit: contain;
      display: block;
      background: transparent;
    }
  `;
  document.head.appendChild(style);
}

function resolveDefaultUnits(stageRoot: HTMLElement): string | undefined {
  const runtimeRoot = stageRoot.closest<HTMLElement>(".psyflow-runtime-root");
  return runtimeRoot?.dataset.psyflowDefaultUnits;
}

function getDegLengthInPx(stageRoot: HTMLElement, degrees: number): number | null {
  const runtimeRoot = stageRoot.closest<HTMLElement>(".psyflow-runtime-root");
  const monitorWidthCm = Number(runtimeRoot?.dataset.psyflowMonitorWidthCm ?? NaN);
  const monitorDistanceCm = Number(runtimeRoot?.dataset.psyflowMonitorDistanceCm ?? NaN);
  const viewportWidthPx = runtimeRoot?.clientWidth ?? stageRoot.clientWidth ?? window.innerWidth;
  const configWidthPx = Number(runtimeRoot?.dataset.psyflowConfigWidthPx ?? NaN);
  const effectiveWidthPx =
    Number.isFinite(configWidthPx) && configWidthPx > 0
      ? Math.max(viewportWidthPx, configWidthPx)
      : viewportWidthPx;
  if (!Number.isFinite(monitorWidthCm) || !Number.isFinite(monitorDistanceCm) || monitorWidthCm <= 0 || monitorDistanceCm <= 0 || effectiveWidthPx <= 0) {
    return null;
  }
  const widthCm = 2 * monitorDistanceCm * Math.tan((degrees * Math.PI) / 360);
  return (widthCm / monitorWidthCm) * effectiveWidthPx;
}

function toLength(
  value: number | undefined,
  units: string | undefined,
  fallback = 0,
  stageRoot?: HTMLElement
): string {
  const numeric = Number.isFinite(value) ? Number(value) : fallback;
  const resolvedUnits = (units ?? (stageRoot ? resolveDefaultUnits(stageRoot) : undefined) ?? "").toLowerCase();
  if (resolvedUnits === "px" || resolvedUnits === "pix") {
    return `${numeric}px`;
  }
  if (resolvedUnits === "percent") {
    return `${numeric}%`;
  }
  if (resolvedUnits === "deg" && stageRoot) {
    const px = getDegLengthInPx(stageRoot, numeric);
    if (px != null) {
      return `${px}px`;
    }
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

function buildShapeGeometry(vertices: Array<[number, number]>): {
  points: string;
  viewBox: string;
} {
  if (vertices.length === 0) {
    return {
      points: "",
      viewBox: "0 0 100 100"
    };
  }
  const xs = vertices.map(([x]) => x);
  const ys = vertices.map(([, y]) => -y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  const span = Math.max(width, height);
  const padding = span * 0.15;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const viewSpan = span + padding * 2;
  return {
    points: vertices.map(([x, y]) => `${x},${-y}`).join(" "),
    viewBox: `${centerX - viewSpan / 2} ${centerY - viewSpan / 2} ${viewSpan} ${viewSpan}`
  };
}

function normalizeCssColor(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (!Array.isArray(value) || (value.length !== 3 && value.length !== 4)) {
    return undefined;
  }

  const numeric = value.map((component) => Number(component));
  if (numeric.some((component) => !Number.isFinite(component))) {
    return undefined;
  }

  const rgb = numeric.slice(0, 3);
  const alpha = numeric.length === 4 ? Math.max(0, Math.min(1, numeric[3])) : null;
  const usesPsychoPyRange = rgb.some((component) => component < 0) || rgb.every((component) => component <= 1);
  const converted = usesPsychoPyRange
    ? rgb.map((component) => {
        const normalized = component < 0 ? (component + 1) / 2 : component;
        return Math.round(Math.max(0, Math.min(1, normalized)) * 255);
      })
    : rgb.map((component) => Math.round(component));

  if (alpha !== null) {
    return `rgba(${converted[0]}, ${converted[1]}, ${converted[2]}, ${alpha})`;
  }

  return `rgb(${converted[0]}, ${converted[1]}, ${converted[2]})`;
}

function applyWrapWidth(element: HTMLElement, spec: StimSpec): void {
  const wrapWidth = (spec as { wrapWidth?: unknown }).wrapWidth;
  if (typeof wrapWidth === "number" && Number.isFinite(wrapWidth) && wrapWidth > 0) {
    element.style.maxWidth = `${wrapWidth}px`;
    return;
  }
  element.style.maxWidth = "min(70ch, 90vw)";
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

function applyBaseStimStyle(element: HTMLElement, spec: StimSpec, stageRoot: HTMLElement): void {
  const units = spec.units ?? resolveDefaultUnits(stageRoot);
  const [x = 0, y = 0] = spec.pos ?? [0, 0];
  element.style.left = `calc(50% + ${toLength(x, units, 0, stageRoot)})`;
  element.style.top = `calc(50% - ${toLength(y, units, 0, stageRoot)})`;
  const orientation = Number(spec.ori ?? 0);
  if (Number.isFinite(orientation) && orientation !== 0) {
    element.style.transform = `translate(-50%, -50%) rotate(${orientation}deg)`;
  }
  const color = normalizeCssColor(spec.color);
  if (color) {
    element.style.color = color;
  }
}

function seededRandom(seed: number): () => number {
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function renderStimulus(
  stageRoot: HTMLElement,
  spec: StimSpec,
  movieSink: HTMLVideoElement[],
  animationCleanupSink: Array<() => void>
): void {
  switch (spec.type) {
    case "text": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim psyflow-stage-text";
      element.textContent = spec.text;
      applyBaseStimStyle(element, spec, stageRoot);
      element.style.fontSize = toLength(spec.height ?? 1.1, spec.units, 1.1, stageRoot);
      applyWrapWidth(element, spec);
      if (spec.font) {
        element.style.fontFamily = spec.font;
      }
      if (spec.alignment) {
        element.style.textAlign = spec.alignment;
      }
      if (spec.dynamic_text?.mode === "elapsed_ms") {
        const digits = Math.max(1, Math.min(9, Math.floor(Number(spec.dynamic_text.digits ?? 5))));
        element.dataset.psyflowDynamicText = "elapsed_ms";
        element.dataset.psyflowDynamicDigits = String(digits);
        element.dataset.psyflowDynamicSuffix = String(spec.dynamic_text.suffix ?? "");
        element.textContent = `${"0".repeat(digits)}${spec.dynamic_text.suffix ?? ""}`;
        element.style.fontVariantNumeric = "tabular-nums";
      }
      stageRoot.appendChild(element);
      return;
    }
    case "textbox": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim psyflow-stage-textbox";
      element.textContent = spec.text;
      applyBaseStimStyle(element, spec, stageRoot);
      applyWrapWidth(element, spec);
      if (spec.font) {
        element.style.fontFamily = spec.font;
      }
      if (spec.alignment) {
        element.style.textAlign = spec.alignment;
      }
      element.style.fontSize = toLength(spec.letterHeight ?? 1, spec.units, 1, stageRoot);
      if (spec.size) {
        element.style.width = toLength(spec.size[0], spec.units, spec.size[0], stageRoot);
        element.style.minHeight = toLength(spec.size[1], spec.units, spec.size[1], stageRoot);
      }
      stageRoot.appendChild(element);
      return;
    }
    case "circle": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim";
      applyBaseStimStyle(element, spec, stageRoot);
      element.style.width = toLength((spec.radius ?? 1) * 2, spec.units, 2, stageRoot);
      element.style.height = toLength((spec.radius ?? 1) * 2, spec.units, 2, stageRoot);
      element.style.borderRadius = "9999px";
      element.style.background = normalizeCssColor(spec.fillColor) ?? "transparent";
      const lineWidth = Number.isFinite(Number(spec.lineWidth)) ? Number(spec.lineWidth) : 2;
      element.style.border = `${Math.max(0, lineWidth)}px solid ${normalizeCssColor(spec.lineColor) ?? "transparent"}`;
      stageRoot.appendChild(element);
      return;
    }
    case "rect": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim";
      applyBaseStimStyle(element, spec, stageRoot);
      element.style.width = toLength(spec.width, spec.units, spec.width, stageRoot);
      element.style.height = toLength(spec.height, spec.units, spec.height, stageRoot);
      element.style.background = normalizeCssColor(spec.fillColor) ?? "transparent";
      const lineWidth = Number.isFinite(Number(spec.lineWidth)) ? Number(spec.lineWidth) : 2;
      element.style.border = `${Math.max(0, lineWidth)}px solid ${normalizeCssColor(spec.lineColor) ?? "transparent"}`;
      stageRoot.appendChild(element);
      return;
    }
    case "polygon": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim";
      applyBaseStimStyle(element, spec, stageRoot);
      element.style.width = toLength(spec.size, spec.units, spec.size, stageRoot);
      element.style.height = toLength(spec.size, spec.units, spec.size, stageRoot);
      element.style.background = normalizeCssColor(spec.fillColor) ?? "transparent";
      const lineWidth = Number.isFinite(Number(spec.lineWidth)) ? Number(spec.lineWidth) : 2;
      element.style.border = `${Math.max(0, lineWidth)}px solid ${normalizeCssColor(spec.lineColor) ?? "transparent"}`;
      element.style.clipPath = regularPolygonClipPath(spec.edges);
      stageRoot.appendChild(element);
      return;
    }
    case "shape": {
      const element = document.createElement("div");
      element.className = "psyflow-stage-stim";
      applyBaseStimStyle(element, spec, stageRoot);
      element.style.width = toLength(spec.size, spec.units, spec.size, stageRoot);
      element.style.height = toLength(spec.size, spec.units, spec.size, stageRoot);
      const geometry = buildShapeGeometry(spec.vertices);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", geometry.viewBox);
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("points", geometry.points);
      polygon.setAttribute("fill", normalizeCssColor(spec.fillColor) ?? "transparent");
      polygon.setAttribute(
        "stroke",
        normalizeCssColor(spec.lineColor) && String(spec.lineColor).length > 0
          ? String(normalizeCssColor(spec.lineColor))
          : "transparent"
      );
      const lineWidth = Number.isFinite(Number(spec.lineWidth)) ? Number(spec.lineWidth) : 2;
      polygon.setAttribute("stroke-width", String(Math.max(0, lineWidth)));
      svg.appendChild(polygon);
      element.appendChild(svg);
      stageRoot.appendChild(element);
      return;
    }
    case "image": {
      const element = document.createElement("img");
      element.className = "psyflow-stage-stim psyflow-stage-image";
      element.src = spec.image;
      applyBaseStimStyle(element, spec, stageRoot);
      if (spec.size) {
        element.style.width = toLength(spec.size[0], spec.units, spec.size[0], stageRoot);
        element.style.height = toLength(spec.size[1], spec.units, spec.size[1], stageRoot);
      } else {
        element.style.maxWidth = "60vmin";
        element.style.maxHeight = "60vmin";
        element.style.width = "auto";
        element.style.height = "auto";
      }
      stageRoot.appendChild(element);
      return;
    }
    case "movie": {
      const element = document.createElement("video");
      element.className = "psyflow-stage-stim psyflow-stage-movie";
      element.src = spec.filename;
      element.preload = "auto";
      element.playsInline = true;
      element.controls = spec.controls ?? false;
      element.muted = spec.muted ?? false;
      element.loop = spec.loop ?? false;
      if (typeof spec.volume === "number") {
        element.volume = Math.min(1, Math.max(0, spec.volume));
      }
      applyBaseStimStyle(element, spec, stageRoot);
      if (spec.size) {
        element.style.width = toLength(spec.size[0], spec.units, spec.size[0], stageRoot);
        element.style.height = toLength(spec.size[1], spec.units, spec.size[1], stageRoot);
      } else {
        element.style.maxWidth = "85vmin";
        element.style.maxHeight = "85vmin";
        element.style.width = "auto";
        element.style.height = "auto";
      }
      stageRoot.appendChild(element);
      movieSink.push(element);
      if (spec.autoplay !== false) {
        const playPromise = element.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            // Autoplay can fail under browser policy; task timing continues regardless.
          });
        }
      }
      return;
    }
    case "random_dot_motion": {
      const canvas = document.createElement("canvas");
      canvas.className = "psyflow-stage-stim psyflow-stage-random-dot-motion";
      applyBaseStimStyle(canvas, spec, stageRoot);
      const apertureDiameter = Math.max(
        0.1,
        Number(spec.aperture_diameter_deg ?? 6)
      );
      canvas.style.width = toLength(
        apertureDiameter,
        spec.units ?? "deg",
        apertureDiameter,
        stageRoot
      );
      canvas.style.height = canvas.style.width;
      canvas.style.borderRadius = "50%";
      canvas.style.display = "block";
      stageRoot.appendChild(canvas);

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
      const cssSize = Math.max(
        64,
        canvas.getBoundingClientRect().width || apertureDiameter * 32
      );
      canvas.width = Math.round(cssSize * pixelRatio);
      canvas.height = Math.round(cssSize * pixelRatio);

      const random = seededRandom(Number(spec.seed ?? 0));
      const nDots = Math.max(1, Math.trunc(Number(spec.n_dots ?? 150)));
      const radiusDeg = apertureDiameter / 2;
      const coherence = Math.min(1, Math.max(0, Number(spec.coherence ?? 0)));
      const lifeFrames = Math.max(
        1,
        Math.trunc(Number(spec.dot_life_frames ?? 4))
      );
      const speedDegS = Math.max(0, Number(spec.speed_deg_s ?? 6));
      const refreshHz = Math.max(1, Number(spec.refresh_hz ?? 60));
      const signalAngle = spec.direction === "left" ? Math.PI : 0;
      const positions = new Float64Array(nDots * 2);
      const ages = new Int32Array(nDots);
      const signalMask = new Uint8Array(nDots);

      const respawn = (index: number) => {
        const radius = radiusDeg * Math.sqrt(random());
        const angle = random() * Math.PI * 2;
        positions[index * 2] = radius * Math.cos(angle);
        positions[index * 2 + 1] = radius * Math.sin(angle);
        ages[index] = lifeFrames;
      };
      for (let index = 0; index < nDots; index += 1) {
        respawn(index);
        ages[index] = 1 + Math.floor(random() * lifeFrames);
      }
      const shuffled = Array.from({ length: nDots }, (_, index) => index);
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
      }
      const signalCount = Math.round(nDots * coherence);
      for (let index = 0; index < signalCount; index += 1) {
        signalMask[shuffled[index]] = 1;
      }

      let stopped = false;
      let frameId = 0;
      let lastTimestamp: number | null = null;
      const renderFrame = (timestamp: number) => {
        if (stopped) {
          return;
        }
        const elapsedSeconds =
          lastTimestamp == null
            ? 1 / refreshHz
            : Math.min(0.05, Math.max(0, (timestamp - lastTimestamp) / 1000));
        lastTimestamp = timestamp;
        const step = speedDegS * elapsedSeconds;

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = normalizeCssColor(spec.dot_color ?? spec.color) ?? "#ffffff";
        const dotRadiusPx = Math.max(
          0.75 * pixelRatio,
          (Number(spec.dot_size_deg ?? 0.1) / apertureDiameter) *
            canvas.width *
            0.5
        );
        for (let index = 0; index < nDots; index += 1) {
          const angle = signalMask[index]
            ? signalAngle
            : random() * Math.PI * 2;
          positions[index * 2] += step * Math.cos(angle);
          positions[index * 2 + 1] += step * Math.sin(angle);
          ages[index] -= 1;
          const x = positions[index * 2];
          const y = positions[index * 2 + 1];
          if (ages[index] <= 0 || x * x + y * y > radiusDeg * radiusDeg) {
            respawn(index);
          }
          const px =
            canvas.width / 2 +
            (positions[index * 2] / apertureDiameter) * canvas.width;
          const py =
            canvas.height / 2 -
            (positions[index * 2 + 1] / apertureDiameter) * canvas.height;
          context.beginPath();
          context.arc(px, py, dotRadiusPx, 0, Math.PI * 2);
          context.fill();
        }
        frameId = window.requestAnimationFrame(renderFrame);
      };
      frameId = window.requestAnimationFrame(renderFrame);
      animationCleanupSink.push(() => {
        stopped = true;
        window.cancelAnimationFrame(frameId);
      });
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
        response_count: 0,
        response_times: [],
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
    const activeMovies: HTMLVideoElement[] = [];
    const activeAnimationCleanups: Array<() => void> = [];
    for (const stim of execution.stimuli) {
      const childCount = stageRoot.children.length;
      renderStimulus(
        stageRoot,
        stim.spec,
        activeMovies,
        activeAnimationCleanups
      );
      const rendered = stageRoot.children.item(childCount);
      if (rendered instanceof HTMLElement && stim.stim_id) {
        rendered.dataset.psyflowStimId = stim.stim_id;
      }
    }
    const stopSpeech = speakStimuli(execution.stimuli.map((stim: ResolvedStageStimulus) => stim.spec));
    const stopSounds = playSoundStimuli(
      execution.stimuli
        .map((stim: ResolvedStageStimulus) => stim.spec)
        .filter((spec): spec is SoundStimSpec => spec.type === "sound")
    );

    const onsetEpochSeconds = Date.now() / 1000;
    const stageStart = performance.now();
    const primaryStimId =
      typeof execution.context.stim_id === "string" ? execution.context.stim_id : execution.stimuli[0]?.stim_id ?? null;
    const deadlineSeconds =
      execution.context.deadline_s == null
        ? execution.duration
        : Number(execution.context.deadline_s);

    return new Promise<PsyflowStageResult>((resolve) => {
      let finished = false;
      let timerId: number | null = null;
      let animationFrameId: number | null = null;
      let response: string | null = null;
      let responseCount = 0;
      const responseTimes: number[] = [];
      const responses: string[] = [];
      const responsePositions: Array<[number, number]> = [];
      const selectionTriggers: Array<number | null> = [];
      let completionTrigger: number | null = null;
      let rtSeconds: number | null = null;
      let hit: boolean | null = stage.op === "capture_response" ? false : null;
      let timeoutTriggered = false;
      let timeoutTime: number | null = null;
      let keyboardListening = false;
      const validKeys = (execution.response_cfg?.keys ?? ["space"]).map((key: string) => key.toLowerCase());
      const rawCorrectKeys = execution.response_cfg?.correct_keys ?? execution.response_cfg?.keys ?? [];
      const correctKeys = (Array.isArray(rawCorrectKeys) ? rawCorrectKeys : [rawCorrectKeys]).map((key) =>
        normalizeKeyForListener(String(key))
      );
      const graceSeconds = Math.max(0, Number(execution.response_cfg?.grace_s ?? 0));
      const countResponses = Boolean(execution.response_cfg?.count_responses);
      const dynamicTextElements = Array.from(
        stageRoot.querySelectorAll<HTMLElement>('[data-psyflow-dynamic-text="elapsed_ms"]')
      );

      const updateDynamicText = () => {
        if (finished) {
          return;
        }
        const elapsedMs = Math.max(0, Math.round(performance.now() - stageStart));
        for (const element of dynamicTextElements) {
          const digits = Math.max(1, Number(element.dataset.psyflowDynamicDigits ?? 5));
          const maxValue = 10 ** digits - 1;
          const value = Math.min(maxValue, elapsedMs);
          const suffix = element.dataset.psyflowDynamicSuffix ?? "";
          element.textContent = `${String(value).padStart(digits, "0")}${suffix}`;
        }
        animationFrameId = window.requestAnimationFrame(updateDynamicText);
      };

      if (dynamicTextElements.length > 0) {
        animationFrameId = window.requestAnimationFrame(updateDynamicText);
      }

      const keydownListener = (event: KeyboardEvent) => {
        if (!keyboardListening || finished || (!countResponses && response !== null) || event.repeat) {
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
        const responseRt = (performance.now() - stageStart) / 1000;
        responseCount += 1;
        responseTimes.push(responseRt);
        if (response === null) {
          response = recordedKey;
          rtSeconds = responseRt;
        }
        if (stage.op === "capture_response") {
          hit = correctKeys.length > 0 ? correctKeys.includes(normalizeKeyForListener(recordedKey)) : true;
        }
        if (execution.response_cfg?.terminate_on_response ?? false) {
          finish((performance.now() - stageStart) / 1000);
        }
      };

      const pointerListener = (event: PointerEvent) => {
        if (finished || stage.op !== "capture_pointer_sequence") {
          return;
        }
        const element = (event.target as Element | null)?.closest<HTMLElement>("[data-psyflow-stim-id]");
        const targetId = element?.dataset.psyflowStimId;
        const pointerCfg = execution.pointer_cfg;
        if (!element || !targetId || !pointerCfg?.target_ids.includes(targetId)) {
          return;
        }
        event.preventDefault();
        const responseRt = (performance.now() - stageStart) / 1000;
        const selectionTrigger = pointerCfg.selection_trigger;
        const resolvedTrigger =
          typeof selectionTrigger === "number"
            ? selectionTrigger
            : selectionTrigger && typeof selectionTrigger === "object"
              ? Number(selectionTrigger[targetId] ?? NaN)
              : NaN;
        responses.push(targetId);
        responseTimes.push(responseRt);
        responsePositions.push([event.clientX, event.clientY]);
        selectionTriggers.push(Number.isFinite(resolvedTrigger) ? resolvedTrigger : null);
        responseCount = responses.length;
        response = targetId;
        rtSeconds = responseRt;
        const highlightColor = pointerCfg.highlight_color ?? "#34d399";
        const oldBackground = element.style.background;
        element.style.background = highlightColor;
        window.setTimeout(() => {
          element.style.background = oldBackground;
        }, Math.max(0, Number(pointerCfg.highlight_duration_s ?? 0.15)) * 1000);
        if (responses.length >= pointerCfg.max_selections) {
          completionTrigger = pointerCfg.complete_trigger ?? null;
          finish(responseRt);
        }
      };

      const abortListener = () => {
        finish((performance.now() - stageStart) / 1000, true);
      };

      const cleanup = () => {
        if (timerId != null) {
          window.clearTimeout(timerId);
        }
        if (animationFrameId != null) {
          window.cancelAnimationFrame(animationFrameId);
        }
        keyboardListening = false;
        stopSpeech?.();
        stopSounds?.();
        for (const movie of activeMovies) {
          movie.pause();
          movie.currentTime = 0;
          movie.removeAttribute("src");
          movie.load();
        }
        for (const stopAnimation of activeAnimationCleanups) {
          stopAnimation();
        }
        window.removeEventListener("keydown", keydownListener, true);
        document.removeEventListener("keydown", keydownListener, true);
        display_element.removeEventListener("keydown", keydownListener, true);
        stageRoot.removeEventListener("keydown", keydownListener, true);
        stageRoot.removeEventListener("pointerdown", pointerListener, true);
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
          key_press: responseCount > 0,
          response_count: responseCount,
          response_times: responseTimes,
          responses,
          response_positions: responsePositions,
          first_rt: responseTimes[0] ?? null,
          completed: stage.op === "capture_pointer_sequence" ? responses.length >= (execution.pointer_cfg?.max_selections ?? 1) : undefined,
          selection_triggers: selectionTriggers,
          completion_trigger: completionTrigger,
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

      if (stage.op === "capture_pointer_sequence") {
        stageRoot.addEventListener("pointerdown", pointerListener, true);
        if (execution.duration != null) {
          timerId = window.setTimeout(() => {
            timeoutTriggered = responses.length < (execution.pointer_cfg?.max_selections ?? 1);
            timeoutTime = timeoutTriggered ? execution.duration : null;
            finish((performance.now() - stageStart) / 1000);
          }, Math.max(0, execution.duration * 1000));
        }
        return;
      }

      startKeyboardListener();
      if (execution.duration != null) {
        const timeoutMs = Math.max(0, (execution.duration + graceSeconds) * 1000);
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
