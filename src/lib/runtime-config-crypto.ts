import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = "platform-runtime-config-v1";

function getEncryptionKey(): Buffer {
  const secret =
    process.env.RUNTIME_CONFIG_SECRET?.trim() ||
    process.env.SUPER_ADMIN_SECRET?.trim() ||
    "dev-runtime-config-insecure";
  return scryptSync(secret, SALT, 32);
}

export function encryptRuntimeSecrets(json: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptRuntimeSecrets(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
