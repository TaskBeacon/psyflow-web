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
      font-family: "DM Sans", "Segoe UI", sans-serif;
      --pf-ink: #25314d;
      --pf-paper: #f4efe9;
      --pf-panel: #fffdf9;
      --pf-sky: #b9dceb;
      --pf-sky-soft: #d7ebf6;
      --pf-peach-soft: #ffe9de;
      --pf-mint: #39d95d;
      background:
        radial-gradient(circle at 12% 8%, rgba(245, 193, 181, 0.28), transparent 20%),
        radial-gradient(circle at 86% 16%, rgba(185, 220, 235, 0.28), transparent 22%),
        radial-gradient(circle at 80% 82%, rgba(57, 217, 93, 0.1), transparent 20%),
        linear-gradient(180deg, var(--pf-paper) 0%, #f1ece6 100%);
      color: var(--pf-ink);
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: transparent;
    }
    .psyflow-runner {
      min-height: 100vh;
      padding: 24px;
      box-sizing: border-box;
    }
    .psyflow-runner-shell {
      width: min(980px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }
    .psyflow-runner-card {
      background: var(--pf-panel);
      border: 2px solid var(--pf-ink);
      border-radius: 30px;
      box-shadow: 0 6px 0 var(--pf-ink);
      padding: 24px;
    }
    .psyflow-runner-card h1,
    .psyflow-runner-card h2,
    .psyflow-runner-card p {
      margin: 0;
    }
    .psyflow-runner-kicker {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      background: #c9f7b9;
      padding: 8px 12px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--pf-ink);
    }
    .psyflow-runner-card h1 {
      margin-top: 12px;
      font-size: clamp(2.1rem, 5vw, 3.2rem);
      line-height: 0.94;
      letter-spacing: -0.04em;
      color: var(--pf-ink);
      font-family: "Baloo 2", "DM Sans", sans-serif;
    }
    .psyflow-runner-card h2 {
      margin-bottom: 10px;
      font-size: 1.1rem;
      letter-spacing: -0.03em;
      color: var(--pf-ink);
      font-family: "Baloo 2", "DM Sans", sans-serif;
    }
    .psyflow-runner-card p {
      color: rgba(37, 49, 77, 0.84);
      line-height: 1.6;
    }
    .psyflow-runner-form {
      display: grid;
      gap: 14px;
      margin-top: 20px;
    }
    .psyflow-runner-field {
      display: grid;
      gap: 6px;
      font-size: 0.92rem;
      color: rgba(37, 49, 77, 0.84);
      font-weight: 700;
    }
    .psyflow-runner-input,
    .psyflow-runner-select {
      appearance: none;
      width: 100%;
      border: 2px solid var(--pf-ink);
      border-radius: 18px;
      padding: 12px 14px;
      font: inherit;
      background: white;
      color: var(--pf-ink);
      box-sizing: border-box;
      box-shadow: 0 4px 0 var(--pf-ink);
    }
    .psyflow-runner-button {
      appearance: none;
      border: 2px solid var(--pf-ink);
      border-radius: 18px;
      padding: 13px 18px;
      font: inherit;
      background: var(--pf-mint);
      color: white;
      cursor: pointer;
      font-weight: 700;
      box-shadow: 0 4px 0 var(--pf-ink);
      transition: transform 120ms ease;
    }
    .psyflow-runner-button:hover {
      transform: translateY(-1px);
    }
    .psyflow-runner-meta {
      display: grid;
      gap: 10px;
      margin-top: 18px;
      padding: 16px 18px;
      border: 2px solid var(--pf-ink);
      border-radius: 22px;
      background: #f8fcff;
      box-shadow: 0 4px 0 var(--pf-ink);
    }
    .psyflow-runner-meta-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
      font-size: 0.92rem;
      color: rgba(37, 49, 77, 0.84);
    }
    .psyflow-runner-meta-row strong {
      color: var(--pf-ink);
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
      border: 2px solid var(--pf-ink);
      border-radius: 999px;
      background: white;
      padding: 6px 10px;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--pf-ink);
    }
    .psyflow-runner-empty {
      font-size: 0.88rem;
      color: rgba(37, 49, 77, 0.66);
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
