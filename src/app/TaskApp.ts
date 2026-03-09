import type { CompiledTrial } from "../core/types";
import { SubInfo } from "../core/SubInfo";
import type { StimBank } from "../core/StimBank";
import type { TaskSettings } from "../core/TaskSettings";
import {
  runPsyflowExperiment,
  type PsyflowRunResult,
  type PsyflowRunSession
} from "../jspsych/runtime";

declare global {
  interface Window {
    __PSYFLOW_WEB_LAST_RESULT__?: PsyflowRunResult;
    __PSYFLOW_WEB_ACTIVE_SESSION__?: PsyflowWindowControl;
  }
}

interface PsyflowWindowControl {
  forceQuit: (reason?: string) => void;
}

export interface MountTaskAppOptions {
  root: HTMLElement;
  task_id: string;
  task_name?: string;
  task_description?: string;
  settings: TaskSettings;
  subInfo: SubInfo;
  stimBank: StimBank;
  buildTrials: () => Promise<CompiledTrial[]> | CompiledTrial[];
  onResults?: (result: PsyflowRunResult) => void;
}

interface TaskAppElements {
  header: HTMLElement;
  formPanel: HTMLElement;
  preflightPanel: HTMLElement;
  taskPanel: HTMLElement;
  resultPanel: HTMLElement;
}

interface ShortcutSpec {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string;
}

function ensureTaskAppStyles(): void {
  if (document.getElementById("psyflow-task-app-styles")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "psyflow-task-app-styles";
  style.textContent = `
    .psyflow-task-app {
      min-height: 100vh;
      padding: 24px;
      background:
        radial-gradient(circle at 12% 8%, rgba(245, 193, 181, 0.28), transparent 20%),
        radial-gradient(circle at 86% 16%, rgba(185, 220, 235, 0.28), transparent 22%),
        radial-gradient(circle at 80% 82%, rgba(57, 217, 93, 0.1), transparent 20%),
        linear-gradient(180deg, #f4efe9 0%, #f1ece6 100%);
      color: #25314d;
      font-family: "DM Sans", "Segoe UI", sans-serif;
      box-sizing: border-box;
    }
    .psyflow-task-shell {
      width: min(1080px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }
    .psyflow-task-panel {
      border: 2px solid #25314d;
      background: #fffdf9;
      border-radius: 28px;
      box-shadow: 0 6px 0 #25314d;
    }
    .psyflow-task-header,
    .psyflow-task-body,
    .psyflow-task-result {
      padding: 22px 24px;
    }
    .psyflow-task-header h1 {
      margin: 0 0 8px;
      font-size: clamp(2rem, 5vw, 3.2rem);
      line-height: 0.94;
      letter-spacing: -0.04em;
      color: #25314d;
      font-family: "Baloo 2", "DM Sans", sans-serif;
    }
    .psyflow-task-header p,
    .psyflow-task-preflight p,
    .psyflow-task-result p {
      margin: 0;
      color: rgba(37, 49, 77, 0.84);
      line-height: 1.5;
    }
    .psyflow-task-preflight {
      display: grid;
      gap: 16px;
    }
    .psyflow-task-preflight dl {
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .psyflow-task-preflight dt {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(37, 49, 77, 0.7);
    }
    .psyflow-task-preflight dd {
      margin: 4px 0 0;
      font-weight: 700;
      color: #25314d;
    }
    .psyflow-task-button,
    .psyflow-download-button,
    .psyflow-subinfo-form button {
      appearance: none;
      border: 2px solid #25314d;
      border-radius: 18px;
      padding: 12px 16px;
      font: inherit;
      background: #39d95d;
      color: white;
      cursor: pointer;
      font-weight: 700;
      box-shadow: 0 4px 0 #25314d;
      transition: transform 120ms ease;
    }
    .psyflow-task-button:hover,
    .psyflow-download-button:hover,
    .psyflow-subinfo-form button:hover {
      transform: translateY(-1px);
    }
    .psyflow-download-button {
      background: #d7ebf6;
      color: #25314d;
    }
    .psyflow-task-button[disabled] {
      opacity: 0.72;
      cursor: progress;
      transform: none;
      box-shadow: none;
    }
    .psyflow-task-runtime {
      min-height: 72vh;
      overflow: hidden;
      background: #fffdf9;
    }
    .psyflow-task-runtime--hide-cursor,
    .psyflow-task-runtime--hide-cursor * {
      cursor: none !important;
    }
    .psyflow-task-runtime:fullscreen,
    .psyflow-task-runtime:-webkit-full-screen {
      width: 100vw;
      height: 100vh;
      min-height: 100vh;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      background: var(--psyflow-runtime-bg, #000);
    }
    .psyflow-task-result-card {
      display: grid;
      gap: 10px;
    }
    .psyflow-task-result-card h2,
    .psyflow-task-result-card h1 {
      margin: 0;
      color: #25314d;
      font-family: "Baloo 2", "DM Sans", sans-serif;
    }
    .psyflow-task-result-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .psyflow-task-preview {
      margin: 0;
      padding: 18px;
      border-radius: 18px;
      border: 2px solid #25314d;
      background: #25314d;
      color: #f8fafc;
      overflow: auto;
      max-height: 360px;
      font-size: 0.86rem;
    }
    .psyflow-subinfo {
      display: grid;
      gap: 16px;
    }
    .psyflow-subinfo h1 {
      margin: 0;
      font-size: 1.35rem;
      color: #25314d;
      font-family: "Baloo 2", "DM Sans", sans-serif;
    }
    .psyflow-subinfo-form {
      display: grid;
      gap: 14px;
    }
    .psyflow-subinfo-field {
      display: grid;
      gap: 6px;
      font-size: 0.92rem;
      color: rgba(37, 49, 77, 0.84);
      font-weight: 700;
    }
    .psyflow-subinfo-field input,
    .psyflow-subinfo-field select {
      appearance: none;
      border: 2px solid #25314d;
      border-radius: 18px;
      padding: 12px 14px;
      font: inherit;
      box-shadow: 0 4px 0 #25314d;
    }
    .psyflow-subinfo-error {
      min-height: 1.25rem;
      color: #b91c1c;
      font-size: 0.9rem;
    }
    @media (max-width: 720px) {
      .psyflow-task-app {
        padding: 16px;
      }
      .psyflow-task-header,
      .psyflow-task-body,
      .psyflow-task-result {
        padding: 18px;
      }
      .psyflow-task-runtime {
        min-height: 64vh;
      }
    }
  `;
  document.head.appendChild(style);
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "psyflow-download-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createDownloadButton(
  label: string,
  filename: string,
  contents: string,
  mimeType: string
): HTMLButtonElement {
  return createButton(label, () => {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

function createShell(options: MountTaskAppOptions): TaskAppElements {
  document.title = `${options.task_name ?? options.task_id} | Preview`;
  const app = document.createElement("div");
  app.className = "psyflow-task-app";
  app.dataset.taskId = options.task_id;
  const shell = document.createElement("div");
  shell.className = "psyflow-task-shell";

  const header = document.createElement("section");
  header.className = "psyflow-task-panel psyflow-task-header";
  header.innerHTML = `
    <h1>${options.task_name ?? options.task_id}</h1>
    <p>${options.task_description ?? "A browser preview task running on the shared TaskBeacon web runtime."}</p>
  `;

  const formPanel = document.createElement("section");
  formPanel.id = "psyflow-task-form";
  formPanel.className = "psyflow-task-panel psyflow-task-body";

  const preflightPanel = document.createElement("section");
  preflightPanel.id = "psyflow-task-preflight";
  preflightPanel.className = "psyflow-task-panel psyflow-task-body";
  preflightPanel.hidden = true;

  const taskPanel = document.createElement("section");
  taskPanel.id = "psyflow-task-runtime";
  taskPanel.className = "psyflow-task-panel psyflow-task-runtime";
  taskPanel.hidden = true;

  const resultPanel = document.createElement("section");
  resultPanel.id = "psyflow-task-results";
  resultPanel.className = "psyflow-task-panel psyflow-task-result";
  resultPanel.hidden = true;

  shell.append(header, formPanel, preflightPanel, taskPanel, resultPanel);
  app.appendChild(shell);
  options.root.innerHTML = "";
  options.root.appendChild(app);

  return {
    header,
    formPanel,
    preflightPanel,
    taskPanel,
    resultPanel
  };
}

function getKeyboardLockApi(): {
  lock?: (keys?: string[]) => Promise<void>;
  unlock?: () => void;
} | null {
  const keyboard = (
    navigator as Navigator & {
      keyboard?: {
        lock?: (keys?: string[]) => Promise<void>;
        unlock?: () => void;
      };
    }
  ).keyboard;
  return keyboard ?? null;
}

async function requestEscapeLock(enabled: boolean): Promise<void> {
  if (!enabled) {
    return;
  }
  const keyboard = getKeyboardLockApi();
  if (!keyboard?.lock) {
    return;
  }
  try {
    await keyboard.lock(["Escape"]);
  } catch {
    // Keyboard Lock is best-effort only.
  }
}

function releaseEscapeLock(): void {
  try {
    getKeyboardLockApi()?.unlock?.();
  } catch {
    // Ignore unlock failures during teardown.
  }
}

function shouldLockEscape(settings: TaskSettings): boolean {
  return settings.fullscreen !== false && settings.fullscreen_lock_escape !== false;
}

function shouldHideCursor(settings: TaskSettings): boolean {
  if (typeof settings.hide_cursor === "boolean") {
    return settings.hide_cursor;
  }
  return String(settings.input_mode ?? "").toLowerCase() === "keyboard";
}

function normalizeShortcutKey(event: KeyboardEvent): string {
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
  const key = event.key.toLowerCase();
  if (key === " ") {
    return "space";
  }
  return key;
}

function resolveForceQuitShortcut(settings: TaskSettings): ShortcutSpec | null {
  if (settings.force_quit_enabled === false) {
    return null;
  }
  const raw = settings.force_quit_shortcut;
  const tokens =
    typeof raw === "string" && raw.trim().length > 0
      ? raw
          .split("+")
          .map((token) => token.trim().toLowerCase())
          .filter(Boolean)
      : ["ctrl", "shift", "q"];
  const shortcut: ShortcutSpec = {
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
    key: ""
  };
  for (const token of tokens) {
    if (token === "ctrl" || token === "control") {
      shortcut.ctrl = true;
      continue;
    }
    if (token === "shift") {
      shortcut.shift = true;
      continue;
    }
    if (token === "alt" || token === "option") {
      shortcut.alt = true;
      continue;
    }
    if (token === "meta" || token === "cmd" || token === "command") {
      shortcut.meta = true;
      continue;
    }
    shortcut.key = token;
  }
  return shortcut.key ? shortcut : null;
}

function formatShortcut(shortcut: ShortcutSpec | null): string | null {
  if (!shortcut) {
    return null;
  }
  const tokens: string[] = [];
  if (shortcut.ctrl) {
    tokens.push("Ctrl");
  }
  if (shortcut.shift) {
    tokens.push("Shift");
  }
  if (shortcut.alt) {
    tokens.push("Alt");
  }
  if (shortcut.meta) {
    tokens.push("Meta");
  }
  tokens.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return tokens.join("+");
}

function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutSpec): boolean {
  return (
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt &&
    event.metaKey === shortcut.meta &&
    normalizeShortcutKey(event) === shortcut.key
  );
}

async function requestTaskFullscreen(target: HTMLElement, enabled: boolean): Promise<void> {
  if (!enabled || !document.fullscreenEnabled || document.fullscreenElement) {
    return;
  }
  try {
    await target.requestFullscreen();
  } catch {
    // Fullscreen can fail due to browser policies; the task should still run.
  }
}

async function exitTaskFullscreen(target: HTMLElement): Promise<void> {
  if (document.fullscreenElement === target) {
    await document.exitFullscreen();
  }
}

async function waitForPreflightStart(
  elements: TaskAppElements,
  options: MountTaskAppOptions,
  subjectData: Record<string, string | number>,
  operatorShortcutLabel: string | null
): Promise<void> {
  const keyList = Array.isArray(options.settings.key_list) ? options.settings.key_list.join(", ") : "space";
  elements.preflightPanel.hidden = false;
  elements.preflightPanel.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "psyflow-task-preflight";
  wrapper.innerHTML = `
    <p>The task is ready. The shared runner will enter fullscreen before starting.</p>
    <dl>
      <div>
        <dt>Participant</dt>
        <dd>${String(subjectData.subject_id ?? "unknown")}</dd>
      </div>
      <div>
        <dt>Response Keys</dt>
        <dd>${keyList}</dd>
      </div>
      <div>
        <dt>Fullscreen</dt>
        <dd>${options.settings.fullscreen === false ? "disabled" : "enabled"}</dd>
      </div>
      ${
        operatorShortcutLabel
          ? `<div>
        <dt>Operator Quit</dt>
        <dd>${operatorShortcutLabel}</dd>
      </div>`
          : ""
      }
    </dl>
  `;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "psyflow-task-button";
  button.textContent =
    options.settings.fullscreen === false ? "Start Task" : "Enter Fullscreen and Start";
  wrapper.appendChild(button);
  elements.preflightPanel.appendChild(wrapper);

  await new Promise<void>((resolve) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      elements.preflightPanel.hidden = true;
      elements.taskPanel.hidden = false;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      await requestTaskFullscreen(elements.taskPanel, options.settings.fullscreen !== false);
      await requestEscapeLock(shouldLockEscape(options.settings));
      await new Promise<void>((resolveAnimation) => {
        requestAnimationFrame(() => {
          elements.taskPanel.focus();
          resolveAnimation();
        });
      });
      resolve();
    });
  });
}

function renderResultPanel(
  resultPanel: HTMLElement,
  taskId: string,
  result: PsyflowRunResult
): void {
  resultPanel.hidden = false;
  resultPanel.innerHTML = "";

  const totalScore = result.reduced_rows.reduce((sum, row) => sum + Number(row.feedback_delta ?? 0), 0);
  const card = document.createElement("div");
  card.className = "psyflow-task-result-card";

  const heading = document.createElement("h2");
  heading.textContent = result.aborted ? `${taskId} interrupted` : `${taskId} complete`;
  const reducedCount = document.createElement("p");
  reducedCount.textContent = `Reduced trials: ${result.reduced_rows.length}`;
  const rawCount = document.createElement("p");
  rawCount.textContent = `Raw stage rows: ${result.raw_rows.length}`;
  card.append(heading, reducedCount, rawCount);

  if (result.abort_reason) {
    const abortReason = document.createElement("p");
    abortReason.textContent = `Abort reason: ${result.abort_reason}`;
    card.appendChild(abortReason);
  }

  if (result.reduced_rows.some((row) => Object.prototype.hasOwnProperty.call(row, "feedback_delta"))) {
    const score = document.createElement("p");
    score.textContent = `Total score: ${totalScore}`;
    card.appendChild(score);
  }

  const actions = document.createElement("div");
  actions.className = "psyflow-task-result-actions";
  actions.appendChild(
    createDownloadButton("Download raw.jsonl", `${taskId}_raw.jsonl`, result.raw_jsonl, "application/jsonl")
  );
  actions.appendChild(
    createDownloadButton("Download reduced.csv", `${taskId}_reduced.csv`, result.reduced_csv, "text/csv")
  );
  actions.appendChild(
    createDownloadButton(
      "Download reduced.json",
      `${taskId}_reduced.json`,
      result.reduced_json,
      "application/json"
    )
  );
  card.appendChild(actions);

  const preview = document.createElement("pre");
  preview.className = "psyflow-task-preview";
  preview.textContent = result.reduced_json;

  resultPanel.append(card, preview);
}

function renderErrorPanel(resultPanel: HTMLElement, error: unknown): void {
  resultPanel.hidden = false;
  resultPanel.innerHTML = "";
  const card = document.createElement("div");
  card.className = "psyflow-task-result-card";
  card.innerHTML = `
    <h2>Runtime Error</h2>
    <pre>${String(error instanceof Error ? error.stack ?? error.message : error)}</pre>
  `;
  resultPanel.appendChild(card);
}

export async function mountTaskApp(options: MountTaskAppOptions): Promise<PsyflowRunResult> {
  ensureTaskAppStyles();
  const elements = createShell(options);
  const forceQuitShortcut = resolveForceQuitShortcut(options.settings);
  const hideCursor = shouldHideCursor(options.settings);
  let activeSession: PsyflowRunSession | null = null;
  let pendingAbortReason: string | null = null;
  let runtimeArmed = false;
  let allowFullscreenExit = false;
  elements.taskPanel.style.setProperty(
    "--psyflow-runtime-bg",
    typeof options.settings.bg_color === "string" ? options.settings.bg_color : "#000"
  );
  elements.taskPanel.tabIndex = 0;
  window.__PSYFLOW_WEB_LAST_RESULT__ = undefined;
  window.__PSYFLOW_WEB_ACTIVE_SESSION__ = undefined;

  const requestInterrupt = (reason = "force_quit"): void => {
    pendingAbortReason ??= reason;
    activeSession?.forceQuit(reason);
  };

  const onForceQuitKeydown = (event: KeyboardEvent) => {
    if (!runtimeArmed || !forceQuitShortcut || !matchesShortcut(event, forceQuitShortcut)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    requestInterrupt("force_quit");
  };

  const onFullscreenChange = () => {
    if (!runtimeArmed || allowFullscreenExit || options.settings.fullscreen === false) {
      return;
    }
    if (document.fullscreenElement === elements.taskPanel) {
      return;
    }
    requestInterrupt("fullscreen_exited");
  };

  const cleanupRuntimePresentation = async (): Promise<void> => {
    runtimeArmed = false;
    activeSession = null;
    allowFullscreenExit = true;
    elements.taskPanel.classList.remove("psyflow-task-runtime--hide-cursor");
    window.removeEventListener("keydown", onForceQuitKeydown, true);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    window.__PSYFLOW_WEB_ACTIVE_SESSION__ = undefined;
    releaseEscapeLock();
    await exitTaskFullscreen(elements.taskPanel);
  };

  try {
    const subjectData = await options.subInfo.collect(elements.formPanel);
    options.settings.add_subinfo(subjectData);
    elements.formPanel.hidden = true;

    await waitForPreflightStart(elements, options, subjectData, formatShortcut(forceQuitShortcut));
    runtimeArmed = true;
    allowFullscreenExit = false;
    elements.taskPanel.classList.toggle("psyflow-task-runtime--hide-cursor", hideCursor);
    window.__PSYFLOW_WEB_ACTIVE_SESSION__ = {
      forceQuit: requestInterrupt
    };
    window.addEventListener("keydown", onForceQuitKeydown, true);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    const trials = await options.buildTrials();
    const result = await runPsyflowExperiment({
      display_element: elements.taskPanel,
      stimBank: options.stimBank,
      trials,
      settings: options.settings,
      onSessionStart: (session) => {
        activeSession = session;
        if (pendingAbortReason) {
          session.forceQuit(pendingAbortReason);
        }
      }
    });

    await cleanupRuntimePresentation();
    window.__PSYFLOW_WEB_LAST_RESULT__ = result;
    elements.taskPanel.hidden = true;
    renderResultPanel(elements.resultPanel, options.task_id, result);
    options.onResults?.(result);
    return result;
  } catch (error) {
    await cleanupRuntimePresentation();
    elements.taskPanel.hidden = true;
    renderErrorPanel(elements.resultPanel, error);
    throw error;
  }
}
