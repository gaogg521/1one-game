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
 * 仅 super_admin 可见。按运营工作流分组，避免把内容治理、增长、运行时配置混成一个长列表。
 * 组别本身不改变权限；细粒度权限仍在页面/API 层执行。
 */
export const CONSOLE_ADMIN_SECTIONS: ConsoleNavSection[] = [
  {
    id: "admin-content",
    labelKey: "navSectionAdminContent",
    superAdminOnly: true,
    items: [
      { id: "overview", labelKey: "tabOverview" },
      { id: "pending", labelKey: "tabPending" },
      { id: "works", labelKey: "tabWorks" },
      { id: "samples", labelKey: "tabSamples" },
    ],
  },
  {
    id: "admin-growth",
    labelKey: "navSectionAdminGrowth",
    superAdminOnly: true,
    items: [
      { id: "shares", labelKey: "tabShares" },
      { id: "users", labelKey: "tabUsers" },
      { id: "billing", labelKey: "tabBilling" },
    ],
  },
  {
    id: "admin-system",
    labelKey: "navSectionAdminSystem",
    superAdminOnly: true,
    items: [
      { id: "gen-errors", labelKey: "tabGenErrors" },
      { id: "runtime", labelKey: "tabRuntime" },
      { id: "email", labelKey: "tabEmail" },
      { id: "cache-management", labelKey: "tabCacheManagement" },
      { id: "audit", labelKey: "tabAudit" },
    ],
  },
];

export const ADMIN_CONSOLE_TABS = new Set<ConsoleTab>(
  CONSOLE_ADMIN_SECTIONS.flatMap((section) => section.items.map((item) => item.id)),
);

export function buildConsoleNavSections(canViewAdminSection: boolean): ConsoleNavSection[] {
  if (!canViewAdminSection) return CONSOLE_USER_SECTIONS;
  return [...CONSOLE_USER_SECTIONS, ...CONSOLE_ADMIN_SECTIONS];
}

export function isAdminConsoleTab(tab: ConsoleTab): boolean {
  return ADMIN_CONSOLE_TABS.has(tab);
}

export function defaultConsoleTab(): ConsoleTab {
  return "account";
}
