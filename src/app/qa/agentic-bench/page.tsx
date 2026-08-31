import { Suspense } from "react";
import { headers } from "next/headers";
import AgenticBenchShell from "./AgenticBenchShell";

export default async function AgenticBenchPage() {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase() ?? "";
  // Production generation workers reach this harness over loopback. Keeping
  // it unavailable on the public hostname prevents the code-bearing QA payload
  // from becoming a public execution surface.
  const qaRoutesEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.QA_ROUTES_ENABLED === "1" ||
    host === "127.0.0.1" ||
    host === "localhost";
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
