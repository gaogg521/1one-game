"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { decodeAgenticBenchPayload } from "@/lib/opengame-skills/browser-bench";

const AgenticBenchClient = dynamic(() => import("./AgenticBenchClient"), { ssr: false });

const shellStyle = { minHeight: "100vh", padding: 16, background: "#0b1220" } as const;
const msgStyle = { padding: 24, color: "#94a3b8", fontFamily: "system-ui" } as const;

export default function AgenticBenchShell() {
  const params = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const decoded = useMemo(() => {
    if (!mounted) return null;
    const payload = params.get("payload") ?? "";
    return payload ? decodeAgenticBenchPayload(payload) : null;
  }, [mounted, params]);

  if (!mounted) {
    return (
      <main style={shellStyle}>
        <p style={msgStyle}>Agentic bench loading…</p>
      </main>
    );
  }

  if (!decoded?.spec?.agenticModule?.source) {
    return (
      <main style={msgStyle} data-testid="agentic-bench-error">
        <p>Operone Agentic Bench — missing or invalid ?payload=</p>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <AgenticBenchClient spec={decoded.spec} />
    </main>
  );
}
