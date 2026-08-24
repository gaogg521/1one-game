"""Provision short-lived Tencent COS credentials for Operone reference assets.

The long-lived allocator Token + SignKey stay on the operator workstation in
``cos.txt``. They are sent to the production host only through SSH stdin for
one allocation request, never written to the server or echoed. The server
persists only the returned short-lived SecretId/SecretKey in ``/opt/operone/.env``.

Before changing runtime configuration this script uploads one disposable probe,
checks that its unsigned HTTPS URL is readable, and deletes it. A private bucket
therefore fails safely rather than making the app claim a durable public asset.
"""
from __future__ import annotations

import argparse
import json
import shlex
import sys
from pathlib import Path

import prod_ssh

DEFAULT_BUCKET = "1onework-1251001122"
DEFAULT_PREFIX = "operone/references"
# Read-only endpoint probing identified this bucket's COS endpoint as Shanghai.
DEFAULT_REGION = "ap-shanghai"


def read_cos_value(raw: str, label: str) -> str:
    for line in raw.splitlines():
        if not line.lstrip().startswith(label):
            continue
        _, separator, value = line.replace("：", ":", 1).partition(":")
        if separator and value.strip():
            return value.strip()
    raise ValueError(f"cos.txt is missing {label}")


REMOTE_PROGRAM = r'''
const crypto = require("crypto");
const fs = require("fs/promises");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const readInput = async () => { let raw = ""; for await (const chunk of process.stdin) raw += chunk; return JSON.parse(raw); };
const secret = (data, names) => names.map((name) => data[name]).find((value) => typeof value === "string" && value.length > 0);
const sign = (payload, key, algorithm) => {
  if (algorithm === "md5") return crypto.createHash("md5").update(payload + key).digest("hex");
  const digest = algorithm === "hmac-sha1" ? "sha1" : "sha256";
  return crypto.createHmac(digest, key).update(payload).digest("hex");
};
const result = (payload) => process.stdout.write(`${JSON.stringify(payload)}\n`);
const safeError = (stage, error) => result({ ok: false, stage, error: error instanceof Error ? error.name : "failed" });
const upsert = (raw, values) => {
  const seen = new Set();
  const lines = raw.split(/\r?\n/).map((line) => {
    const index = line.indexOf("=");
    if (index < 1) return line;
    const key = line.slice(0, index).trim();
    if (!(key in values)) return line;
    seen.add(key);
    return `${key}=${values[key]}`;
  });
  for (const [key, value] of Object.entries(values)) if (!seen.has(key)) lines.push(`${key}=${value}`);
  return `${lines.filter((line, index, all) => line || index < all.length - 1).join("\n")}\n`;
};
(async () => {
  const input = await readInput();
  const now = Math.floor(Date.now() / 1000);
  const payload = `token=${input.alloc.token}&Timestamp=${now}`;
  let response;
  try {
    response = await fetch(input.alloc.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: input.alloc.token, Timestamp: now, sign: sign(payload, input.alloc.signKey, input.alloc.algorithm) }), signal: AbortSignal.timeout(20000) });
  } catch (error) { return safeError("credential_allocation_network", error); }
  let body;
  try { body = JSON.parse(await response.text()); } catch (error) { return safeError("credential_allocation_response", error); }
  const data = body.data || {};
  const accessKeyId = secret(data, ["ak", "AK", "secret_id", "secretId", "SecretId", "TmpSecretId"]);
  const secretAccessKey = secret(data, ["sk", "SK", "secret_key", "secretKey", "SecretKey", "TmpSecretKey"]);
  if (!response.ok || (body.code !== undefined && body.code !== 0) || !accessKeyId || !secretAccessKey) return result({ ok: false, stage: "credential_allocation_rejected", http: response.status, code: body.code ?? null });
  const expiry = data.expire_at ?? data.expireAt ?? data.expiredTime ?? data.ExpiredTime;
  const warnings = typeof expiry === "number" && expiry - now < 15 * 60 ? ["credential_expires_within_15_minutes"] : [];
  const endpoint = `https://cos.${input.storage.region}.myqcloud.com`;
  const publicBaseUrl = input.storage.publicBaseUrl.replace(/\/+$/, "");
  const probeKey = `${input.storage.prefix.replace(/^\/+|\/+$/g, "")}/.probes/${crypto.randomUUID()}.txt`;
  const probeBody = `operone-cos-probe-${crypto.randomUUID()}`;
  const client = new S3Client({ region: input.storage.region, endpoint, credentials: { accessKeyId, secretAccessKey } });
  let uploaded = false;
  try {
    await client.send(new PutObjectCommand({ Bucket: input.storage.bucket, Key: probeKey, Body: probeBody, ContentType: "text/plain", CacheControl: "no-store" }));
    uploaded = true;
    const publicResponse = await fetch(`${publicBaseUrl}/${probeKey.split("/").map(encodeURIComponent).join("/")}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!publicResponse.ok || await publicResponse.text() !== probeBody) return result({ ok: false, stage: "public_object_read", http: publicResponse.status });
  } catch (error) { return safeError("cos_probe", error); }
  finally { if (uploaded) { try { await client.send(new DeleteObjectCommand({ Bucket: input.storage.bucket, Key: probeKey })); } catch (error) { return safeError("cos_probe_cleanup", error); } } }
  const envValues = {
    REFERENCE_ASSET_STORAGE: "cos",
    COS_REFERENCE_BUCKET: input.storage.bucket,
    COS_REFERENCE_REGION: input.storage.region,
    COS_REFERENCE_PREFIX: input.storage.prefix,
    COS_REFERENCE_ENDPOINT: endpoint,
    COS_REFERENCE_PUBLIC_BASE_URL: publicBaseUrl,
    COS_REFERENCE_SECRET_ID: accessKeyId,
    COS_REFERENCE_SECRET_KEY: secretAccessKey,
  };
  try {
    const previous = await fs.readFile(input.envFile, "utf8");
    const stat = await fs.stat(input.envFile);
    const temporary = `${input.envFile}.cos-next`;
    await fs.writeFile(temporary, upsert(previous, envValues), { mode: stat.mode });
    await fs.rename(temporary, input.envFile);
  } catch (error) { return safeError("runtime_env_write", error); }
  result({ ok: true, region: input.storage.region, bucket: input.storage.bucket, prefix: input.storage.prefix, expiresAt: typeof expiry === "number" ? new Date(expiry * 1000).toISOString() : null, warnings });
})().catch((error) => safeError("unexpected", error));
'''


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cos-file", type=Path, default=Path("cos.txt"))
    parser.add_argument("--bucket", default=DEFAULT_BUCKET)
    parser.add_argument("--region", default=DEFAULT_REGION)
    parser.add_argument("--prefix", default=DEFAULT_PREFIX)
    parser.add_argument("--public-base-url", default="")
    parser.add_argument("--sign-algo", choices=("hmac-sha256", "hmac-sha1", "md5"), default="hmac-sha256")
    parser.add_argument("--no-restart", action="store_true", help="write .env and skip the systemd restart")
    args = parser.parse_args()
    try:
        raw = args.cos_file.read_text(encoding="utf-8")
        allocation = {
            "url": read_cos_value(raw, "BASEURL"),
            "token": read_cos_value(raw, "Token"),
            "signKey": read_cos_value(raw, "SignKey"),
            "algorithm": args.sign_algo,
        }
    except (OSError, ValueError) as error:
        print(f"configure-cos-reference-storage: {error}", file=sys.stderr)
        return 2

    public_base_url = args.public_base_url.strip() or f"https://{args.bucket}.cos.{args.region}.myqcloud.com"
    request = json.dumps(
        {
            "alloc": allocation,
            "storage": {"bucket": args.bucket, "region": args.region, "prefix": args.prefix, "publicBaseUrl": public_base_url},
            "envFile": f"{prod_ssh.deploy_repo()}/.env",
        }
    )
    client = prod_ssh.connect(timeout=30)
    try:
        command = f"cd {shlex.quote(prod_ssh.deploy_repo())} && node -e {shlex.quote(REMOTE_PROGRAM)}"
        stdin, stdout, stderr = client.exec_command(command, timeout=120)
        stdin.write(request)
        stdin.channel.shutdown_write()
        output = stdout.read().decode("utf-8", "replace").strip()
        stderr.read()  # allocator details can include provider internals; never relay them.
        status = stdout.channel.recv_exit_status()
    finally:
        client.close()
    try:
        outcome = json.loads(output)
    except json.JSONDecodeError:
        print("configure-cos-reference-storage: remote operation returned invalid output", file=sys.stderr)
        return 1
    if status != 0 or not outcome.get("ok"):
        print(f"configure-cos-reference-storage: failed at {outcome.get('stage', 'remote_operation')}", file=sys.stderr)
        return 1
    if not args.no_restart:
        client = prod_ssh.connect(timeout=30)
        try:
            code, _ = prod_ssh.run_output(client, "systemctl restart operone && systemctl is-active operone", timeout=90)
        finally:
            client.close()
        if code != 0:
            print("configure-cos-reference-storage: credentials written but operone restart failed", file=sys.stderr)
            return 1
    for warning in outcome.get("warnings", []):
        print(f"configure-cos-reference-storage: warning — {warning}", file=sys.stderr)
    print(
        f"COS reference storage configured: bucket={outcome['bucket']} prefix={outcome['prefix']} region={outcome['region']} expiresAt={outcome['expiresAt']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
