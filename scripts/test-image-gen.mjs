import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });
const { generateImageWithOpenAI } = await import("../src/lib/image-generation.ts");
const r = await generateImageWithOpenAI("煤山崇祯 明末 小说封面");
console.log("result:", r);
