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

For repository-hosted GitHub Pages, set the Vite base path before building:

```powershell
$env:PSYFLOW_BASE='/TaskBeacon/'
npm run build:pages
```

The included workflow at `.github/workflows/deploy-psyflow-web.yml` does this automatically on GitHub Actions.
