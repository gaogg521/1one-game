import { customAlphabet } from "nanoid";

/** URL 友好短码（小写字母 + 数字），碰撞概率极低，仍配合 DB unique 重试。 */
const mk = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 10);

export function newShareCode(): string {
  return mk();
}
