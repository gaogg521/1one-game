import { detectTemplateFromPrompt } from "@/lib/template-selector";

const prompt = "斗地主三人扑克，叫地主出牌比大小，支持春天反春，AI 互助配合";
const result = detectTemplateFromPrompt(prompt);

console.log("Prompt:", prompt);
console.log("Detected template:", result);
console.log("Expected: dou-dizhu");

// Verify normalization
const normalized = prompt.toLowerCase().replace(/\s+/g, "");
console.log("\nNormalized:", normalized);
console.log("Contains '斗地主':", normalized.includes("斗地主"));
console.log("Contains '出牌':", normalized.includes("出牌"));
