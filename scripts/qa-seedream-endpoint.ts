/**
 * The Seedream image endpoint must be derived from the gateway, not assumed.
 *
 * Written after the same mistake shipped twice in one day: a detail that was
 * true of the local litellm proxy baked in as if it were universal. Here it
 * was the absolute path `/api/seedream/v1/images/generations`, which `new URL`
 * resolves against the ORIGIN, discarding any versioned API root the gateway
 * already has. Production's base URL is `https://ark.cn-beijing.volces.com/api/v3`,
 * so every image request went to a path that does not exist and 404'd in under
 * four seconds -- invisibly, because the asset agent logs nothing and the
 * failure lands in the database as a generic "image_generation_failed".
 *
 *   npx tsx scripts/qa-seedream-endpoint.ts
 */
import assert from "node:assert/strict";
import { seedreamGenerationEndpoint } from "../src/lib/image-generation";

/* --------------------------------------- gateways with a versioned root -- */
// Production: Volcengine ARK. The images path hangs off /api/v3, and the
// verified-working URL is exactly this one (confirmed live: HTTP 200 with a
// real image in 42s).
assert.equal(
  seedreamGenerationEndpoint("https://ark.cn-beijing.volces.com/api/v3"),
  "https://ark.cn-beijing.volces.com/api/v3/images/generations",
);
// A trailing slash must not change the answer.
assert.equal(
  seedreamGenerationEndpoint("https://ark.cn-beijing.volces.com/api/v3/"),
  "https://ark.cn-beijing.volces.com/api/v3/images/generations",
);
// A plain OpenAI-compatible /v1 root behaves the same way.
assert.equal(
  seedreamGenerationEndpoint("https://example-gateway.test/v1"),
  "https://example-gateway.test/v1/images/generations",
);

/* ------------------------------------------------- bare-origin gateways -- */
// The local litellm proxy exposes Seedream under its own dedicated absolute
// path; this is the shape the old hardcoded value was written for, and it must
// keep working.
assert.equal(
  seedreamGenerationEndpoint("https://litellm-internal.123u.com"),
  "https://litellm-internal.123u.com/api/seedream/v1/images/generations",
);
assert.equal(
  seedreamGenerationEndpoint("https://litellm-internal.123u.com/"),
  "https://litellm-internal.123u.com/api/seedream/v1/images/generations",
);

/* ------------------------------------------------------- the regression -- */
// The specific bug: a versioned root must never be replaced by the joy path.
const prod = seedreamGenerationEndpoint("https://ark.cn-beijing.volces.com/api/v3");
assert.ok(
  !prod.includes("/api/seedream/"),
  "a gateway with a versioned API root must not be sent to the litellm-specific Seedream path",
);
assert.ok(prod.includes("/api/v3/"), "the gateway's own API root must be preserved");

console.log("[OK] qa-seedream-endpoint: the images path is derived from the gateway for both versioned-root and bare-origin shapes");
