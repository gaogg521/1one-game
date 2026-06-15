/**
 * 确保存在至少一名 super_admin（部署/bootstrap 用，直接写库）
 *
 * 环境变量：
 *   SUPER_ADMIN_BOOTSTRAP_USERNAME  默认 admin
 *   SUPER_ADMIN_BOOTSTRAP_EMAIL     可选
 *   SUPER_ADMIN_BOOTSTRAP_PASSWORD  未设则随机生成并打印
 *   SUPER_ADMIN_BOOTSTRAP_FORCE=1     已有 super_admin 时也重置/创建指定账号
 *
 * npm run ensure:super-admin
 */
import { randomBytes } from "node:crypto";
import { hashPassword, isValidEmail, normalizeEmail } from "@/lib/auth/password";
import { normalizeUsername, validateUsername } from "@/lib/auth/username";
import { prisma } from "@/lib/prisma";

async function main() {
  const usernameRaw = process.env.SUPER_ADMIN_BOOTSTRAP_USERNAME?.trim() || "admin";
  const emailRaw = process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL?.trim() || "";
  const force = process.env.SUPER_ADMIN_BOOTSTRAP_FORCE === "1";
  let password = process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD?.trim() || "";

  const username = normalizeUsername(usernameRaw);
  const usernameErr = validateUsername(username);
  if (usernameErr === "invalid") {
    console.error(`Invalid SUPER_ADMIN_BOOTSTRAP_USERNAME: ${usernameRaw}`);
    process.exit(1);
  }
  if (usernameErr === "reserved") {
    console.warn(`[warn] bootstrap username "${username}" is normally reserved`);
  }

  const email = emailRaw ? normalizeEmail(emailRaw) : "";
  if (email && !isValidEmail(email)) {
    console.error(`Invalid SUPER_ADMIN_BOOTSTRAP_EMAIL: ${emailRaw}`);
    process.exit(1);
  }

  const existingSuper = await prisma.user.findFirst({
    where: { role: "super_admin" },
    select: { id: true, username: true, email: true },
  });

  if (existingSuper && !force) {
    console.log(
      `[skip] super_admin already exists: ${existingSuper.username ?? existingSuper.email ?? existingSuper.id}`,
    );
    console.log("  Set SUPER_ADMIN_BOOTSTRAP_FORCE=1 to create/update bootstrap account anyway.");
    return;
  }

  if (!password) {
    password = randomBytes(12).toString("base64url");
    console.log("[info] SUPER_ADMIN_BOOTSTRAP_PASSWORD not set — generated one-time password below.");
  }

  const passwordHash = hashPassword(password);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username }, ...(email ? [{ email }] : [])],
    },
    select: { id: true, username: true, email: true, role: true },
  });

  let userId: string;
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "super_admin",
        passwordHash,
        username: existing.username ?? username,
        email: existing.email ?? email || null,
        displayName: existing.username ?? usernameRaw,
      },
    });
    userId = existing.id;
    console.log(`[update] promoted existing user ${userId} → super_admin`);
  } else {
    const user = await prisma.user.create({
      data: {
        username,
        email: email || null,
        displayName: usernameRaw,
        passwordHash,
        role: "super_admin",
      },
    });
    userId = user.id;
    console.log(`[create] new super_admin ${userId}`);
  }

  console.log("");
  console.log("══════════════════════════════════════");
  console.log("  super_admin 已就绪");
  console.log(`  用户名:  ${username}`);
  if (email) console.log(`  邮箱:    ${email}`);
  console.log(`  密码:    ${password}`);
  console.log("  登录:    /login  →  /console");
  console.log("══════════════════════════════════════");
  console.log("");
  console.log("请立即登录并修改密码；勿将密码提交到 Git。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
