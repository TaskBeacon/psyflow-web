import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = path.resolve(rootDir, "..");

export default defineConfig(({ mode }) => {
  const buildTarget = mode === "lib" ? "lib" : "site";
  return {
    base: process.env.PSYFLOW_BASE ?? "/",
    resolve: {
      alias: {
        "psyflow-web": path.resolve(rootDir, "src/index.ts")
      }
    },
    build:
      buildTarget === "lib"
        ? {
            lib: {
              entry: "src/index.ts",
              name: "PsyflowWeb",
              fileName: "index",
              formats: ["es"]
            },
            sourcemap: true,
            target: "es2022"
          }
        : {
            sourcemap: true,
            target: "es2022"
          },
    server: {
      host: "127.0.0.1",
      port: 4173,
      fs: {
        allow: [repoRoot]
      }
    },
    preview: {
      host: "127.0.0.1",
      port: 4173
    }
  };
});
