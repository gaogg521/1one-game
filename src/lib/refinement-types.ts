export type RefineMode = "patch" | "regenerate";

export type RefinementLogEntry = {
  /** ISO8601 */
  at: string;
  mode: RefineMode;
  instruction: string;
};
