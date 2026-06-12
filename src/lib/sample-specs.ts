import { mockSpecFromPrompt } from "@/lib/mock-spec";
import type { Sample } from "@/lib/samples";

/** 样品馆：sampleId override（infer.ts）+ registry 推断 + mock 数值 */
export function specForSample(sample: Sample) {
  const spec = mockSpecFromPrompt(sample.prompt, {
    sampleId: sample.id,
    title: sample.title,
    subtitle: sample.subtitle,
  });
  return spec;
}
