import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(packageRoot, "..");

const ORG = process.env.TASKBEACON_ORG || "TaskBeacon";
const TOKEN =
  process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_PAT || "";
const GH_API = "https://api.github.com";

function headers() {
  const result = {
    "User-Agent": "psyflow-web-pages-builder",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (TOKEN) {
    result.Authorization = `Bearer ${TOKEN}`;
  }
  return result;
}

async function listHtmlRepos() {
  let page = 1;
  const repos = [];

  while (true) {
    const url = `${GH_API}/orgs/${encodeURIComponent(ORG)}/repos?type=public&per_page=100&page=${page}`;
    const response = await fetch(url, { headers: headers() });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Unable to list repos: ${response.status} ${response.statusText}\n${text}`);
    }
    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }
    repos.push(...batch);
    if (batch.length < 100) {
      break;
    }
    page += 1;
  }

  return repos
    .map((repo) => String(repo?.name ?? ""))
    .filter((name) => /^H\d{6}[-_]/.test(name))
    .sort();
}

function cloneRepo(repo) {
  const targetDir = path.join(workspaceRoot, repo);
  if (existsSync(targetDir)) {
    console.log(`[psyflow-web] task repo already present: ${targetDir}`);
    return;
  }

  const remoteUrl = `https://github.com/${ORG}/${repo}.git`;
  console.log(`[psyflow-web] cloning ${remoteUrl} -> ${targetDir}`);
  const result = spawnSync("git", ["clone", "--depth", "1", remoteUrl, targetDir], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`Failed to clone ${repo}`);
  }
}

async function main() {
  if (!TOKEN) {
    console.log("[psyflow-web] No GitHub token found; skipping task repo fetch.");
    return;
  }

  const repos = await listHtmlRepos();
  if (repos.length === 0) {
    console.log("[psyflow-web] No public HTML task repos found.");
    return;
  }

  for (const repo of repos) {
    cloneRepo(repo);
  }
}

await main();
