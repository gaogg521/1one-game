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

export function parseRefineBody(raw: unknown): { ok: true; body: RefineBody } | { ok: false; error: string } {
  const r = RefineBodySchema.safeParse(raw);
  if (!r.success) {
    return { ok: false, error: "请求体无效：需要 instruction（字符串）与 mode（patch | regenerate）" };
  }
  return { ok: true, body: r.data };
}
