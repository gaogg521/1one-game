export type ConsoleTab =
  | "account"
  | "wallet"
  | "profile"
  | "overview"
  | "pending"
  | "works"
  | "samples"
  | "shares"
  | "users"
  | "billing"
  | "audit"
  | "gen-errors"
  | "runtime"
  | "email"
  | "cache-management";

export type ConsoleNavItem = {
  id: ConsoleTab;
  labelKey: string;
  capability?: AdminCapability;
  /** API routes that intentionally require an administrator rather than a scoped operator. */
  roles?: readonly UserRole[];
  /** Secrets and provider credentials are never available outside super-admin. */
  requiresSuperAdmin?: boolean;
};

export type ConsoleNavSection = {
  id: string;
  labelKey: string;
  items: ConsoleNavItem[];
  superAdminOnly?: boolean;
};

/** 所有已登录用户可见 */
export const CONSOLE_USER_SECTIONS: ConsoleNavSection[] = [
  {
    id: "general",
    labelKey: "navSectionGeneral",
    items: [
      { id: "account", labelKey: "tabAccount" },
      { id: "wallet", labelKey: "tabWallet" },
    ],
  },
  {
    id: "personal",
    labelKey: "navSectionPersonal",
    items: [{ id: "profile", labelKey: "tabProfile" }],
  },
];

/**
 * 按运营工作流分组；每一项按能力最小化展示，API 层仍执行最终鉴权。
 */
export const CONSOLE_ADMIN_SECTIONS: ConsoleNavSection[] = [
  {
    id: "admin-operations",
    labelKey: "navSectionAdminOperations",
    superAdminOnly: true,
    items: [{ id: "overview", labelKey: "tabOverview", roles: ["admin", "super_admin"] }],
  },
  {
    id: "admin-content",
    labelKey: "navSectionAdminContent",
    superAdminOnly: true,
    items: [
      { id: "pending", labelKey: "tabPending", capability: "content" },
      { id: "works", labelKey: "tabWorks", capability: "content" },
      { id: "samples", labelKey: "tabSamples", capability: "content" },
    ],
  },
  {
    id: "admin-growth",
    labelKey: "navSectionAdminGrowth",
    superAdminOnly: true,
    items: [
      { id: "shares", labelKey: "tabShares", capability: "growth" },
      { id: "users", labelKey: "tabUsers", capability: "user_admin" },
    ],
  },
  {
    id: "admin-business",
    labelKey: "navSectionAdminBusiness",
    superAdminOnly: true,
    items: [
      { id: "billing", labelKey: "tabBilling", capability: "finance_read" },
    ],
  },
  {
    id: "admin-system",
    labelKey: "navSectionAdminSystem",
    superAdminOnly: true,
    items: [
      { id: "gen-errors", labelKey: "tabGenErrors", capability: "platform_ops" },
      { id: "runtime", labelKey: "tabRuntime", requiresSuperAdmin: true },
      { id: "email", labelKey: "tabEmail", requiresSuperAdmin: true },
      { id: "cache-management", labelKey: "tabCacheManagement", requiresSuperAdmin: true },
      { id: "audit", labelKey: "tabAudit", roles: ["admin", "super_admin"] },
    ],
  },
];

export const ADMIN_CONSOLE_TABS = new Set<ConsoleTab>(
  CONSOLE_ADMIN_SECTIONS.flatMap((section) => section.items.map((item) => item.id)),
);

const ALL_CONSOLE_TABS = new Set<ConsoleTab>([
  ...CONSOLE_USER_SECTIONS.flatMap((section) => section.items.map((item) => item.id)),
  ...ADMIN_CONSOLE_TABS,
]);

function canAccessAdminItem(item: ConsoleNavItem, role?: UserRole | null): boolean {
  // Local development and legacy emergency-console access have no session role; API gates remain authoritative.
  if (!role) return true;
  if (item.requiresSuperAdmin) return role === "super_admin";
  if (item.roles) return item.roles.includes(role);
  return item.capability ? roleHasAdminCapability(role, item.capability) : false;
}

export function buildConsoleNavSections(canViewAdminSection: boolean, role?: UserRole | null): ConsoleNavSection[] {
  if (!canViewAdminSection) return CONSOLE_USER_SECTIONS;
  return [
    ...CONSOLE_USER_SECTIONS,
    ...CONSOLE_ADMIN_SECTIONS
      .map((section) => ({ ...section, items: section.items.filter((item) => canAccessAdminItem(item, role)) }))
      .filter((section) => section.items.length > 0),
  ];
}

export function isAdminConsoleTab(tab: ConsoleTab): boolean {
  return ADMIN_CONSOLE_TABS.has(tab);
}

export function canAccessConsoleTab(tab: ConsoleTab, canViewAdminSection: boolean, role?: UserRole | null): boolean {
  if (!isAdminConsoleTab(tab)) return true;
  if (!canViewAdminSection) return false;
  const item = CONSOLE_ADMIN_SECTIONS.flatMap((section) => section.items).find((candidate) => candidate.id === tab);
  return Boolean(item && canAccessAdminItem(item, role));
}

/** URL 参数来自不可信输入；只有已注册的后台页签可以成为当前页。 */
export function isConsoleTab(value: string | null): value is ConsoleTab {
  return value !== null && ALL_CONSOLE_TABS.has(value as ConsoleTab);
}

export function defaultConsoleTab(): ConsoleTab {
  return "account";
}
import { roleHasAdminCapability, type AdminCapability } from "@/lib/auth/admin-capabilities";
import type { UserRole } from "@/lib/auth/types";
