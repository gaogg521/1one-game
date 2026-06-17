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
  | "runtime"
  | "email";

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

/** 仅 super_admin 可见（侧边栏底部「管理员」） */
export const CONSOLE_ADMIN_SECTION: ConsoleNavSection = {
  id: "administrator",
  labelKey: "navSectionAdmin",
  superAdminOnly: true,
  items: [
    { id: "overview", labelKey: "tabOverview" },
    { id: "pending", labelKey: "tabPending" },
    { id: "works", labelKey: "tabWorks" },
    { id: "samples", labelKey: "tabSamples" },
    { id: "shares", labelKey: "tabShares" },
    { id: "users", labelKey: "tabUsers" },
    { id: "billing", labelKey: "tabBilling" },
    { id: "audit", labelKey: "tabAudit" },
    { id: "runtime", labelKey: "tabRuntime" },
    { id: "email", labelKey: "tabEmail" },
  ],
};

export const ADMIN_CONSOLE_TABS = new Set<ConsoleTab>(
  CONSOLE_ADMIN_SECTION.items.map((i) => i.id),
);

export function buildConsoleNavSections(canViewAdminSection: boolean): ConsoleNavSection[] {
  if (!canViewAdminSection) return CONSOLE_USER_SECTIONS;
  return [...CONSOLE_USER_SECTIONS, CONSOLE_ADMIN_SECTION];
}

export function isAdminConsoleTab(tab: ConsoleTab): boolean {
  return ADMIN_CONSOLE_TABS.has(tab);
}

export function defaultConsoleTab(): ConsoleTab {
  return "account";
}
