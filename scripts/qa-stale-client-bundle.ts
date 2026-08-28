/**
 * 过期客户端分块判定
 * npm run qa:stale-client-bundle
 */
import { isStaleClientBundleError } from "@/lib/stale-client-bundle";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  assert(isStaleClientBundleError(Object.assign(new Error("Failed to load chunk /_next/static/chunks/app.js"), { name: "ChunkLoadError" })), "ChunkLoadError");
  assert(isStaleClientBundleError(new Error("Loading chunk 647 failed.\n(error: https://operone.1oneclaw.com/_next/static/chunks/647.js)")), "Loading chunk");
  assert(isStaleClientBundleError(new Error("Failed to fetch dynamically imported module: https://x/_next/static/chunks/foo.js")), "dynamic import");
  assert(isStaleClientBundleError(new Error("Loading CSS chunk 12 failed")), "css chunk");
  assert(!isStaleClientBundleError(new Error("useTheme must be used within ThemeProvider")), "unrelated render error");
  assert(!isStaleClientBundleError(null), "null");
  console.log("qa-stale-client-bundle: ok");
}

main();
