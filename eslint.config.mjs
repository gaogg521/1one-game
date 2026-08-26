import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright fixtures use a callback named `use` — not React Hooks.
    "e2e/**",
    // Godot engine templates / local binaries (not part of the Next app surface).
    "godot-templates/**",
    "tools/godot/**",
    // Heavy / generated / local scratch — keep CI lint focused on app code.
    "node_modules/**",
    "public/godot-builds/**",
    "qa-output/**",
    "prisma/prisma/**",
    "temp-*/**",
    "temp-*.*",
  ]),
  {
    rules: {
      /**
       * React Compiler plugin rules (bundled via eslint-config-next) flag many
       * legitimate sync-from-props / prefetch patterns as errors. Keep them as
       * warnings so CI stays green while we migrate patterns gradually.
       */
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
]);

export default eslintConfig;
