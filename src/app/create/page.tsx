import CreateClient from "./CreateClient";

export default async function CreatePage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await props.searchParams) ?? {};
  const prefillRaw = sp.prefill;
  const prefill = typeof prefillRaw === "string" ? prefillRaw : Array.isArray(prefillRaw) ? prefillRaw[0] : "";
  return <CreateClient initialPrompt={(prefill ?? "").slice(0, 4000)} />;
}

