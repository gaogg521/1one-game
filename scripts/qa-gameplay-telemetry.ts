import { GameplayEventPayloadSchema } from "../src/lib/gameplay-telemetry";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const valid = GameplayEventPayloadSchema.safeParse({
  projectId: "project-demo",
  creativeRevisionId: "revision-demo",
  templateId: "puzzle",
  event: "first_minute",
  sessionId: "0f803eaa-3cc8-4a79-9d5e-412f48e08ca1",
  elapsedMs: 60_000,
  activeMs: 60_000,
  actionCount: 4,
  deviceClass: "mobile",
  orientation: "portrait",
  touchCapable: true,
  verticalSliceScore: 88,
});
assert(valid.success, "valid anonymous first-minute event should parse");

const orphanRevision = GameplayEventPayloadSchema.safeParse({
  creativeRevisionId: "revision-demo",
  templateId: "puzzle",
  event: "start",
  sessionId: "0f803eaa-3cc8-4a79-9d5e-412f48e08ca1",
});
assert(!orphanRevision.success, "revision evidence must always identify its project");

const promptLeak = GameplayEventPayloadSchema.safeParse({
  templateId: "puzzle",
  event: "start",
  sessionId: "0f803eaa-3cc8-4a79-9d5e-412f48e08ca1",
  prompt: "this field must not be persisted",
});
assert(promptLeak.success && !("prompt" in promptLeak.data), "unknown fields must be stripped from telemetry payload");

const invalid = GameplayEventPayloadSchema.safeParse({
  templateId: "puzzle",
  event: "keystroke",
  sessionId: "short",
});
assert(!invalid.success, "raw input-like event names and invalid sessions must be rejected");

console.log("[OK] qa-gameplay-telemetry");
