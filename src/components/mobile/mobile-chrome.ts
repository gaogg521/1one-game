import { stripLocalePrefix } from "@/i18n/routing";

const HIDE_PREFIXES = ["/create", "/play/", "/console", "/admin", "/studio"];
const HIDE_EXACT = ["/arcade", "/novel/feed", "/comic/feed"];

function isWorkReaderPath(pathname: string, kind: "novel" | "comic"): boolean {
  const prefix = `/${kind}/`;
  if (!pathname.startsWith(prefix)) return false;
  const rest = pathname.slice(prefix.length);
  if (!rest || rest.includes("/")) return false;
  return rest !== "feed" && rest !== "create" && rest !== "discover";
}

/** 沉浸页（试玩、阅读、创作台、Feed）不展示手机底栏。 */
export function shouldHideMobileDock(pathname: string): boolean {
  const p = stripLocalePrefix(pathname).pathname;
  if (HIDE_EXACT.includes(p)) return true;
  if (HIDE_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix))) return true;
  return isWorkReaderPath(p, "novel") || isWorkReaderPath(p, "comic");
}
