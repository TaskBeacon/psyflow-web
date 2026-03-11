import { readdir, readFile, stat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageRoot, "..");
const generatedDir = path.join(packageRoot, "src", "generated");
const generatedFile = path.join(generatedDir, "taskManifest.ts");
const publicDir = path.join(packageRoot, "public");
const publicManifestFile = path.join(publicDir, "task-manifest.json");
const ORG = process.env.TASKBEACON_ORG || "TaskBeacon";
const PAGES_ORIGIN =
  process.env.TASKBEACON_PAGES_ORIGIN || `https://${String(ORG).toLowerCase()}.github.io`;
const RUNNER_REPO = process.env.TASKBEACON_HTML_RUNNER_REPO || "psyflow-web";
const RUNNER_URL =
  process.env.TASKBEACON_HTML_RUNNER_URL ||
  `${PAGES_ORIGIN}/${encodeURIComponent(RUNNER_REPO)}/`;

function toImportPath(fromDir, targetFile) {
  const relative = path
    .relative(fromDir, targetFile)
    .replace(/\\/g, "/")
    .replace(/\.ts$/, "");
  if (relative.startsWith(".")) {
    return relative;
  }
  return `./${relative}`;
}

async function isDirectory(absPath) {
  const entry = await stat(absPath);
  return entry.isDirectory();
}

function githubRepoUrl(directory) {
  return `https://github.com/${ORG}/${directory}`;
}

function inferRunUrl(directory) {
  const url = new URL(String(RUNNER_URL));
  url.searchParams.set("task", directory);
  return url.toString();
}

function stripMarkdownInline(text) {
  return String(text ?? "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function firstParagraphDescription(markdown) {
  const text = String(markdown ?? "").replace(/<!--([\s\S]*?)-->/g, "");
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  let buffer = [];
  const paragraphs = [];
  for (const line of lines) {
    if (!line) {
      if (buffer.length > 0) paragraphs.push(buffer);
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
  if (buffer.length > 0) paragraphs.push(buffer);

  for (const paragraph of paragraphs) {
    if (paragraph.every((line) => /^#{1,6}\s+/.test(line))) continue;
    const raw = stripMarkdownInline(paragraph.join(" "));
    if (!raw) continue;
    return raw.length > 160 ? `${raw.slice(0, 157)}...` : raw;
  }

  return "";
}

function readGitTimestamp(taskDir) {
  const result = spawnSync("git", ["-C", taskDir, "log", "-1", "--format=%cI"], {
    encoding: "utf8"
  });
  const output = String(result.stdout ?? "").trim();
  return result.status === 0 && output ? output : null;
}

async function discoverHtmlTasks() {
  const entries = await readdir(repoRoot, { withFileTypes: true });
  const tasks = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !/^H\d{6}-.+/.test(entry.name)) {
      continue;
    }
    const taskDir = path.join(repoRoot, entry.name);
    const taskConfigPath = path.join(taskDir, "taskbeacon.yaml");
    const taskMainPath = path.join(taskDir, "main.ts");

    try {
      const [taskConfigText, readmeText, taskConfigStat] = await Promise.all([
        readFile(taskConfigPath, "utf8"),
        readFile(path.join(taskDir, "README.md"), "utf8").catch(() => ""),
        stat(taskConfigPath),
        stat(taskMainPath)
      ]);
      const taskConfig = parse(taskConfigText) ?? {};
      if (String(taskConfig.variant ?? "").toLowerCase() !== "html") {
        continue;
      }
      const lastUpdated = readGitTimestamp(taskDir) ?? taskConfigStat.mtime.toISOString();
      const repoUrl = githubRepoUrl(entry.name);
      const shortDescription =
        String(taskConfig.short_description ?? "").trim() ||
        firstParagraphDescription(readmeText) ||
        `${String(taskConfig.title ?? entry.name).trim()} browser preview powered by psyflow-web.`;
      tasks.push({
        directory: entry.name,
        id: String(taskConfig.id ?? entry.name),
        slug: taskConfig.slug == null ? null : String(taskConfig.slug),
        title: String(taskConfig.title ?? entry.name),
        acquisition: taskConfig.acquisition == null ? null : String(taskConfig.acquisition),
        maturity: taskConfig.maturity == null ? null : String(taskConfig.maturity),
        release_tag:
          taskConfig.version?.release_tag == null ? null : String(taskConfig.version.release_tag),
        short_description: shortDescription,
        repo_url: repoUrl,
        default_branch: "main",
        download_url: `${repoUrl}/archive/refs/heads/main.zip`,
        run_url: inferRunUrl(entry.name),
        last_updated: lastUpdated,
        importPath: toImportPath(generatedDir, taskMainPath)
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  tasks.sort((left, right) => left.directory.localeCompare(right.directory));
  return tasks;
}

function renderManifest(tasks) {
  const lines = [
    "/* This file is auto-generated by scripts/generate-task-manifest.mjs. */",
    "",
    "export interface RunnerTaskManifestEntry {",
    "  directory: string;",
    "  id: string;",
    "  slug: string | null;",
    "  title: string;",
    "  acquisition: string | null;",
    "  maturity: string | null;",
    "  release_tag: string | null;",
    "  short_description: string;",
    "  repo_url: string;",
    "  default_branch: string;",
    "  download_url: string;",
    "  run_url: string;",
    "  last_updated: string;",
    "  importTask: () => Promise<unknown>;",
    "}",
    "",
    "export const taskManifest: Record<string, RunnerTaskManifestEntry> = {"
  ];

  for (const task of tasks) {
    lines.push(`  ${JSON.stringify(task.directory)}: {`);
    lines.push(`    directory: ${JSON.stringify(task.directory)},`);
    lines.push(`    id: ${JSON.stringify(task.id)},`);
    lines.push(`    slug: ${JSON.stringify(task.slug)},`);
    lines.push(`    title: ${JSON.stringify(task.title)},`);
    lines.push(`    acquisition: ${JSON.stringify(task.acquisition)},`);
    lines.push(`    maturity: ${JSON.stringify(task.maturity)},`);
    lines.push(`    release_tag: ${JSON.stringify(task.release_tag)},`);
    lines.push(`    short_description: ${JSON.stringify(task.short_description)},`);
    lines.push(`    repo_url: ${JSON.stringify(task.repo_url)},`);
    lines.push(`    default_branch: ${JSON.stringify(task.default_branch)},`);
    lines.push(`    download_url: ${JSON.stringify(task.download_url)},`);
    lines.push(`    run_url: ${JSON.stringify(task.run_url)},`);
    lines.push(`    last_updated: ${JSON.stringify(task.last_updated)},`);
    lines.push(`    importTask: () => import(${JSON.stringify(task.importPath)})`);
    lines.push("  },");
  }

  lines.push("};");
  lines.push("");
  lines.push("export const taskEntries = Object.values(taskManifest);");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function renderPublicManifest(tasks) {
  return JSON.stringify(
    {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      org: ORG,
      runner_repo: RUNNER_REPO,
      runner_url: RUNNER_URL,
      tasks: tasks.map((task) => ({
        directory: task.directory,
        id: task.id,
        slug: task.slug,
        title: task.title,
        acquisition: task.acquisition,
        maturity: task.maturity,
        release_tag: task.release_tag,
        short_description: task.short_description,
        repo_url: task.repo_url,
        default_branch: task.default_branch,
        download_url: task.download_url,
        run_url: task.run_url,
        last_updated: task.last_updated
      }))
    },
    null,
    2
  );
}

async function main() {
  if (!(await isDirectory(repoRoot))) {
    throw new Error(`Repo root not found: ${repoRoot}`);
  }
  const tasks = await discoverHtmlTasks();
  await mkdir(generatedDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });
  await writeFile(generatedFile, renderManifest(tasks), "utf8");
  await writeFile(publicManifestFile, `${renderPublicManifest(tasks)}\n`, "utf8");
  console.log(
    `[psyflow-web] generated task manifest with ${tasks.length} html task(s) at ${generatedFile} and ${publicManifestFile}`
  );
}

await main();
