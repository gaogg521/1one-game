import CreateClient from "./CreateClient";

/** 服务端传入；避免把任意超长字符串当 id 塞进 fetch */
function pickReplayProjectId(raw: unknown): string | undefined {
  const s = typeof raw === "string" ? raw.trim() : Array.isArray(raw) ? String(raw[0] ?? "").trim() : "";
  if (s.length < 14 || s.length > 36) return undefined;
  if (!/^[\w-]+$/i.test(s)) return undefined;
  return s;
}

export default async function CreatePage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await props.searchParams) ?? {};
  const prefillRaw = sp.prefill;
  const prefill = typeof prefillRaw === "string" ? prefillRaw : Array.isArray(prefillRaw) ? prefillRaw[0] : "";
  const replayFromProjectId = pickReplayProjectId(sp.from);
  return (
    <CreateClient
      key={replayFromProjectId ? `replay:${replayFromProjectId}` : "create-fresh"}
      initialPrompt={(prefill ?? "").slice(0, 4000)}
      replayFromProjectId={replayFromProjectId}
    />
  );
}

