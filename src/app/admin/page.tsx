import { redirect } from "next/navigation";
import { getAdminConsolePath } from "@/lib/admin-console-path";

/** 旧 /admin 永久重定向至独立运营控制台 */
export default function LegacyAdminRedirect() {
  redirect(getAdminConsolePath());
}
