"use client";

import { useCallback, useEffect, useMemo, useState, Fragment, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import {
  AdminDonutChart,
  AdminFunnelChart,
  AdminKpiStrip,
  AdminQuotaBars,
  AdminRankBars,
  AdminTrendChart,
  CHART_COLORS,
  ChartPanel,
  formatMoney,
  type DayPoint,
} from "@/components/admin/AdminCharts";
import { RuntimeConfigPanel } from "@/components/admin/RuntimeConfigPanel";
import { EmailConfigPanel } from "@/components/admin/EmailConfigPanel";
import { AdminConsoleShell } from "@/components/admin/AdminConsoleShell";
import { UserAccountOverview, UserProfilePanel, UserWalletPanel } from "@/components/admin/UserConsolePanels";
import { getSuperAdminKey, setSuperAdminKey } from "@/lib/super-admin-client";
import {
  buildConsoleNavSections,
  defaultConsoleTab,
  isAdminConsoleTab,
  type ConsoleTab,
} from "@/lib/console-nav";

type Tab = ConsoleTab;

const AUDIT_ACTION_FILTERS = [
  "",
  "quota_grant",
  "orders_export",
  "work_moderate",
  "work_moderate_batch",
  "user_role",
  "runtime_config_update",
  "email_config_update",
] as const;

type Stats = {
  users: number;
  works: { game: number; novel: number; comic: number };
  shares24h: number;
  moderation: { pendingReview: number; hidden: number };
  canManageRuntimeConfig?: boolean;
  canPromoteSuperAdmin?: boolean;
  actorRole?: string | null;
};

type WorkRow = {
  type: string;
  id: string;
  title: string;
  visibility: string;
  featured: boolean;
  createdAt: string;
  shareCode?: string | null;
  playCount?: number;
  likeCount?: number;
  shareCount?: number;
  novelId?: string | null;
  novelTitle?: string | null;
};

type ShareReport = {
  days: number;
  total: number;
  referralSignups: number;
  channels: { channel: string; count: number }[];
  topReferrers: { userId: string; displayName: string | null; referralCode: string | null; signups: number }[];
  topWorks: { workType: string; workId: string; title: string; events: number }[];
};

type UserRow = {
  id: string;
  displayName: string | null;
  email: string | null;
  role: string;
  referralCode: string;
  referralCount: number;
  providers: string[];
  createdAt: string;
};

type Analytics = {
  days: number;
  series: {
    shareEvents: DayPoint[];
    userSignups: DayPoint[];
    referralSignups: DayPoint[];
    worksCreated: { game: DayPoint[]; novel: DayPoint[]; comic: DayPoint[] };
  };
  product: {
    worksByType: { game: number; novel: number; comic: number };
    visibility: Record<string, number>;
    featured: number;
  };
  social: {
    shareTotal: number;
    referralSignups: number;
    conversionRate: number;
    channels: { channel: string; count: number }[];
    funnel: { stage: string; value: number }[];
  };
  commerce: {
    paidOrders: number;
    revenueCents: number;
    activeSubscriptions: number;
    planBreakdown: { planId: string; label: string; count: number }[];
    quotaByReason: { reason: string; events: number; deltaSum: number }[];
    paymentsByDay: DayPoint[];
  };
};

const ADMIN_PAGE_SIZE = 12;

export default function AdminConsolePage({
  consolePath = "/console",
  showSsoLogout = false,
  canViewAdminSection = false,
}: {
  consolePath?: string;
  showSsoLogout?: boolean;
  canViewAdminSection?: boolean;
}) {
  const t = useTranslations("adminPage");
  const tu = useTranslations("userConsole");
  const locale = useLocale() as AppLocale;
  const shareChannelLabel = useCallback(
    (channel: string) => {
      const key = `shareChannels.${channel}` as Parameters<typeof t>[0];
      return t.has(key) ? t(key) : channel;
    },
    [t],
  );
  const [tab, setTab] = useState<Tab>(defaultConsoleTab());
  const [stats, setStats] = useState<Stats | null>(null);
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [pending, setPending] = useState<WorkRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shares, setShares] = useState<ShareReport | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [adminKey, setAdminKeyDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState<"all" | string>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | string>("all");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [auditLogs, setAuditLogs] = useState<
    {
      id: string;
      action: string;
      targetType: string | null;
      targetId: string | null;
      detailJson: string | null;
      actorUserId: string | null;
      createdAt: string;
    }[]
  >([]);
  const [analyticsDays, setAnalyticsDays] = useState(14);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [auditSinceDays, setAuditSinceDays] = useState(30);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const navSections = useMemo(() => {
    const sections = buildConsoleNavSections(canViewAdminSection);
    if (!stats?.canManageRuntimeConfig) {
      return sections.map((section) =>
        section.id === "administrator"
          ? {
              ...section,
              items: section.items.filter((item) => item.id !== "runtime" && item.id !== "email"),
            }
          : section,
      );
    }
    return sections;
  }, [canViewAdminSection, stats?.canManageRuntimeConfig]);

  const flatNavItems = useMemo(
    () =>
      navSections.flatMap((section) =>
        section.items.map((item) => ({
          id: item.id,
          label: section.superAdminOnly
            ? t(item.labelKey as "tabOverview")
            : tu(item.labelKey as "tabAccount"),
        })),
      ),
    [navSections, t, tu],
  );

  useEffect(() => {
    if (!canViewAdminSection && isAdminConsoleTab(tab)) {
      setTab(defaultConsoleTab());
    }
  }, [canViewAdminSection, tab]);

  const headers = useCallback((): HeadersInit => {
    const h = mergeLocaleHeaders(locale) as Record<string, string>;
    const key = getSuperAdminKey();
    if (key) h["x-super-admin-key"] = key;
    return h;
  }, [locale]);

  const loadOverview = useCallback(async () => {
    const [sRes, wRes] = await Promise.all([
      fetch("/api/admin/stats", { headers: headers() }),
      fetch("/api/admin/works?limit=30", { headers: headers() }),
    ]);
    if (sRes.status === 403) throw new Error("forbidden");
    setStats((await sRes.json()) as Stats);
    const wData = (await wRes.json()) as { items?: WorkRow[] };
    setWorks(wData.items ?? []);
  }, [headers]);

  const loadPending = useCallback(async () => {
    const res = await fetch("/api/admin/works?visibility=pending_review&limit=50", { headers: headers() });
    if (res.status === 403) throw new Error("forbidden");
    const data = (await res.json()) as { items?: WorkRow[] };
    setPending(data.items ?? []);
    setSelected(new Set());
  }, [headers]);

  const loadShares = useCallback(async () => {
    const [shareRes, analyticsRes] = await Promise.all([
      fetch(`/api/admin/shares?days=${analyticsDays}`, { headers: headers() }),
      fetch(`/api/admin/analytics?days=${analyticsDays}`, { headers: headers() }),
    ]);
    if (shareRes.status === 403) throw new Error("forbidden");
    setShares((await shareRes.json()) as ShareReport);
    if (analyticsRes.ok) setAnalytics((await analyticsRes.json()) as Analytics);
  }, [analyticsDays, headers]);

  const loadAnalytics = useCallback(async () => {
    const res = await fetch(`/api/admin/analytics?days=${analyticsDays}`, { headers: headers() });
    if (res.status === 403) throw new Error("forbidden");
    setAnalytics((await res.json()) as Analytics);
  }, [analyticsDays, headers]);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users?limit=40", { headers: headers() });
    if (res.status === 403) throw new Error("forbidden");
    const data = (await res.json()) as { users?: UserRow[] };
    setUsers(data.users ?? []);
  }, [headers]);

  const loadAudit = useCallback(async () => {
    const params = new URLSearchParams({ limit: "60" });
    if (auditActionFilter) params.set("action", auditActionFilter);
    if (auditQuery.trim()) params.set("q", auditQuery.trim());
    if (auditSinceDays > 0) params.set("sinceDays", String(auditSinceDays));
    const res = await fetch(`/api/admin/audit-log?${params}`, { headers: headers() });
    if (!res.ok) return;
    const data = (await res.json()) as { logs?: typeof auditLogs };
    setAuditLogs(data.logs ?? []);
    setExpandedAuditId(null);
  }, [auditActionFilter, auditQuery, auditSinceDays, headers]);

  const exportOrdersCsv = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/export?days=${analyticsDays}`, { headers: headers() });
      if (!res.ok) {
        setNotice({ kind: "error", text: t("billingExportFailed") });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${analyticsDays}d.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice({ kind: "ok", text: t("billingExportDone") });
    } catch {
      setNotice({ kind: "error", text: t("billingExportFailed") });
    }
  }, [analyticsDays, headers, t]);

  const load = useCallback(async () => {
    if (!isAdminConsoleTab(tab)) {
      setLoading(false);
      setError("");
      return;
    }
    if (!canViewAdminSection) {
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (tab === "overview") await Promise.all([loadOverview(), loadAnalytics()]);
      else if (tab === "pending") await loadPending();
      else if (tab === "works") await loadOverview();
      else if (tab === "shares") await loadShares();
      else if (tab === "users") await loadUsers();
      else if (tab === "billing") await loadAnalytics();
      else if (tab === "audit") await loadAudit();
      else if (tab === "runtime") {
        /* RuntimeConfigPanel 自行加载 */
      }
    } catch {
      setError(t("noAdminAccess"));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [tab, canViewAdminSection, loadAnalytics, loadAudit, loadOverview, loadPending, loadShares, loadUsers, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canViewAdminSection) return;
    void fetch("/api/admin/stats", { headers: headers() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setStats(d as Stats);
      });
  }, [canViewAdminSection, headers]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [tab, query, workTypeFilter, visibilityFilter]);

  const visibleWorks = useMemo(() => {
    const source = tab === "pending" ? pending : works;
    const q = query.trim().toLowerCase();
    return source.filter((w) => {
      if (workTypeFilter !== "all" && w.type !== workTypeFilter) return false;
      if (visibilityFilter !== "all" && w.visibility !== visibilityFilter) return false;
      if (!q) return true;
      return `${w.title} ${w.type} ${w.id} ${w.visibility}`.toLowerCase().includes(q);
    });
  }, [pending, query, tab, visibilityFilter, workTypeFilter, works]);

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.displayName ?? ""} ${u.email ?? ""} ${u.role} ${u.referralCode} ${u.providers.join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [query, users]);

  const pageCount = Math.max(
    1,
    Math.ceil((tab === "users" ? visibleUsers.length : visibleWorks.length) / ADMIN_PAGE_SIZE),
  );
  const clampedPage = Math.min(page, pageCount);
  const pagedWorks = visibleWorks.slice((clampedPage - 1) * ADMIN_PAGE_SIZE, clampedPage * ADMIN_PAGE_SIZE);
  const pagedUsers = visibleUsers.slice((clampedPage - 1) * ADMIN_PAGE_SIZE, clampedPage * ADMIN_PAGE_SIZE);

  async function moderate(
    items: Array<{ type: string; id: string }>,
    visibility?: string,
    featured?: boolean,
  ) {
    const res = await fetch("/api/admin/works", {
      method: "PATCH",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        batch: items,
        ...(visibility ? { visibility } : {}),
        ...(typeof featured === "boolean" ? { featured } : {}),
      }),
    });
    if (!res.ok) {
      setNotice({ kind: "error", text: t("actionFailed") });
      return;
    }
    setNotice({ kind: "ok", text: t("actionDone") });
    void load();
  }

  async function batchApprove() {
    const batch = pending
      .filter((w) => selected.has(`${w.type}:${w.id}`))
      .map((w) => ({ type: w.type, id: w.id }));
    if (!batch.length) {
      setNotice({ kind: "error", text: t("selectPendingFirst") });
      return;
    }
    await moderate(batch, "public");
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <AdminConsoleShell
      navSections={navSections}
      activeNavId={tab}
      onNavChange={(id) => setTab(id as Tab)}
      actorRole={stats?.actorRole}
      consolePath={consolePath}
      showSsoLogout={showSsoLogout}
      secretKeySlot={
        error ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKeyDraft(e.target.value)}
              placeholder="SUPER_ADMIN_SECRET"
              className="min-w-[12rem] rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white"
            />
            <button
              type="button"
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80"
              onClick={() => {
                setSuperAdminKey(adminKey);
                void load();
              }}
            >
              {t("verifyKey")}
            </button>
          </div>
        ) : null
      }
    >
        <main className="flex min-h-0 w-full flex-col text-[var(--gc-text)]">
          <header className="sticky top-0 z-20 border-b border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg)_88%,transparent)] px-4 py-5 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--gc-text-faint)]">
                  {isAdminConsoleTab(tab) ? "Operations" : tu("consoleTitle")}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--gc-text)] sm:text-3xl">
                  {isAdminConsoleTab(tab) ? t("pageTitle") : tu("pageTitle")}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--gc-muted)] sm:text-[15px]">
                  {isAdminConsoleTab(tab) ? t("pageDesc") : tu("pageDesc")}
                </p>
              </div>
              <Link
                href="/studio"
                className="shrink-0 rounded-full border border-[color:var(--gc-border)] px-4 py-2 text-sm font-medium text-[var(--gc-muted)] transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:text-[var(--gc-text)]"
              >
                {t("backStudio")}
              </Link>
            </div>

            {stats && !error && isAdminConsoleTab(tab) ? (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <MiniStat label={t("statUsers")} value={stats.users} />
                <MiniStat
                  label={t("statWorks")}
                  value={stats.works.game + stats.works.novel + stats.works.comic}
                />
                <MiniStat label={t("statShares24h")} value={stats.shares24h} />
                <MiniStat label={t("statPending")} value={stats.moderation.pendingReview} highlight={stats.moderation.pendingReview > 0} />
              </div>
            ) : null}

            <nav className="gc-mobile-nav-scroll mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label={t("navAria")}>
              {flatNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  data-testid={`admin-tab-${item.id}`}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                    tab === item.id
                      ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[var(--gc-text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gc-accent)_35%,transparent)]"
                      : "border border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
                  }`}
                >
                  {item.label}
                  {item.id === "pending" && stats?.moderation.pendingReview ? ` · ${stats.moderation.pendingReview}` : ""}
                </button>
              ))}
            </nav>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {notice ? (
              <div
                className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
                  notice.kind === "ok"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    : "border-red-500/30 bg-red-500/10 text-red-200"
                }`}
              >
                <span>{notice.text}</span>
                <button type="button" className="text-xs opacity-75 hover:opacity-100" onClick={() => setNotice(null)}>
                  {t("close")}
                </button>
              </div>
            ) : null}

            {error ? (
              <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                <p>{error}</p>
              </div>
            ) : null}

            {tab === "account" ? <UserAccountOverview /> : null}
            {tab === "wallet" ? <UserWalletPanel /> : null}
            {tab === "profile" ? <UserProfilePanel /> : null}

            {loading && isAdminConsoleTab(tab) && tab !== "runtime" ? (
              <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-6 py-12 text-center text-sm text-[var(--gc-muted)]">
                {t("loading")}
              </div>
            ) : null}

            {!loading && !error && isAdminConsoleTab(tab) && (tab === "pending" || tab === "works" || tab === "users") ? (
              <AdminToolbar
                tab={tab}
                query={query}
                onQueryChange={setQuery}
                workTypeFilter={workTypeFilter}
                onWorkTypeFilterChange={setWorkTypeFilter}
                visibilityFilter={visibilityFilter}
                onVisibilityFilterChange={setVisibilityFilter}
                total={tab === "users" ? visibleUsers.length : visibleWorks.length}
              />
            ) : null}

            {!loading && !error && isAdminConsoleTab(tab) && (tab === "overview" || tab === "shares" || tab === "billing") ? (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--gc-muted)]">{t("chartWindow")}</p>
                <div className="flex gap-2">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setAnalyticsDays(d)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        analyticsDays === d
                          ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[var(--gc-text)]"
                          : "border border-[color:var(--gc-border)] text-[var(--gc-muted)]"
                      }`}
                    >
                      {t("daysUnit", { d })}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!loading && !error && isAdminConsoleTab(tab) && tab === "overview" && stats && analytics ? (
              <div className="space-y-5">
                <AdminKpiStrip
                  items={[
                    { label: t("kpiRegisteredUsers"), value: stats.users },
                    {
                      label: t("kpiTotalWorks"),
                      value: stats.works.game + stats.works.novel + stats.works.comic,
                      hint: t("kpiWorksHint", {
                        game: stats.works.game,
                        novel: stats.works.novel,
                        comic: stats.works.comic,
                      }),
                    },
                    {
                      label: t("kpiDaysShare", { days: analytics.days }),
                      value: analytics.social.shareTotal,
                      hint: t("kpi24hShare", { count: stats.shares24h }),
                      tone: "accent",
                    },
                    {
                      label: t("kpiReferralSignups"),
                      value: analytics.social.referralSignups,
                      hint: t("kpiShareToSignup", { rate: analytics.social.conversionRate }),
                      tone: "accent",
                    },
                    {
                      label: t("kpiPaidOrders"),
                      value: analytics.commerce.paidOrders,
                      hint: formatMoney(analytics.commerce.revenueCents),
                    },
                    {
                      label: t("kpiActiveSubscriptions"),
                      value: analytics.commerce.activeSubscriptions,
                    },
                    {
                      label: t("kpiPendingWorks"),
                      value: stats.moderation.pendingReview,
                      tone: stats.moderation.pendingReview > 0 ? "warn" : "default",
                    },
                    {
                      label: t("kpiFeaturedWorks"),
                      value: analytics.product.featured,
                    },
                  ]}
                />

                <div className="grid gap-5 xl:grid-cols-2">
                  <ChartPanel title={t("chartGrowthTrend")} subtitle={t("chartGrowthSubtitle", { days: analytics.days })}>
                    <AdminTrendChart
                      series={[
                        {
                          key: "shares",
                          label: t("seriesShareEvents"),
                          color: CHART_COLORS.accent,
                          points: analytics.series.shareEvents,
                        },
                        {
                          key: "signups",
                          label: t("seriesNewUsers"),
                          color: CHART_COLORS.referral,
                          points: analytics.series.userSignups,
                        },
                        {
                          key: "referrals",
                          label: t("kpiReferralSignups"),
                          color: CHART_COLORS.commerce,
                          points: analytics.series.referralSignups,
                        },
                      ]}
                    />
                  </ChartPanel>

                  <ChartPanel title={t("chartContentOutput")} subtitle={t("chartContentSubtitle")}>
                    <AdminTrendChart
                      series={[
                        {
                          key: "game",
                          label: t("typeGame"),
                          color: CHART_COLORS.game,
                          points: analytics.series.worksCreated.game,
                        },
                        {
                          key: "novel",
                          label: t("typeNovel"),
                          color: CHART_COLORS.novel,
                          points: analytics.series.worksCreated.novel,
                        },
                        {
                          key: "comic",
                          label: t("typeComic"),
                          color: CHART_COLORS.comic,
                          points: analytics.series.worksCreated.comic,
                        },
                      ]}
                    />
                  </ChartPanel>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                  <ChartPanel title={t("chartProductMatrix")} subtitle={t("chartProductSubtitle")}>
                    <AdminDonutChart
                      centerLabel={t("centerTotalWorks")}
                      centerValue={
                        analytics.product.worksByType.game +
                        analytics.product.worksByType.novel +
                        analytics.product.worksByType.comic
                      }
                      segments={[
                        { label: t("typeGame"), value: analytics.product.worksByType.game, color: CHART_COLORS.game },
                        { label: t("typeNovel"), value: analytics.product.worksByType.novel, color: CHART_COLORS.novel },
                        { label: t("typeComic"), value: analytics.product.worksByType.comic, color: CHART_COLORS.comic },
                      ]}
                    />
                  </ChartPanel>

                  <ChartPanel title={t("chartShareChannels")} subtitle={t("chartShareChannelsSubtitle")}>
                    <AdminDonutChart
                      centerLabel={t("centerShareEvents")}
                      centerValue={analytics.social.shareTotal}
                      segments={analytics.social.channels.map((c, i) => ({
                        label: shareChannelLabel(c.channel),
                        value: c.count,
                        color: channelColor(i),
                      }))}
                    />
                  </ChartPanel>

                  <ChartPanel title={t("chartMonetization")} subtitle={t("chartMonetizationSubtitle")}>
                    <div className="mb-4 space-y-2 text-sm">
                      <p className="text-[var(--gc-text-soft)]">
                        {t("revenueLabel")}{" "}
                        <span className="font-semibold text-[var(--gc-text)]">{formatMoney(analytics.commerce.revenueCents)}</span>
                      </p>
                      {analytics.commerce.planBreakdown.length > 0 ? (
                        <AdminRankBars
                          items={analytics.commerce.planBreakdown.map((p) => ({
                            label: p.label,
                            value: p.count,
                            hint: t("activeSubHint"),
                          }))}
                          valueSuffix={t("peopleSuffix")}
                        />
                      ) : (
                        <p className="text-xs text-[var(--gc-text-faint)]">{t("noActiveSubDistribution")}</p>
                      )}
                    </div>
                    <AdminQuotaBars items={analytics.commerce.quotaByReason} />
                  </ChartPanel>
                </div>

                <ChartPanel title={t("chartSocialFunnel")} subtitle={t("chartSocialFunnelSubtitle")}>
                  <AdminFunnelChart stages={analytics.social.funnel} />
                </ChartPanel>
              </div>
            ) : null}

            {!loading && !error && isAdminConsoleTab(tab) && tab === "overview" && stats && !analytics ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label={t("kpiRegisteredUsers")} value={stats.users} />
                <StatCard
                  label={t("kpiTotalWorks")}
                  value={stats.works.game + stats.works.novel + stats.works.comic}
                  sub={t("kpiWorksHint", {
                    game: stats.works.game,
                    novel: stats.works.novel,
                    comic: stats.works.comic,
                  })}
                />
                <StatCard label={t("stat24hShareEvents")} value={stats.shares24h} />
                <StatCard
                  label={t("statPendingHidden")}
                  value={stats.moderation.pendingReview}
                  sub={t("statHiddenCount", { count: stats.moderation.hidden })}
                />
              </div>
            ) : null}

            {!loading && !error && isAdminConsoleTab(tab) && tab === "pending" ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-medium text-[var(--gc-text)]">{t("pendingTitle")}</h2>
                  {pending.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400"
                        onClick={() => void batchApprove()}
                      >
                        {selected.size > 0 ? t("batchApproveCount", { count: selected.size }) : t("batchApprove")}
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-[color:var(--gc-border)] px-4 py-2 text-sm text-[var(--gc-muted)]"
                        onClick={() => setSelected(new Set(pending.map((w) => `${w.type}:${w.id}`)))}
                      >
                        {t("selectAll")}
                      </button>
                    </div>
                  ) : null}
                </div>
                {visibleWorks.length === 0 ? (
                  <EmptyCard title={t("emptyPendingTitle")} body={t("emptyPendingBody")} />
                ) : (
                  <>
                    <WorksTable
                      works={pagedWorks}
                      selectable
                      selected={selected}
                      onToggle={toggleSelect}
                      onModerate={(type, id, vis) => void moderate([{ type, id }], vis)}
                      onFeatured={(type, id, featured) => void moderate([{ type, id }], undefined, featured)}
                    />
                    <AdminPagination page={clampedPage} pageCount={pageCount} onPageChange={setPage} />
                  </>
                )}
              </section>
            ) : null}

            {!loading && !error && isAdminConsoleTab(tab) && tab === "works" ? (
              <section className="space-y-4">
                <h2 className="text-lg font-medium text-[var(--gc-text)]">{t("recentWorksTitle")}</h2>
                {visibleWorks.length === 0 ? (
                  <EmptyCard title={t("emptyWorksTitle")} body={t("emptyWorksBody")} />
                ) : (
                  <>
                    <WorksTable
                      works={pagedWorks}
                      onModerate={(type, id, vis) => void moderate([{ type, id }], vis)}
                      onFeatured={(type, id, featured) => void moderate([{ type, id }], undefined, featured)}
                    />
                    <AdminPagination page={clampedPage} pageCount={pageCount} onPageChange={setPage} />
                  </>
                )}
              </section>
            ) : null}

            {!loading && !error && isAdminConsoleTab(tab) && tab === "shares" && shares ? (
              <section className="space-y-6">
                {analytics ? (
                  <AdminKpiStrip
                    items={[
                      {
                        label: t("kpiDaysShare", { days: shares.days }),
                        value: shares.total,
                        tone: "accent",
                      },
                      {
                        label: t("kpiReferralSignups"),
                        value: shares.referralSignups,
                        hint: t("conversionRateHint", { rate: analytics.social.conversionRate }),
                        tone: "accent",
                      },
                      {
                        label: t("kpiActiveChannels"),
                        value: shares.channels.length,
                      },
                      {
                        label: t("kpiPaidConversion"),
                        value: analytics.commerce.paidOrders,
                        hint: formatMoney(analytics.commerce.revenueCents),
                      },
                    ]}
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <StatCard label={t("statDaysShareEvents", { days: shares.days })} value={shares.total} />
                    <StatCard label={t("kpiReferralSignups")} value={shares.referralSignups} sub={t("statReferralViaRef")} />
                    <StatCard label={t("statChannelCount")} value={shares.channels.length} />
                  </div>
                )}

                <div className="grid gap-5 xl:grid-cols-2">
                  {analytics ? (
                    <ChartPanel title={t("chartShareTrend")} subtitle={t("chartShareTrendSubtitle", { days: analytics.days })}>
                      <AdminTrendChart
                        series={[
                          {
                            key: "shares",
                            label: t("seriesShareEvents"),
                            color: CHART_COLORS.accent,
                            points: analytics.series.shareEvents,
                          },
                          {
                            key: "referrals",
                            label: t("kpiReferralSignups"),
                            color: CHART_COLORS.referral,
                            points: analytics.series.referralSignups,
                          },
                        ]}
                      />
                    </ChartPanel>
                  ) : null}

                  <ChartPanel title={t("chartChannelDistribution")} subtitle={t("chartChannelDistributionSubtitle")}>
                    {shares.channels.length > 0 ? (
                      <AdminRankBars
                        items={shares.channels.map((c) => ({
                          label: shareChannelLabel(c.channel),
                          value: c.count,
                        }))}
                        valueSuffix={t("timesSuffix")}
                      />
                    ) : (
                      <p className="text-sm text-[var(--gc-text-faint)]">{t("noShareChannelData")}</p>
                    )}
                  </ChartPanel>
                </div>

                {analytics ? (
                  <ChartPanel title={t("chartConversionFunnel")} subtitle={t("chartConversionFunnelSubtitle")}>
                    <AdminFunnelChart stages={analytics.social.funnel} />
                  </ChartPanel>
                ) : null}

                <div className="grid gap-5 xl:grid-cols-2">
                  {shares.topWorks.length > 0 ? (
                    <ChartPanel title={t("chartTopSharedWorks")} subtitle={t("chartTopSharedWorksSubtitle")}>
                      <AdminRankBars
                        items={shares.topWorks.map((w) => ({
                          label: `[${w.workType}] ${w.title}`,
                          value: w.events,
                          hint: w.workId,
                        }))}
                        valueSuffix={t("timesSuffix")}
                      />
                    </ChartPanel>
                  ) : null}
                  {shares.topReferrers.length > 0 ? (
                    <ChartPanel title={t("chartReferralLeaderboard")} subtitle={t("chartReferralLeaderboardSubtitle")}>
                      <AdminRankBars
                        items={shares.topReferrers.map((r) => ({
                          label: r.displayName ?? r.referralCode?.slice(0, 8) ?? r.userId,
                          value: r.signups,
                          hint: r.referralCode ?? undefined,
                        }))}
                        valueSuffix={t("peopleSuffix")}
                      />
                    </ChartPanel>
                  ) : null}
                </div>
              </section>
            ) : null}

            {!loading && !error && isAdminConsoleTab(tab) && tab === "users" ? (
              <section className="space-y-4">
                <h2 className="text-lg font-medium text-[var(--gc-text)]">{t("usersTitle")}</h2>
                {visibleUsers.length === 0 ? (
                  <EmptyCard title={t("emptyUsersTitle")} body={t("emptyUsersBody")} />
                ) : (
                  <>
                    <div className="space-y-3 md:hidden">
                      {pagedUsers.map((u) => (
                        <UserCard key={u.id} user={u} headers={headers} canPromoteSuperAdmin={stats?.canPromoteSuperAdmin} onReload={() => void load()} onNotice={setNotice} />
                      ))}
                    </div>
                    <div className="hidden md:block">
                      <UsersTable users={pagedUsers} headers={headers} canPromoteSuperAdmin={stats?.canPromoteSuperAdmin} onReload={() => void load()} onNotice={setNotice} />
                    </div>
                    <AdminPagination page={clampedPage} pageCount={pageCount} onPageChange={setPage} />
                  </>
                )}
              </section>
            ) : null}

            {!error && isAdminConsoleTab(tab) && tab === "billing" && analytics ? (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void exportOrdersCsv()}
                    className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-sm font-medium text-[var(--gc-text)] hover:border-[var(--gc-accent)]/40"
                  >
                    {t("billingExportCsv", { days: analytics.days })}
                  </button>
                </div>
                <AdminKpiStrip
                  items={[
                    {
                      label: t("kpiPaidOrders"),
                      value: analytics.commerce.paidOrders,
                      hint: formatMoney(analytics.commerce.revenueCents),
                      tone: "accent",
                    },
                    {
                      label: t("kpiActiveSubscriptions"),
                      value: analytics.commerce.activeSubscriptions,
                    },
                    {
                      label: t("kpiRevenueWindow"),
                      value: formatMoney(analytics.commerce.revenueCents),
                      hint: t("chartWindowDays", { days: analytics.days }),
                    },
                  ]}
                />
                <div className="grid gap-5 xl:grid-cols-2">
                  <ChartPanel title={t("chartMonetization")} subtitle={t("billingSubtitle")}>
                    <div className="mb-4 space-y-2 text-sm">
                      {analytics.commerce.planBreakdown.length > 0 ? (
                        <AdminRankBars
                          items={analytics.commerce.planBreakdown.map((p) => ({
                            label: p.label,
                            value: p.count,
                            hint: t("activeSubHint"),
                          }))}
                          valueSuffix={t("peopleSuffix")}
                        />
                      ) : (
                        <p className="text-xs text-[var(--gc-text-faint)]">{t("noActiveSubDistribution")}</p>
                      )}
                    </div>
                    <AdminQuotaBars items={analytics.commerce.quotaByReason} />
                  </ChartPanel>
                  <ChartPanel title={t("chartPaymentTrend")} subtitle={t("chartPaymentTrendSubtitle", { days: analytics.days })}>
                    {analytics.commerce.paymentsByDay.some((p) => p.value > 0) ? (
                      <AdminTrendChart
                        series={[
                          {
                            key: "payments",
                            label: t("seriesPayments"),
                            color: CHART_COLORS.commerce,
                            points: analytics.commerce.paymentsByDay,
                          },
                        ]}
                      />
                    ) : (
                      <p className="text-sm text-[var(--gc-text-faint)]">{t("billingNoPayments")}</p>
                    )}
                  </ChartPanel>
                </div>
                <ChartPanel title={t("billingOpsHintTitle")} subtitle={t("billingOpsHintSubtitle")}>
                  <p className="text-sm text-[var(--gc-muted)]">{t("billingOpsHintBody")}</p>
                </ChartPanel>
              </section>
            ) : null}

            {!error && isAdminConsoleTab(tab) && tab === "billing" && !loading && !analytics ? (
              <EmptyCard title={t("tabBilling")} body={t("loading")} />
            ) : null}

            {!error && isAdminConsoleTab(tab) && tab === "audit" ? (
              <section className="space-y-4">
                <ChartPanel title={t("tabAudit")} subtitle={t("auditSubtitle")}>
                  <div className="mb-4 flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-xs text-[var(--gc-muted)]">
                      {t("auditFilterAction")}
                      <select
                        value={auditActionFilter}
                        onChange={(e) => setAuditActionFilter(e.target.value)}
                        className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-2 py-1.5 text-sm text-[var(--gc-text)]"
                      >
                        {AUDIT_ACTION_FILTERS.map((action) => (
                          <option key={action || "all"} value={action}>
                            {action ? t(`auditAction_${action}` as Parameters<typeof t>[0]) : t("auditFilterAllActions")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-[var(--gc-muted)]">
                      {t("auditFilterSearch")}
                      <input
                        value={auditQuery}
                        onChange={(e) => setAuditQuery(e.target.value)}
                        placeholder={t("auditFilterSearchPlaceholder")}
                        className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-2 py-1.5 text-sm text-[var(--gc-text)]"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-[var(--gc-muted)]">
                      {t("auditFilterSince")}
                      <select
                        value={auditSinceDays}
                        onChange={(e) => setAuditSinceDays(Number.parseInt(e.target.value, 10) || 30)}
                        className="rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-2 py-1.5 text-sm text-[var(--gc-text)]"
                      >
                        {[7, 30, 90].map((d) => (
                          <option key={d} value={d}>
                            {t("daysUnit", { d })}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => void loadAudit()}
                      className="rounded-full border border-[color:var(--gc-border)] px-4 py-1.5 text-sm font-medium text-[var(--gc-text)] hover:bg-[var(--gc-surface-glass)]"
                    >
                      {t("auditApplyFilters")}
                    </button>
                  </div>
                  {loading ? (
                    <p className="text-sm text-[var(--gc-muted)]">{t("loading")}</p>
                  ) : auditLogs.length === 0 ? (
                    <p className="text-sm text-[var(--gc-muted)]">{t("auditEmpty")}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-[color:var(--gc-border)] text-[var(--gc-muted)]">
                            <th className="px-2 py-2 font-medium">{t("auditColTime")}</th>
                            <th className="px-2 py-2 font-medium">{t("auditColAction")}</th>
                            <th className="px-2 py-2 font-medium">{t("auditColTarget")}</th>
                            <th className="px-2 py-2 font-medium">{t("auditColActor")}</th>
                            <th className="px-2 py-2 font-medium">{t("auditColDetail")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map((row) => {
                            const expanded = expandedAuditId === row.id;
                            const detailPreview = row.detailJson?.trim();
                            return (
                              <Fragment key={row.id}>
                                <tr className="border-b border-[color:var(--gc-border)]/60">
                                  <td className="px-2 py-2 tabular-nums text-[var(--gc-text-faint)]">
                                    {new Date(row.createdAt).toLocaleString()}
                                  </td>
                                  <td className="px-2 py-2 font-medium">{row.action}</td>
                                  <td className="px-2 py-2 text-[var(--gc-muted)]">
                                    {row.targetType ? `${row.targetType}:${row.targetId ?? "—"}` : "—"}
                                  </td>
                                  <td className="px-2 py-2 text-[var(--gc-muted)]">{row.actorUserId ?? "—"}</td>
                                  <td className="px-2 py-2">
                                    {detailPreview ? (
                                      <button
                                        type="button"
                                        className="text-xs font-medium text-[var(--gc-accent)] hover:underline"
                                        onClick={() => setExpandedAuditId(expanded ? null : row.id)}
                                      >
                                        {expanded ? t("auditCollapseDetail") : t("auditExpandDetail")}
                                      </button>
                                    ) : (
                                      <span className="text-[var(--gc-text-faint)]">—</span>
                                    )}
                                  </td>
                                </tr>
                                {expanded && detailPreview ? (
                                  <tr key={`${row.id}-detail`} className="border-b border-[color:var(--gc-border)]/40 bg-[var(--gc-surface-glass)]/40">
                                    <td colSpan={5} className="px-3 py-2">
                                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs text-[var(--gc-muted)]">
                                        {formatAuditDetail(detailPreview)}
                                      </pre>
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ChartPanel>
              </section>
            ) : null}

            {!error && isAdminConsoleTab(tab) && tab === "runtime" ? (
              <RuntimeConfigPanel headers={headers} onNotice={setNotice} />
            ) : null}

            {!error && isAdminConsoleTab(tab) && tab === "email" ? (
              <EmailConfigPanel headers={headers} onNotice={setNotice} />
            ) : null}
          </div>
        </main>
    </AdminConsoleShell>
  );
}

function formatAuditDetail(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        highlight
          ? "border-amber-500/35 bg-[color:color-mix(in_srgb,#f59e0b_12%,var(--gc-bg-elevated))]"
          : "border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)]"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-[var(--gc-muted)]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--gc-text)]">{value}</p>
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-surface-glass)_60%,transparent)] px-6 py-12 text-center">
      <p className="text-base font-medium text-[var(--gc-text)]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--gc-muted)]">{body}</p>
    </div>
  );
}

function AdminToolbar({
  tab,
  query,
  onQueryChange,
  workTypeFilter,
  onWorkTypeFilterChange,
  visibilityFilter,
  onVisibilityFilterChange,
  total,
}: {
  tab: Tab;
  query: string;
  onQueryChange: (value: string) => void;
  workTypeFilter: string;
  onWorkTypeFilterChange: (value: string) => void;
  visibilityFilter: string;
  onVisibilityFilterChange: (value: string) => void;
  total: number;
}) {
  const t = useTranslations("adminPage");
  const isWorkTab = tab === "pending" || tab === "works";
  return (
    <div className="mb-5 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("searchSrOnly")}</span>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={tab === "users" ? t("searchUsersPlaceholder") : t("searchWorksPlaceholder")}
            className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:var(--gc-accent)]"
          />
        </label>
        {isWorkTab ? (
          <>
            <select
              value={workTypeFilter}
              onChange={(e) => onWorkTypeFilterChange(e.target.value)}
              className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2.5 text-sm"
            >
              <option value="all">{t("filterAllTypes")}</option>
              <option value="game">{t("typeGame")}</option>
              <option value="novel">{t("typeNovel")}</option>
              <option value="comic">{t("typeComic")}</option>
              <option value="project">{t("typeProject")}</option>
            </select>
            <select
              value={visibilityFilter}
              onChange={(e) => onVisibilityFilterChange(e.target.value)}
              className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2.5 text-sm"
            >
              <option value="all">{t("filterAllStatus")}</option>
              <option value="pending_review">{t("statusPendingReview")}</option>
              <option value="public">{t("statusPublic")}</option>
              <option value="hidden">{t("statusHidden")}</option>
            </select>
          </>
        ) : null}
        <span className="shrink-0 text-sm text-[var(--gc-muted)]">{t("totalCount", { total })}</span>
      </div>
    </div>
  );
}

function AdminPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("adminPage");
  if (pageCount <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="rounded-full border border-[color:var(--gc-border)] px-4 py-2 text-[var(--gc-muted)] disabled:opacity-40"
      >
        {t("prevPage")}
      </button>
      <span className="text-[var(--gc-muted)]">
        {page} / {pageCount}
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        className="rounded-full border border-[color:var(--gc-border)] px-4 py-2 text-[var(--gc-muted)] disabled:opacity-40"
      >
        {t("nextPage")}
      </button>
    </div>
  );
}

function WorksTable({
  works,
  selectable,
  selected,
  onToggle,
  onModerate,
  onFeatured,
}: {
  works: WorkRow[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (key: string) => void;
  onModerate: (type: string, id: string, visibility: string) => void;
  onFeatured: (type: string, id: string, featured: boolean) => void;
}) {
  const t = useTranslations("adminPage");
  return (
    <>
      <div className="space-y-3 lg:hidden">
        {works.map((w) => {
          const key = `${w.type}:${w.id}`;
          return (
            <div key={key} className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4">
              <div className="flex items-start gap-3">
                {selectable ? (
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected?.has(key) ?? false}
                    onChange={() => onToggle?.(key)}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--gc-muted)]">{w.type}</p>
                  <p className="mt-1 font-medium text-[var(--gc-text)]">{w.title}</p>
                  <p className="mt-1 text-sm text-[var(--gc-muted)]">
                    {w.visibility}
                    {w.featured ? t("featuredBadge") : ""}
                  </p>
                  <WorkEngagementMeta work={w} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <WorkActions work={w} onModerate={onModerate} onFeatured={onFeatured} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-[color:var(--gc-border)] lg:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-[var(--gc-surface-glass)] text-[var(--gc-muted)]">
            <tr>
              {selectable ? <th className="px-4 py-3" /> : null}
              <th className="px-4 py-3 font-medium">{t("colType")}</th>
              <th className="px-4 py-3 font-medium">{t("colTitle")}</th>
              <th className="px-4 py-3 font-medium">{t("colEngagement")}</th>
              <th className="px-4 py-3 font-medium">{t("colRelation")}</th>
              <th className="px-4 py-3 font-medium">{t("colVisibility")}</th>
              <th className="px-4 py-3 font-medium">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {works.map((w) => {
              const key = `${w.type}:${w.id}`;
              return (
                <tr key={key} className="border-t border-[color:var(--gc-border)]">
                  {selectable ? (
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected?.has(key) ?? false} onChange={() => onToggle?.(key)} />
                    </td>
                  ) : null}
                  <td className="px-4 py-3 text-[var(--gc-muted)]">{w.type}</td>
                  <td className="max-w-[220px] truncate px-4 py-3">{w.title}</td>
                  <td className="px-4 py-3">
                    <WorkEngagementMeta work={w} compact />
                  </td>
                  <td className="max-w-[180px] px-4 py-3 text-xs text-[var(--gc-muted)]">
                    <WorkRelationMeta work={w} />
                  </td>
                  <td className="px-4 py-3">
                    {w.visibility}
                    {w.featured ? t("featuredBadge") : ""}
                  </td>
                  <td className="px-4 py-3">
                    <WorkActions work={w} onModerate={onModerate} onFeatured={onFeatured} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function WorkEngagementMeta({ work, compact = false }: { work: WorkRow; compact?: boolean }) {
  const t = useTranslations("adminPage");
  const play = work.playCount ?? 0;
  const likes = work.likeCount ?? 0;
  const shares = work.shareCount ?? 0;
  const cls = compact
    ? "flex flex-col gap-0.5 text-xs text-[var(--gc-muted)]"
    : "mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--gc-muted)]";

  return (
    <div className={cls} data-testid={`admin-work-engagement-${work.type}-${work.id}`}>
      {work.type !== "comic" ? (
        <span>{t("engagementPlays", { count: play })}</span>
      ) : null}
      <span>{t("engagementLikes", { count: likes })}</span>
      <span>{t("engagementShares", { count: shares })}</span>
      {work.shareCode ? (
        <span className="font-mono text-[10px] text-[var(--gc-text-faint)]">{t("engagementShareCode", { code: work.shareCode })}</span>
      ) : null}
    </div>
  );
}

function WorkRelationMeta({ work }: { work: WorkRow }) {
  const t = useTranslations("adminPage");
  if (work.type === "comic") {
    if (work.novelId && work.novelTitle) {
      return (
        <span title={work.novelId}>
          {t("relationFromNovel", { title: work.novelTitle })}
        </span>
      );
    }
    return <span>{t("relationStandaloneComic")}</span>;
  }
  if (work.shareCode) {
    return <span className="font-mono">{work.shareCode}</span>;
  }
  return <span>—</span>;
}

function WorkActions({
  work,
  onModerate,
  onFeatured,
}: {
  work: WorkRow;
  onModerate: (type: string, id: string, visibility: string) => void;
  onFeatured: (type: string, id: string, featured: boolean) => void;
}) {
  const t = useTranslations("adminPage");
  return (
    <div className="flex flex-wrap gap-2">
      {work.visibility !== "public" ? (
        <button type="button" className="text-sm text-emerald-400" onClick={() => onModerate(work.type, work.id, "public")}>
          {t("actionPublish")}
        </button>
      ) : (
        <button type="button" className="text-sm text-amber-400" onClick={() => onModerate(work.type, work.id, "hidden")}>
          {t("actionHide")}
        </button>
      )}
      <button type="button" className="text-sm text-[var(--gc-accent)]" onClick={() => onFeatured(work.type, work.id, !work.featured)}>
        {work.featured ? t("actionUnfeature") : t("actionFeature")}
      </button>
    </div>
  );
}

function UsersTable({
  users,
  headers,
  onReload,
  onNotice,
  canPromoteSuperAdmin,
}: {
  users: UserRow[];
  headers: () => HeadersInit;
  onReload: () => void;
  onNotice: (notice: { kind: "ok" | "error"; text: string }) => void;
  canPromoteSuperAdmin?: boolean;
}) {
  const t = useTranslations("adminPage");
  return (
    <div className="overflow-x-auto rounded-2xl border border-[color:var(--gc-border)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-[var(--gc-surface-glass)] text-[var(--gc-muted)]">
          <tr>
            <th className="px-4 py-3 font-medium">{t("colNickname")}</th>
            <th className="px-4 py-3 font-medium">{t("colRole")}</th>
            <th className="px-4 py-3 font-medium">{t("colLogin")}</th>
            <th className="px-4 py-3 font-medium">{t("colReferral")}</th>
            <th className="px-4 py-3 font-medium">{t("colActions")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-[color:var(--gc-border)]">
              <td className="px-4 py-3">{u.displayName ?? "—"}</td>
              <td className="px-4 py-3">{u.role}</td>
              <td className="px-4 py-3">{u.providers.join(", ") || "—"}</td>
              <td className="px-4 py-3">{u.referralCount}</td>
              <td className="px-4 py-3">
                <UserActions user={u} headers={headers} canPromoteSuperAdmin={canPromoteSuperAdmin} onReload={onReload} onNotice={onNotice} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserCard({
  user,
  headers,
  onReload,
  onNotice,
  canPromoteSuperAdmin,
}: {
  user: UserRow;
  headers: () => HeadersInit;
  onReload: () => void;
  onNotice: (notice: { kind: "ok" | "error"; text: string }) => void;
  canPromoteSuperAdmin?: boolean;
}) {
  const t = useTranslations("adminPage");
  return (
    <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4">
      <p className="font-medium text-[var(--gc-text)]">{user.displayName ?? t("unnamedUser")}</p>
      <p className="mt-1 text-sm text-[var(--gc-muted)]">
        {t("userReferralLine", {
          role: user.role,
          count: user.referralCount,
          providers: user.providers.join(", ") || "—",
        })}
      </p>
      <div className="mt-3">
        <UserActions user={user} headers={headers} canPromoteSuperAdmin={canPromoteSuperAdmin} onReload={onReload} onNotice={onNotice} />
      </div>
    </div>
  );
}

function UserActions({
  user,
  headers,
  onReload,
  onNotice,
  canPromoteSuperAdmin,
}: {
  user: UserRow;
  headers: () => HeadersInit;
  onReload: () => void;
  onNotice: (notice: { kind: "ok" | "error"; text: string }) => void;
  canPromoteSuperAdmin?: boolean;
}) {
  const t = useTranslations("adminPage");
  const canPromoteSuper = canPromoteSuperAdmin === true;
  return (
    <div className="flex flex-wrap gap-3">
      {user.role !== "admin" && user.role !== "super_admin" ? (
        <button
          type="button"
          className="text-sm text-[var(--gc-accent)]"
          onClick={async () => {
            const res = await fetch("/api/admin/users", {
              method: "PATCH",
              headers: { ...headers(), "Content-Type": "application/json" },
              body: JSON.stringify({ id: user.id, role: "admin" }),
            });
            if (res.ok) {
              onNotice({ kind: "ok", text: t("roleUpdated") });
              onReload();
            } else {
              onNotice({ kind: "error", text: t("roleUpdateFailed") });
            }
          }}
        >
          {t("setAdminRole")}
        </button>
      ) : null}
      {canPromoteSuper && user.role === "admin" ? (
        <button
          type="button"
          className="text-sm text-sky-300"
          data-testid={`promote-super-admin-${user.id}`}
          onClick={async () => {
            if (!confirm(t("setSuperAdminConfirm"))) return;
            const res = await fetch("/api/admin/users", {
              method: "PATCH",
              headers: { ...headers(), "Content-Type": "application/json" },
              body: JSON.stringify({ id: user.id, role: "super_admin" }),
            });
            if (res.ok) {
              onNotice({ kind: "ok", text: t("roleUpdated") });
              onReload();
            } else {
              onNotice({ kind: "error", text: t("roleUpdateFailed") });
            }
          }}
        >
          {t("setSuperAdminRole")}
        </button>
      ) : null}
      <button
        type="button"
        className="text-sm text-emerald-500"
        onClick={async () => {
          const raw = window.prompt(t("quotaPrompt"), "30");
          if (!raw) return;
          const delta = Number.parseInt(raw, 10);
          if (!Number.isFinite(delta) || delta === 0) return;
          const res = await fetch("/api/admin/quota", {
            method: "POST",
            headers: { ...headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, delta }),
          });
          if (res.ok) onNotice({ kind: "ok", text: t("quotaUpdated") });
          else onNotice({ kind: "error", text: t("quotaGrantFailed") });
        }}
      >
        {t("grantQuota")}
      </button>
    </div>
  );
}

const CHANNEL_PALETTE = ["#38bdf8", "#34d399", "#a78bfa", "#fbbf24", "#f472b6", "#fb7185", "#94a3b8"];

function channelColor(index: number): string {
  return CHANNEL_PALETTE[index % CHANNEL_PALETTE.length] ?? CHART_COLORS.accent;
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-5">
      <p className="text-sm text-[var(--gc-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--gc-text)]">{value}</p>
      {sub ? <p className="mt-2 text-sm text-[var(--gc-text-faint)]">{sub}</p> : null}
    </div>
  );
}
