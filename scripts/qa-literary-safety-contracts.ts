import { publicReadyWorkWhere, canReadWorkPublicly, shouldChargeNovelStreamQuota } from "../src/lib/literary-safety";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const publicWhere = publicReadyWorkWhere();
assert(publicWhere.visibility === "public", "public work list should keep visibility=public");
assert(publicWhere.status === "ready", "public work list should exclude draft_generating rows");

assert(canReadWorkPublicly({ visibility: "public", status: "ready" }), "ready public work should be publicly readable");
assert(
  !canReadWorkPublicly({ visibility: "public", status: "draft_generating" }),
  "draft_generating work should never be publicly readable",
);
assert(!canReadWorkPublicly({ visibility: "hidden", status: "ready" }), "hidden work should not be publicly readable");

assert(shouldChargeNovelStreamQuota(undefined), "new novel stream should charge quota");
assert(!shouldChargeNovelStreamQuota("draft-novel-id"), "resuming an existing draft should not charge first-run quota again");

console.log("[OK] qa-literary-safety-contracts");
