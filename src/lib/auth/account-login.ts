import { loginWithEmail } from "@/lib/auth/email-register";
import { loginWithUsername } from "@/lib/auth/username-auth";

/** 用户名或邮箱 + 密码登录 */
export async function loginWithAccount(
  accountRaw: string,
  password: string,
): Promise<
  | { ok: true; userId: string; sessionToken: string }
  | { ok: false; error: "invalidCredentials" }
> {
  const account = accountRaw.trim();
  if (!account) return { ok: false, error: "invalidCredentials" };
  if (account.includes("@")) {
    return loginWithEmail(account, password);
  }
  return loginWithUsername(account, password);
}
