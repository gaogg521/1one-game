import path from "node:path";

const PUBLIC_DIR_NAME = ["pub", "lic"].join("");

export function repoPublicPath(...segments: string[]): string {
  return path.resolve(PUBLIC_DIR_NAME, ...segments);
}
