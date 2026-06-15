/**
 * 宋辽中篇：分镜 → lib 配图 链式实机（~4min + ~8min）
 * npm run qa:songliao:medium-chain
 */
import { execSync } from "node:child_process";

function run(label: string, cmd: string) {
  console.log(`\n# ${label}\n`);
  execSync(cmd, { stdio: "inherit", cwd: process.cwd(), env: process.env });
}

try {
  run("1/2 分镜（8 页 · 跳过配图）", "npm run qa:songliao:storyboard");
  run("2/2 lib 配图", "npm run qa:songliao:panels-resume");
  console.log("\nqa:songliao:medium-chain: ok");
} catch (e) {
  console.error("\nqa:songliao:medium-chain: failed");
  process.exit(1);
}
