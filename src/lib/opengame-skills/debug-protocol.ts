import type { DebugProtocol } from "@/lib/opengame-skills/types";

/**
 * The legacy OpenGame debug signatures are intentionally retired with the
 * template runtime.  Retain an explicitly empty, typed protocol so consumers
 * can safely run their normal fail-closed pipeline without an incompatible
 * array-shaped placeholder.
 */
export const OPERONE_DEBUG_PROTOCOL: DebugProtocol = {
  version: 1,
  name: "independent-runtime",
  description: "No legacy OpenGame debug signatures are applicable.",
  attribution: "Operone",
  entries: [],
};
