# Changelog

## 2026-03-11

- Added a public `task-manifest.json` build artifact so `psyflow-web` becomes the single published source of truth for HTML task companions.
- Expanded `scripts/generate-task-manifest.mjs` to emit both the internal TypeScript import manifest and the public runtime manifest with `run_url`, repo metadata, release tag, maturity, and last-updated fields.
- Updated the Pages workflow to support scheduled refreshes and `repository_dispatch` events, so the shared runner can refresh companion metadata without requiring a rebuild of `taskbeacon.github.io`.
- Kept the shared runner behavior unchanged for end users: task loading still uses the generated TypeScript manifest, while external consumers now read the public JSON manifest.
