import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);

// Version shown in the UI top bar. Source of truth is the latest git tag
// (e.g. `v1.0.1`); on release just `git tag vX.Y.Z && git push --tags`.
// Falls back to package.json version when git/tags are unavailable.
function resolveAppVersion(): string {
  const envVersion = process.env.APP_VERSION;
  if (envVersion) return normalize(envVersion);

  try {
    const described = execSync("git describe --tags --abbrev=0", {
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString()
      .trim();
    if (described) return normalize(described);
  } catch {
    // no tags yet — fall through to package.json
  }

  try {
    const pkg = require("./package.json") as { version?: string };
    if (pkg.version) return normalize(pkg.version);
  } catch {
    // ignore
  }
  return "dev";
}

function normalize(value: string): string {
  return value.startsWith("v") ? value : `v${value}`;
}

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: process.env.VITE_BASE_PATH || "/",
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion())
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000"
    }
  }
});
