/**
 * @deprecated 使用 qa:architecture-parity。保留为薄包装，避免单游戏 FEATURE_MATRIX 驱动。
 * npm run qa:competitor-clone-compare
 */
import { execSync } from "node:child_process";

console.log("[info] qa:competitor-clone-compare → qa:architecture-parity (平台架构对齐)\n");
execSync("npm run qa:architecture-parity", { stdio: "inherit", cwd: process.cwd() });
