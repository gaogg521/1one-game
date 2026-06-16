import nextConfig from "../next.config";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const cfg = typeof nextConfig === "function" ? nextConfig("phase-production-build", { defaultConfig: {} }) : nextConfig;
const excludes = "outputFileTracingExcludes" in cfg ? cfg.outputFileTracingExcludes : undefined;
const globalExcludes = excludes?.["/*"] ?? [];

for (const pattern of ["./public/**/*", "./qa-output/**/*", "./workspaces/**/*"]) {
  assert(globalExcludes.includes(pattern), `next output tracing should exclude ${pattern}`);
}

console.log("[OK] qa-next-trace-config");
