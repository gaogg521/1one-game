/**
 * Phase C：样品馆 Template Skill 对照 QA
 * npm run qa:sample-template-skill-parity
 */
import { SAMPLES } from "@/lib/samples";
import { checkSampleTemplateSkillParity, buildSampleTemplateSkillParityRow } from "@/lib/opengame-skills/template-sample-parity";

function main() {
  const failures: string[] = [];

  for (const sample of SAMPLES) {
    const row = buildSampleTemplateSkillParityRow(sample);
    const issues = checkSampleTemplateSkillParity(sample);
    if (issues.length) {
      for (const i of issues) failures.push(i);
    } else {
      console.log(`[OK] ${sample.id} → ${row.phaserScene} · archetype=${row.archetypeId}`);
    }
  }

  if (failures.length) {
    console.error(`[FAIL] qa-sample-template-skill-parity (${failures.length})`);
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }

  console.log(`[OK] qa-sample-template-skill-parity: ${SAMPLES.length}/${SAMPLES.length} samples`);
}

main();
