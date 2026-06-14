import AdminConsolePage from "@/components/admin/AdminConsolePage";
import { getConsoleAccess } from "@/lib/auth/console-access";

export default async function ConsolePage() {
  const access = await getConsoleAccess();
  return (
    <AdminConsolePage
      consolePath={access.consolePath}
      showSsoLogout={access.canSsoLogout}
    />
  );
}
