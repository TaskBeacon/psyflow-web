import {
  taskEntries,
  taskManifest,
  type RunnerTaskManifestEntry
} from "./generated/taskManifest";

type TaskModuleExport = {
  main?: (root: HTMLElement) => Promise<unknown> | unknown;
  default?:
    | ((root: HTMLElement) => Promise<unknown> | unknown)
    | { main?: (root: HTMLElement) => Promise<unknown> | unknown };
};

function ensureRunnerStyles(): void {
  if (document.getElementById("psyflow-runner-styles")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "psyflow-runner-styles";
  style.textContent = `
    :root {
      color-scheme: light;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(34, 211, 238, 0.16), transparent 34%),
        radial-gradient(circle at bottom right, rgba(5, 150, 105, 0.12), transparent 30%),
        linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
      color: #0f172a;
    }
    body {
      margin: 0;
      min-height: 100vh;
    }
    .psyflow-runner {
      min-height: 100vh;
      padding: 24px;
      box-sizing: border-box;
    }
    .psyflow-runner-shell {
      width: min(920px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }
    .psyflow-runner-card {
      background: rgba(255, 255, 255, 0.88);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 28px;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.07);
      backdrop-filter: blur(16px);
      padding: 24px;
    }
    .psyflow-runner-card h1,
    .psyflow-runner-card h2,
    .psyflow-runner-card p {
      margin: 0;
    }
    .psyflow-runner-kicker {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #0f766e;
    }
    .psyflow-runner-card h1 {
      margin-top: 12px;
      font-size: clamp(2.1rem, 5vw, 3.2rem);
      letter-spacing: -0.06em;
    }
    .psyflow-runner-card h2 {
      margin-bottom: 10px;
      font-size: 1rem;
      letter-spacing: -0.03em;
    }
    .psyflow-runner-card p {
      color: #334155;
      line-height: 1.6;
    }
    .psyflow-runner-form {
      display: grid;
      gap: 12px;
      margin-top: 18px;
    }
    .psyflow-runner-field {
      display: grid;
      gap: 6px;
      font-size: 0.92rem;
      color: #334155;
    }
    .psyflow-runner-input,
    .psyflow-runner-select {
      appearance: none;
      width: 100%;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 14px;
      padding: 12px 14px;
      font: inherit;
      background: white;
      color: #0f172a;
      box-sizing: border-box;
    }
    .psyflow-runner-button {
      appearance: none;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 14px;
      padding: 12px 16px;
      font: inherit;
      background: linear-gradient(135deg, #0f766e, #155e75);
      color: white;
      cursor: pointer;
      font-weight: 600;
      box-shadow: 0 12px 24px rgba(15, 118, 110, 0.16);
    }
    .psyflow-runner-button:hover {
      filter: brightness(1.03);
    }
    .psyflow-runner-meta {
      display: grid;
      gap: 10px;
      margin-top: 18px;
      padding: 16px 18px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 20px;
      background: rgba(248, 250, 252, 0.9);
    }
    .psyflow-runner-meta-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
      font-size: 0.92rem;
      color: #334155;
    }
    .psyflow-runner-meta-row strong {
      color: #0f172a;
    }
    .psyflow-runner-current {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .psyflow-runner-pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid rgba(15, 23, 42, 0.1);
      border-radius: 999px;
      background: white;
      padding: 6px 10px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #0f172a;
    }
    .psyflow-runner-empty {
      font-size: 0.88rem;
      color: #64748b;
    }
    .psyflow-runner-task {
      min-height: 60vh;
    }
    .psyflow-runner-error {
      white-space: pre-wrap;
      font-family: "IBM Plex Mono", "Cascadia Code", monospace;
      font-size: 0.9rem;
      color: #7f1d1d;
    }
    @media (min-width: 760px) {
      .psyflow-runner-form {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) auto;
        align-items: end;
      }
    }
    @media (max-width: 720px) {
      .psyflow-runner {
        padding: 16px;
      }
      .psyflow-runner-card {
        padding: 18px;
        border-radius: 24px;
      }
    }
  `;
  document.head.appendChild(style);
}

function normalizeTaskKey(taskValue: string): string {
  return taskValue.trim();
}

function matchesCatalogQuery(entry: RunnerTaskManifestEntry, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return [entry.directory, entry.id ?? "", entry.slug ?? "", entry.title]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function resolveManifestEntry(taskValue: string): RunnerTaskManifestEntry | null {
  const normalized = normalizeTaskKey(taskValue);
  if (!normalized) {
    return null;
  }
  if (taskManifest[normalized]) {
    return taskManifest[normalized];
  }
  return (
    taskEntries.find((entry) => entry.id === normalized || entry.slug === normalized) ?? null
  );
}

function resolveTaskEntry(
  module: TaskModuleExport
): ((root: HTMLElement) => Promise<unknown> | unknown) | null {
  if (typeof module.main === "function") {
    return module.main;
  }
  if (typeof module.default === "function") {
    return module.default;
  }
  if (module.default && typeof module.default === "object" && typeof module.default.main === "function") {
    return module.default.main;
  }
  return null;
}

function mountRunnerShell(root: HTMLElement): {
  taskRoot: HTMLElement;
  formCard: HTMLElement;
  errorCard: HTMLElement;
} {
  ensureRunnerStyles();
  root.innerHTML = "";
  const app = document.createElement("div");
  app.className = "psyflow-runner";
  const shell = document.createElement("div");
  shell.className = "psyflow-runner-shell";

  const formCard = document.createElement("section");
  formCard.className = "psyflow-runner-card";

  const taskRoot = document.createElement("section");
  taskRoot.className = "psyflow-runner-task";

  const errorCard = document.createElement("section");
  errorCard.className = "psyflow-runner-card";
  errorCard.hidden = true;

  shell.append(formCard, errorCard, taskRoot);
  app.appendChild(shell);
  root.appendChild(app);

  return { taskRoot, formCard, errorCard };
}

function populateTaskSelect(
  select: HTMLSelectElement,
  filterValue: string,
  requestedValue: string
): RunnerTaskManifestEntry[] {
  const filteredEntries = taskEntries.filter((entry) => matchesCatalogQuery(entry, filterValue));
  select.innerHTML = "";

  if (filteredEntries.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No matching tasks";
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
    return filteredEntries;
  }

  for (const entry of filteredEntries) {
    const option = document.createElement("option");
    option.value = entry.directory;
    option.textContent = `${entry.directory} - ${entry.title}`;
    select.appendChild(option);
  }

  const resolvedRequested = resolveManifestEntry(requestedValue)?.directory ?? requestedValue;
  const selectedValue = filteredEntries.some((entry) => entry.directory === resolvedRequested)
    ? resolvedRequested
    : filteredEntries[0]?.directory ?? "";
  select.value = selectedValue;

  return filteredEntries;
}

function updateLauncherMeta(
  formCard: HTMLElement,
  filteredEntries: RunnerTaskManifestEntry[],
  currentValue: string
): void {
  const countNode = formCard.querySelector<HTMLElement>("[data-role='task-count']");
  const currentNode = formCard.querySelector<HTMLElement>("[data-role='current-task']");
  if (!countNode || !currentNode) {
    return;
  }

  countNode.textContent = `${filteredEntries.length} task${filteredEntries.length === 1 ? "" : "s"} available`;
  const currentEntry = resolveManifestEntry(currentValue);
  if (!currentEntry) {
    currentNode.innerHTML = `<span class="psyflow-runner-empty">Select a task to launch a preview.</span>`;
    return;
  }

  currentNode.innerHTML = "";
  const title = document.createElement("span");
  title.className = "psyflow-runner-pill";
  title.textContent = currentEntry.title;
  const handle = document.createElement("span");
  handle.className = "psyflow-runner-pill";
  handle.textContent = currentEntry.directory;
  currentNode.append(title, handle);
}

function renderLauncher(
  formCard: HTMLElement,
  taskValue: string,
  activeTask: RunnerTaskManifestEntry | null
): void {
  document.title = activeTask ? `${activeTask.title} | Preview` : "Preview";

  formCard.innerHTML = `
    <div class="psyflow-runner-kicker">TaskBeacon preview</div>
    <h1>Preview</h1>
    <p>Launch a browser preview for an HTML task companion without scanning a long task list.</p>
    <form class="psyflow-runner-form">
      <label class="psyflow-runner-field">
        Filter tasks
        <input class="psyflow-runner-input" name="catalog" placeholder="Search by handle, ID, slug, or title" />
      </label>
      <label class="psyflow-runner-field">
        Available tasks
        <select class="psyflow-runner-select" name="task"></select>
      </label>
      <button class="psyflow-runner-button" type="submit">Open preview</button>
    </form>
    <div class="psyflow-runner-meta">
      <div class="psyflow-runner-meta-row">
        <span>Catalog</span>
        <strong data-role="task-count"></strong>
      </div>
      <div class="psyflow-runner-meta-row">
        <span>Current selection</span>
        <div class="psyflow-runner-current" data-role="current-task"></div>
      </div>
    </div>
  `;

  const form = formCard.querySelector<HTMLFormElement>(".psyflow-runner-form");
  const filterInput = formCard.querySelector<HTMLInputElement>('input[name="catalog"]');
  const select = formCard.querySelector<HTMLSelectElement>('select[name="task"]');
  if (!form || !filterInput || !select) {
    return;
  }
  const catalogInput = filterInput;
  const taskSelect = select;

  const requestedDirectory = activeTask?.directory ?? taskValue;

  function syncCatalog(nextRequested: string): void {
    const filteredEntries = populateTaskSelect(taskSelect, catalogInput.value, nextRequested);
    updateLauncherMeta(formCard, filteredEntries, taskSelect.value || nextRequested);
  }

  syncCatalog(requestedDirectory);

  catalogInput.addEventListener("input", () => {
    syncCatalog(taskSelect.value || requestedDirectory);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextTask = taskSelect.value.trim();
    const url = new URL(window.location.href);
    if (nextTask) {
      url.searchParams.set("task", nextTask);
    } else {
      url.searchParams.delete("task");
    }
    window.location.href = url.toString();
  });
}

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) {
    throw new Error("Runner root #app is missing.");
  }

  const query = new URLSearchParams(window.location.search);
  const requestedTask = query.get("task") ?? "";
  const effectiveTask =
    normalizeTaskKey(requestedTask) || (taskEntries.length === 1 ? taskEntries[0].directory : "");
  const activeTask = resolveManifestEntry(effectiveTask);
  const { taskRoot, formCard, errorCard } = mountRunnerShell(root);
  renderLauncher(formCard, effectiveTask, activeTask);

  if (!effectiveTask) {
    return;
  }

  if (!activeTask) {
    throw new Error(
      `Unknown task '${effectiveTask}'. Available HTML tasks: ${taskEntries
        .map((entry) => entry.directory)
        .join(", ")}`
    );
  }

  try {
    const taskModule = (await activeTask.importTask()) as TaskModuleExport;
    const entry = resolveTaskEntry(taskModule);
    if (!entry) {
      throw new Error(`Task '${activeTask.directory}' does not export a main(root) function.`);
    }
    await entry(taskRoot);
  } catch (error) {
    errorCard.hidden = false;
    errorCard.innerHTML = `
      <h2>Task Load Error</h2>
      <div class="psyflow-runner-error">${String(error instanceof Error ? error.stack ?? error.message : error)}</div>
    `;
    throw error;
  }
}

bootstrap().catch((error) => {
  console.error(error);
});
