export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadRuntimeConfig } = await import("@/lib/runtime-config");
    const { loadEmailConfig } = await import("@/lib/email-config");
    await Promise.all([loadRuntimeConfig(), loadEmailConfig()]);
  }
}
