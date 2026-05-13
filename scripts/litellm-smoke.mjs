import "dotenv/config";

function cleanBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

const base = cleanBase(process.env.OPENAI_BASE_URL);
const key = String(process.env.OPENAI_API_KEY || "").trim();
if (!base || !key) {
  console.error("missing OPENAI_BASE_URL or OPENAI_API_KEY");
  process.exit(1);
}

const url = (base.endsWith("/v1") ? base : `${base}/v1`) + "/chat/completions";
const model = String(process.env.OPENAI_MODEL || "gpt-5.2").trim();

let extra = {};
try {
  extra = JSON.parse(String(process.env.OPENAI_EXTRA_HEADERS_JSON || "")) || {};
} catch {}

const extraHeaders = {};
for (const [k, v] of Object.entries(extra)) {
  if (k && (typeof v === "string" || typeof v === "number")) extraHeaders[k] = String(v);
}

async function run(body, label) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    ...extraHeaders,
  };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  console.log(`\n== ${label} ==`);
  console.log("POST", url);
  console.log("status", res.status, "ct", res.headers.get("content-type"));

  if (!json) {
    console.log(text.slice(0, 800));
    return;
  }

  console.log(
    JSON.stringify(
      {
        object: json.object,
        id: String(json.id || "").slice(0, 20),
        model: json.model,
        finish_reason: json.choices?.[0]?.finish_reason,
        usage: json.usage,
        contentPreview: (json.choices?.[0]?.message?.content || "").slice(0, 180),
      },
      null,
      2,
    ),
  );
}

const schema = {
  name: "t",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
  },
};

await run(
  {
    model,
    temperature: 0.2,
    messages: [{ role: "user", content: "你好，返回一句话介绍你是谁。" }],
  },
  "plain",
);

await run(
  {
    model,
    temperature: 0.2,
    messages: [{ role: "user", content: '只输出 JSON 对象，必须形如 {"ok": true}' }],
    response_format: { type: "json_schema", json_schema: schema },
  },
  "json_schema",
);

await run(
  {
    model,
    temperature: 0.2,
    messages: [{ role: "user", content: '只输出 JSON 对象，必须形如 {"ok": true}' }],
    response_format: { type: "json_object" },
  },
  "json_object",
);

