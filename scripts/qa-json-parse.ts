/**
 * Locks the JSON-reply parser against the wrappers models actually emit.
 *
 * The bug this guards: minimax-2-7 and glm-latest wrap their object in a
 * ```json fence even in json_schema mode. A bare JSON.parse threw, the result
 * was reported as "empty json output", and the game / novel / comic pipelines
 * all treated a correct answer as a dead model — burning every retry.
 */
import assert from "node:assert/strict";
import { parseJsonContent } from "../src/lib/llm/provider-openai-compatible";

const expected = { title: "Panda", items: ["a", "b"] };

/* --------------------------------------------------------- bare object -- */
assert.deepEqual(parseJsonContent('{"title":"Panda","items":["a","b"]}'), expected);
assert.deepEqual(parseJsonContent('  \n {"title":"Panda","items":["a","b"]}  \n '), expected);

/* ----------------------------------------------- markdown-fenced object -- */
assert.deepEqual(parseJsonContent('```json\n{"title":"Panda","items":["a","b"]}\n```'), expected, "```json fence must parse");
assert.deepEqual(parseJsonContent('```JSON\n{"title":"Panda","items":["a","b"]}\n```'), expected, "uppercase fence tag must parse");
assert.deepEqual(parseJsonContent('```\n{"title":"Panda","items":["a","b"]}\n```'), expected, "untagged fence must parse");
assert.deepEqual(
  parseJsonContent('Here is the JSON:\n```json\n{"title":"Panda","items":["a","b"]}\n```\nHope that helps!'),
  expected,
  "fence surrounded by prose must parse",
);

/* ------------------------------------------------ prose-wrapped, no fence -- */
assert.deepEqual(
  parseJsonContent('Sure! {"title":"Panda","items":["a","b"]} — let me know if you need changes.'),
  expected,
  "an object embedded in prose must parse",
);

/* ------------------------------------------------------------- arrays -- */
assert.deepEqual(parseJsonContent('```json\n[1,2,3]\n```'), [1, 2, 3], "a fenced array must parse");
assert.deepEqual(parseJsonContent("[1,2,3]"), [1, 2, 3]);

/* -------------------------------------------------- genuinely unparseable -- */
assert.equal(parseJsonContent(""), null);
assert.equal(parseJsonContent("   "), null);
assert.equal(parseJsonContent(null), null);
assert.equal(parseJsonContent(undefined), null);
assert.equal(parseJsonContent("I cannot help with that request."), null, "prose with no JSON must stay null");
assert.equal(parseJsonContent('```json\n{"title": broken,\n```'), null, "malformed JSON inside a fence must stay null");

/* ------------------------------------- truncated completions must NOT pass -- */
// A budget-truncated reply ends mid-object. Slicing to the last `}` would
// yield a nested fragment that parses fine and looks like a valid answer with
// most top-level fields missing — the caller must see a failure instead.
assert.equal(
  parseJsonContent('{"title":"Panda","stage":{"width":960,"height":540}'),
  null,
  "a truncated object must not be salvaged into its nested fragment",
);
assert.equal(
  parseJsonContent('```json\n{"title":"Panda","controls":[{"action":"jump"}'),
  null,
  "a truncated fenced object must not be salvaged",
);
assert.equal(
  parseJsonContent('{"a":{"b":1},"c":'),
  null,
  "trailing incomplete field must not be salvaged",
);

/* ---------------------------------------------- nested braces in strings -- */
assert.deepEqual(
  parseJsonContent('```json\n{"title":"a {nested} brace","items":["}"]}\n```'),
  { title: "a {nested} brace", items: ["}"] },
  "braces inside string values must not break extraction",
);

console.log("[OK] qa-json-parse: fenced, prose-wrapped and bare JSON replies all parse; junk still rejected");
