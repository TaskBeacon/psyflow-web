# psyflow-web

Shared browser runner and runtime for TAPS-style HTML tasks.

## Local Development

```powershell
cd e:\xhmhc\TaskBeacon\psyflow-web
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:4173/?task=H000006-mid
```

## Static Site Build

This builds a deployable static site with the discovered HTML tasks bundled into the runner:

```powershell
cd e:\xhmhc\TaskBeacon\psyflow-web
npm run build:site
```

Output:

```text
psyflow-web/dist
```

## GitHub Pages

For repository-hosted GitHub Pages, build the shared runner in Pages mode:

```powershell
npm run build:pages
```

Published runner URL:

```text
https://taskbeacon.github.io/psyflow-web/?task=H000006-mid
```

Public companion manifest:

```text
https://taskbeacon.github.io/psyflow-web/task-manifest.json
```

The included workflow at `.github/workflows/pages.yml` fetches public `Hxxxxxx-*` task repos from the `TaskBeacon` org, regenerates both the runtime import manifest and the public companion manifest, and deploys the shared runner to GitHub Pages.
