import type { Metadata } from "next";
import { ConsoleLoginGate } from "@/components/admin/ConsoleLoginGate";
import { ConsoleTwoFactorGate } from "@/components/admin/ConsoleTwoFactorGate";
import { getConsoleAccess } from "@/lib/auth/console-access";

export const metadata: Metadata = {
  title: "Operations Console",
  robots: { index: false, follow: false },
};

export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const access = await getConsoleAccess();
  if (access.require2fa) {
    return <ConsoleTwoFactorGate consolePath={access.consolePath} />;
  }
  if (!access.canViewConsole) {
    return <ConsoleLoginGate consolePath={access.consolePath} />;
  }
  return children;
}
