import { z } from "zod";

const RefineBodySchema = z.object({
  instruction: z
    .string()
    .max(2000)
    .transform((s) => s.trim())
    .pipe(z.string().min(1)),
  mode: z.enum(["patch", "regenerate"]),
});

export type RefineBody = z.infer<typeof RefineBodySchema>;

export function parseRefineBody(raw: unknown): { ok: true; body: RefineBody } | { ok: false; errorKey: string } {
  const r = RefineBodySchema.safeParse(raw);
  if (!r.success) {
    return { ok: false, errorKey: "refineBodyInvalid" };
  }
  return { ok: true, body: r.data };
}
