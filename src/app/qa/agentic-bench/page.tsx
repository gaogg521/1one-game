import { Suspense } from "react";
import AgenticBenchShell from "./AgenticBenchShell";

const qaRoutesEnabled =
  process.env.NODE_ENV !== "production" || process.env.QA_ROUTES_ENABLED === "1";

export default function AgenticBenchPage() {
  if (!qaRoutesEnabled) {
    return (
      <main style={{ padding: 24, color: "#94a3b8", fontFamily: "system-ui" }}>
        <p>QA routes disabled in production. Start with QA_ROUTES_ENABLED=1 to run browser bench.</p>
      </main>
    );
  }

  return (
    <Suspense fallback={null}>
      <AgenticBenchShell />
    </Suspense>
  );
}
