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
        radial-gradient(circle at top left, rgba(34, 211, 238, 0.18), transparent 32%),
        radial-gradient(circle at top right, rgba(249, 115, 22, 0.18), transparent 24%),
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
      width: min(880px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }
    .psyflow-runner-card {
      background: rgba(255, 255, 255, 0.84);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.07);
      backdrop-filter: blur(16px);
      padding: 22px 24px;
    }
    .psyflow-runner-card h1,
    .psyflow-runner-card h2,
    .psyflow-runner-card p {
      margin: 0;
    }
    .psyflow-runner-card h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      letter-spacing: -0.06em;
      margin-bottom: 10px;
    }
    .psyflow-runner-card h2 {
      margin-bottom: 10px;
      font-size: 1rem;
      letter-spacing: -0.03em;
    }
    .psyflow-runner-card p {
      color: #334155;
      line-height: 1.5;
    }
    .psyflow-runner-form {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }
    .psyflow-runner-form label {
      display: grid;
      gap: 6px;
      font-size: 0.92rem;
      color: #334155;
    }
    .psyflow-runner-form input {
      appearance: none;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 14px;
      padding: 12px 14px;
      font: inherit;
    }
    .psyflow-runner-form button,
    .psyflow-runner-link {
      appearance: none;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 14px;
      padding: 12px 16px;
      font: inherit;
      background: #0f172a;
      color: white;
      cursor: pointer;
      text-decoration: none;
      text-align: left;
    }
    .psyflow-runner-catalog {
      display: grid;
      gap: 10px;
      margin-top: 18px;
    }
    .psyflow-runner-task-list {
      display: grid;
      gap: 10px;
    }
    .psyflow-runner-link small {
      display: block;
      margin-top: 4px;
      opacity: 0.78;
      font-size: 0.8rem;
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
  `;
  document.head.appendChild(style);
}

function normalizeTaskKey(taskValue: string): string {
  return taskValue.trim();
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

function resolveTaskEntry(module: TaskModuleExport): ((root: HTMLElement) => Promise<unknown> | unknown) | null {
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

function buildTaskCatalog(activeDirectory: string | null): string {
  if (taskEntries.length === 0) {
    return `
      <div class="psyflow-runner-catalog">
        <h2>Available Tasks</h2>
        <p>No HTML tasks were discovered in this build.</p>
      </div>
    `;
  }

  const items = taskEntries
    .map((entry) => {
      const activeSuffix = entry.directory === activeDirectory ? " (current)" : "";
      return `
        <a class="psyflow-runner-link" href="?task=${encodeURIComponent(entry.directory)}">
          ${entry.title}${activeSuffix}
          <small>${entry.directory}${entry.slug ? ` · ${entry.slug}` : ""}</small>
        </a>
      `;
    })
    .join("");

  return `
    <div class="psyflow-runner-catalog">
      <h2>Available Tasks</h2>
      <div class="psyflow-runner-task-list">${items}</div>
    </div>
  `;
}

function renderLauncher(
  formCard: HTMLElement,
  taskValue: string,
  activeTask: RunnerTaskManifestEntry | null
): void {
  const activeDirectory = activeTask?.directory ?? null;
  formCard.innerHTML = `
    <h1>psyflow-web</h1>
    <p>Shared browser runner for TAPS-style HTML tasks.</p>
    <form class="psyflow-runner-form">
      <label>
        Task Directory
        <input name="task" placeholder="H000006-mid" value="${taskValue}" />
      </label>
      <button type="submit">Open Task</button>
    </form>
    ${buildTaskCatalog(activeDirectory)}
  `;
  const form = formCard.querySelector<HTMLFormElement>(".psyflow-runner-form");
  if (!form) {
    return;
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>('input[name="task"]');
    const nextTask = input?.value.trim() ?? "";
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
