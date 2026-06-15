/**
 * 将指定用户升为 super_admin（直接写库，无需已有超管）
 *
 * npm run promote:super-admin -- --email user@example.com
 * npm run promote:super-admin -- --username myuser
 * npm run promote:super-admin -- --id clxxxxxxxx
 */
import { normalizeUsername } from "@/lib/auth/username";
import { normalizeEmail } from "@/lib/auth/password";
import { prisma } from "../src/lib/prisma";

function usage(): never {
  console.error("Usage:");
  console.error("  npm run promote:super-admin -- --email user@example.com");
  console.error("  npm run promote:super-admin -- --username myuser");
  console.error("  npm run promote:super-admin -- --id <userId>");
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let username: string | undefined;
  let id: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    else if (args[i] === "--username" && args[i + 1]) username = args[++i];
    else if (args[i] === "--id" && args[i + 1]) id = args[++i];
    else if (args[i] === "--help" || args[i] === "-h") usage();
  }

  if (!email && !username && !id) usage();

  const user = await prisma.user.findFirst({
    where: email ? { email: normalizeEmail(email) } : username ? { username: normalizeUsername(username) } : { id },
    select: { id: true, username: true, email: true, displayName: true, role: true },
  });

  if (!user) {
    console.error(
      `User not found (${email ? `email=${email}` : username ? `username=${username}` : `id=${id}`})`,
    );
    process.exit(1);
  }

  if (user.role === "super_admin") {
    console.log(`Already super_admin: ${user.username ?? user.email ?? user.id} (${user.displayName ?? "—"})`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "super_admin" } });
  const label = user.username ?? user.email ?? user.id;
  console.log(`✓ Promoted to super_admin: ${label} (${user.displayName ?? "—"})`);
  console.log("  Sign in and open /console to manage runtime keys.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
