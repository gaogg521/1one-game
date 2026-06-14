"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CHART_COLORS } from "@/components/admin/AdminCharts";
import type {
  LlmProtocol,
  RuntimeLlmProvider,
  RuntimeModelRoute,
  RuntimeProviderPublic,
  RuntimeSceneKey,
} from "@/lib/runtime-providers";
import { createProviderFromTemplate, type ProviderTemplateId } from "@/lib/runtime-provider-templates";
import { RUNTIME_SCENE_CATALOG } from "@/lib/runtime-scene-catalog";
import {
  RuntimeProviderTemplateHint,
  RuntimeProviderTemplateMeta,
  RuntimeProviderTemplateSelect,
} from "@/components/admin/RuntimeProviderCatalog";

export type RuntimeConfigView = {
  updatedAt: string | null;
  secrets: {
    openaiApiKey: string | null;
    openaiBaseUrl: string | null;
    openaiUserAgent: string | null;
    geminiApiKey: string | null;
    geminiBaseUrl: string | null;
    anthropicApiKey: string | null;
  };
  sources: Record<string, "env" | "db" | "none">;
  models: {
    gamePrimary: string;
    gameFallbacks: string[];
    novelTextPrimary: string;
    novelTextFallback: string;
    imageOpenAI: string;
    imageGemini: string;
  };
  modelSources: Record<string, "product" | "db">;
  productDefaults: {
    gamePrimary: string;
    gameFallbacks: string[];
    novelTextPrimary: string;
    novelTextFallback: string;
    imageOpenAI: string;
    imageGemini: string;
  };
  providers: RuntimeProviderPublic[];
  routes: RuntimeModelRoute[];
};

type ProviderFormState = {
  id: string;
  name: string;
  protocol: LlmProtocol;
  baseUrl: string;
  apiKeyDraft: string;
  userAgent: string;
  modelsText: string;
  enabled: boolean;
  apiKeyMasked: string | null;
  apiKeySource: "env" | "db" | "none";
  templateId?: ProviderTemplateId;
};

function parseModelsText(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const m = part.trim();
    if (m && !seen.has(m)) {
      seen.add(m);
      out.push(m);
    }
  }
  return out;
}

function providerFromView(p: RuntimeProviderPublic): ProviderFormState {
  return {
    id: p.id,
    name: p.name,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    apiKeyDraft: "",
    userAgent: p.userAgent ?? "",
    modelsText: p.models.join(", "),
    enabled: p.enabled,
    apiKeyMasked: p.apiKey,
    apiKeySource: p.apiKeySource,
  };
}

function providerToPayload(form: ProviderFormState): RuntimeLlmProvider {
  return {
    id: form.id,
    name: form.name.trim() || "未命名服务商",
    protocol: form.protocol,
    baseUrl: form.baseUrl.trim(),
    apiKey: form.apiKeyDraft.trim(),
    userAgent: form.userAgent.trim() || undefined,
    models: parseModelsText(form.modelsText),
    enabled: form.enabled,
  };
}

const PROTOCOL_OPTIONS: LlmProtocol[] = ["openai_compatible", "gemini", "anthropic"];

type Props = {
  headers: () => HeadersInit;
  onNotice: (notice: { kind: "ok" | "error"; text: string }) => void;
};

type PanelSection = "providers" | "routing";

const DOMAIN = {
  game: { color: CHART_COLORS.game, labelKey: "domainGame" as const },
  novel: { color: CHART_COLORS.novel, labelKey: "domainNovel" as const },
  comic: { color: CHART_COLORS.comic, labelKey: "domainComic" as const },
};

function SourceBadge({ source }: { source: "env" | "db" | "none" | "product" }) {
  const t = useTranslations("adminPage.runtimeConfig");
  const label =
    source === "db"
      ? t("sourceDb")
      : source === "env"
        ? t("sourceEnv")
        : source === "product"
          ? t("sourceProduct")
          : t("sourceNone");
  const cls =
    source === "db"
      ? "text-sky-300 bg-sky-500/10 border-sky-500/25"
      : source === "env"
        ? "text-amber-200 bg-amber-500/10 border-amber-500/25"
        : source === "product"
          ? "text-[var(--gc-muted)] bg-white/5 border-white/10"
          : "text-red-200 bg-red-500/10 border-red-500/25";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function StatusDot({ ok }: { ok: boolean | "optional" }) {
  const cls =
    ok === true
      ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]"
      : ok === "optional"
        ? "bg-[var(--gc-text-faint)]"
        : "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.45)]";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

type ProviderEditState = "live" | "modified" | "draft";

function normalizeProviderCompare(p: ProviderFormState) {
  return {
    name: p.name,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    userAgent: p.userAgent,
    modelsText: p.modelsText,
    enabled: p.enabled,
  };
}

function providerEditState(
  id: string,
  saved: ProviderFormState[],
  current: ProviderFormState[],
): ProviderEditState {
  const cur = current.find((p) => p.id === id);
  if (!cur) return "live";
  const sav = saved.find((p) => p.id === id);
  if (!sav) return "draft";
  if (cur.apiKeyDraft.trim()) return "modified";
  return JSON.stringify(normalizeProviderCompare(sav)) === JSON.stringify(normalizeProviderCompare(cur))
    ? "live"
    : "modified";
}

function routeIsPending(saved: RuntimeModelRoute | undefined, current: RuntimeModelRoute | undefined) {
  if (!saved || !current) return Boolean(current);
  return (
    saved.providerId !== current.providerId
    || saved.primary !== current.primary
    || JSON.stringify(saved.fallbacks) !== JSON.stringify(current.fallbacks)
  );
}

function EditStateBadge({ state }: { state: ProviderEditState | "routePending" }) {
  const t = useTranslations("adminPage.runtimeConfig");
  const label =
    state === "live"
      ? t("editStateLive")
      : state === "modified"
        ? t("editStateModified")
        : state === "draft"
          ? t("editStateDraft")
          : t("routePendingSave");
  const cls =
    state === "live"
      ? "text-emerald-200 bg-emerald-500/10 border-emerald-500/25"
      : state === "draft"
        ? "text-sky-200 bg-sky-500/10 border-sky-500/25"
        : "text-amber-200 bg-amber-500/10 border-amber-500/25";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function LiveRuntimeSummary({
  routes,
  providers,
}: {
  routes: RuntimeModelRoute[];
  providers: ProviderFormState[];
}) {
  const t = useTranslations("adminPage.runtimeConfig");
  return (
    <section
      className="overflow-hidden rounded-xl border border-emerald-500/25 bg-[color:color-mix(in_srgb,#10b981_8%,transparent)]"
      data-testid="admin-runtime-live-summary"
    >
      <div className="border-b border-emerald-500/15 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusDot ok />
          <h3 className="text-base font-semibold text-[var(--gc-text)]">{t("liveSummaryTitle")}</h3>
          <EditStateBadge state="live" />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--gc-muted)]">{t("liveSummaryHint")}</p>
      </div>
      <div className="overflow-x-auto px-4 py-3 sm:px-5">
        {routes.length === 0 ? (
          <p className="text-sm text-[var(--gc-muted)]">{t("liveSummaryEmpty")}</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[var(--gc-text-faint)]">
                <th className="pb-2 pr-4 font-medium">{t("routeColScene")}</th>
                <th className="pb-2 pr-4 font-medium">{t("routeColProvider")}</th>
                <th className="pb-2 pr-4 font-medium">{t("routeColPrimary")}</th>
                <th className="pb-2 font-medium">{t("routeColFallback")}</th>
              </tr>
            </thead>
            <tbody>
              {RUNTIME_SCENE_CATALOG.map((meta) => {
                const route = routes.find((r) => r.scene === meta.scene);
                const provider = providers.find((p) => p.id === route?.providerId);
                const domain =
                  meta.domain === "game" ? DOMAIN.game : meta.domain === "novel" ? DOMAIN.novel : DOMAIN.comic;
                return (
                  <tr key={meta.scene} className="border-t border-white/6">
                    <td className="py-2.5 pr-4 align-top">
                      <span
                        className="mr-2 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                        style={{
                          color: domain.color,
                          background: `color-mix(in srgb, ${domain.color} 14%, transparent)`,
                        }}
                      >
                        {t(domain.labelKey)}
                      </span>
                      <span className="text-[var(--gc-text)]">{t(meta.labelKey)}</span>
                    </td>
                    <td className="py-2.5 pr-4 align-top font-mono text-[12px] text-[var(--gc-muted)]">
                      {provider?.name.trim() || route?.providerId || "—"}
                    </td>
                    <td className="py-2.5 pr-4 align-top font-mono text-[12px] text-[var(--gc-text)]">
                      {route?.primary || "—"}
                    </td>
                    <td className="py-2.5 align-top font-mono text-[12px] text-[var(--gc-muted)]">
                      {(route?.fallbacks ?? []).join(", ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function EnvLegacySecretsPanel({ view }: { view: RuntimeConfigView }) {
  const t = useTranslations("adminPage.runtimeConfig");
  const rows = [
    { label: t("legacyOpenaiKey"), value: view.secrets.openaiApiKey, source: view.sources.openaiApiKey },
    { label: t("legacyOpenaiBase"), value: view.secrets.openaiBaseUrl, source: view.sources.openaiBaseUrl },
    { label: t("legacyGeminiKey"), value: view.secrets.geminiApiKey, source: view.sources.geminiApiKey },
    { label: t("legacyGeminiBase"), value: view.secrets.geminiBaseUrl, source: view.sources.geminiBaseUrl },
    { label: t("legacyAnthropicKey"), value: view.secrets.anthropicApiKey, source: view.sources.anthropicApiKey },
  ].filter((row) => row.source !== "none" || row.value);

  if (rows.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-amber-500/20 bg-[color:color-mix(in_srgb,#f59e0b_6%,transparent)] px-4 py-4 sm:px-5"
      data-testid="admin-runtime-env-legacy"
    >
      <h3 className="text-sm font-semibold text-[var(--gc-text)]">{t("legacyEnvTitle")}</h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--gc-muted)]">{t("legacyEnvHint")}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="min-w-[8rem] text-[var(--gc-text-soft)]">{row.label}</span>
            <SourceBadge source={row.source} />
            <span className="font-mono text-[11px] text-[var(--gc-muted)]">{row.value || t("legacyEnvUnset")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProviderEditor({
  provider,
  ready,
  editState,
  inputCls,
  headers,
  onUpdate,
  onDuplicate,
  onRemove,
}: {
  provider: ProviderFormState;
  ready: boolean;
  editState: ProviderEditState;
  inputCls: string;
  headers: () => HeadersInit;
  onUpdate: (patch: Partial<ProviderFormState>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("adminPage.runtimeConfig");
  const [open, setOpen] = useState(() => editState === "draft" || editState === "modified");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const protocolLabel =
    provider.protocol === "gemini"
      ? t("protocolGemini")
      : provider.protocol === "anthropic"
        ? t("protocolAnthropic")
        : t("protocolOpenAI");
  const modelCount = parseModelsText(provider.modelsText).length;
  const keyConfigured = Boolean(provider.apiKeyDraft || provider.apiKeyMasked);

  useEffect(() => {
    if (editState === "draft" || editState === "modified") setOpen(true);
  }, [editState]);

  async function testConnection() {
    const apiKey = provider.apiKeyDraft.trim();
    if (!apiKey) {
      setTestMsg(t("testEnterKey"));
      return;
    }
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/admin/runtime-config/test-provider", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerToPayload({ ...provider, apiKeyDraft: apiKey }) }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (data.ok) {
        setTestMsg(t("testProviderOk"));
      } else {
        const key = data.message ? (`testProviderErr_${data.message}` as Parameters<typeof t>[0]) : null;
        setTestMsg(key && t.has(key) ? t(key) : t("testProviderFail"));
      }
    } catch {
      setTestMsg(t("testProviderFail"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      className={`rounded-xl border bg-[var(--gc-bg-elevated)] ${
        editState === "draft"
          ? "border-sky-500/30"
          : editState === "modified"
            ? "border-amber-500/30"
            : "border-[color:var(--gc-border)]"
      }`}
      data-testid={`admin-runtime-provider-${provider.id}`}
      data-edit-state={editState}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
      >
        <StatusDot ok={editState === "live" ? ready : editState === "draft" ? "optional" : ready} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-[var(--gc-text)]">
              {provider.name.trim() || t("providerUnnamed")}
            </p>
            <EditStateBadge state={editState} />
          </div>
          <p className="truncate text-xs text-[var(--gc-text-faint)]">
            {protocolLabel}
            {provider.baseUrl ? ` · ${provider.baseUrl}` : ""}
          </p>
          {!open ? (
            <p className="mt-1 text-[11px] text-[var(--gc-muted)]">
              {t("providerSummaryLine", {
                key: keyConfigured ? t("providerKeyConfigured") : t("providerKeyMissing"),
                models: modelCount,
                enabled: provider.enabled ? t("providerEnabledShort") : t("providerDisabledShort"),
              })}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-[var(--gc-muted)]" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="space-y-5 border-t border-[color:var(--gc-border)] px-4 pb-4 pt-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gc-text-faint)]">
              {t("sectionApiConnection")}
            </p>
            <p className="mt-1 text-xs text-[var(--gc-muted)]">{t("sectionApiConnectionHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label={t("fieldProviderName")}>
              <input
                className={inputCls}
                value={provider.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder={t("fieldProviderNamePlaceholder")}
              />
            </FieldRow>
            <FieldRow label={t("fieldProtocol")}>
              <select
                className={inputCls}
                value={provider.protocol}
                onChange={(e) => onUpdate({ protocol: e.target.value as LlmProtocol })}
              >
                {PROTOCOL_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {t(p === "openai_compatible" ? "protocolOpenAI" : p === "gemini" ? "protocolGemini" : "protocolAnthropic")}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label={t("fieldBaseUrl")} source={provider.apiKeySource}>
              <input
                className={inputCls}
                value={provider.baseUrl}
                onChange={(e) => onUpdate({ baseUrl: e.target.value })}
                placeholder={
                  provider.protocol === "gemini"
                    ? "https://generativelanguage.googleapis.com"
                    : provider.protocol === "anthropic"
                      ? "https://api.anthropic.com"
                      : "https://api.openai.com/v1"
                }
                disabled={provider.protocol === "anthropic"}
              />
            </FieldRow>
            <FieldRow label={t("fieldApiKey")} hint={t("keyRotateHint")} source={provider.apiKeySource}>
              <input
                type="password"
                className={inputCls}
                placeholder={provider.apiKeyMasked ?? t("keyEmptyPlaceholder")}
                value={provider.apiKeyDraft}
                onChange={(e) => onUpdate({ apiKeyDraft: e.target.value })}
                autoComplete="off"
              />
            </FieldRow>
            {provider.protocol === "openai_compatible" ? (
              <FieldRow label={t("openaiUserAgent")}>
                <input
                  className={inputCls}
                  value={provider.userAgent}
                  onChange={(e) => onUpdate({ userAgent: e.target.value })}
                />
              </FieldRow>
            ) : null}
          </div>
          <div className="rounded-lg border border-dashed border-[color:var(--gc-border)] px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gc-text-faint)]">
              {t("sectionModelCatalog")}
            </p>
            <p className="mt-1 text-xs text-[var(--gc-muted)]">{t("sectionModelCatalogHint")}</p>
            <div className="mt-3">
              <FieldRow label={t("fieldModelList")} hint={t("fieldModelListHint")}>
                <textarea
                  className={`${inputCls} min-h-[72px] font-mono text-[13px]`}
                  value={provider.modelsText}
                  onChange={(e) => onUpdate({ modelsText: e.target.value })}
                  placeholder="gpt-4o, deepseek-chat"
                />
              </FieldRow>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--gc-muted)]">
              <input
                type="checkbox"
                checked={provider.enabled}
                onChange={(e) => onUpdate({ enabled: e.target.checked })}
              />
              {t("fieldProviderEnabled")}
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={testing}
                onClick={() => void testConnection()}
                className="text-sm text-[var(--gc-accent)] hover:underline disabled:opacity-50"
              >
                {testing ? t("testProviderBusy") : t("testProvider")}
              </button>
              <button type="button" onClick={onDuplicate} className="text-sm text-[var(--gc-muted)] hover:text-[var(--gc-text)]">
                {t("duplicateProvider")}
              </button>
              <button type="button" onClick={onRemove} className="text-sm text-red-300 hover:text-red-200">
                {t("removeProvider")}
              </button>
            </div>
          </div>
          {testMsg ? <p className="text-xs text-[var(--gc-muted)]">{testMsg}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function RouteRow({
  domain,
  domainColor,
  scene,
  sceneDesc,
  providerId,
  providerOptions,
  onProviderId,
  primary,
  fallback,
  onPrimary,
  onFallback,
  modelSuggestions = [],
  fallbackOptional,
  pending = false,
  livePrimary,
  liveFallback,
}: {
  domain: string;
  domainColor: string;
  scene: string;
  sceneDesc?: string;
  providerId: string;
  providerOptions: { id: string; name: string }[];
  onProviderId: (id: string) => void;
  primary: string;
  fallback?: string;
  onPrimary: (v: string) => void;
  onFallback?: (v: string) => void;
  modelSuggestions?: string[];
  fallbackOptional?: boolean;
  pending?: boolean;
  livePrimary?: string;
  liveFallback?: string;
}) {
  const t = useTranslations("adminPage.runtimeConfig");
  const inputCls =
    "w-full rounded-lg border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_92%,transparent)] px-3 py-2 font-mono text-[12px] text-[var(--gc-text)] outline-none focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))]";
  const selectCls = `${inputCls} appearance-none`;
  const listId = `route-models-${scene.replace(/\s+/g, "-")}`;
  return (
    <tr className="border-b border-white/6 last:border-0">
      <td className="py-4 pr-4 align-top">
        <span
          className="inline-flex rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            color: domainColor,
            background: `color-mix(in srgb, ${domainColor} 14%, transparent)`,
          }}
        >
          {domain}
        </span>
      </td>
      <td className="py-4 pr-4 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-[var(--gc-text)]">{scene}</p>
          {pending ? <EditStateBadge state="routePending" /> : null}
        </div>
        {sceneDesc ? <p className="mt-1 text-xs text-[var(--gc-text-faint)]">{sceneDesc}</p> : null}
      </td>
      <td className="py-4 pr-4 align-top">
        <select className={selectCls} value={providerId} onChange={(e) => onProviderId(e.target.value)}>
          {providerOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-4 pr-4 align-top">
        <div className="space-y-1">
          <span className="text-[10px] text-[var(--gc-text-faint)]">{t("routePrimary")}</span>
          <input className={inputCls} value={primary} onChange={(e) => onPrimary(e.target.value)} list={listId} />
          {pending && livePrimary && livePrimary !== primary ? (
            <p className="text-[10px] text-emerald-300/80">{t("routeLiveValue", { value: livePrimary })}</p>
          ) : null}
        </div>
      </td>
      <td className="py-4 align-top">
        {onFallback ? (
          <div className="space-y-1">
            <span className="text-[10px] text-[var(--gc-text-faint)]">
              {fallbackOptional ? t("routeFallbackOptional") : t("routeFallback")}
            </span>
            <input className={inputCls} value={fallback ?? ""} onChange={(e) => onFallback(e.target.value)} list={listId} />
            {pending && liveFallback !== undefined && liveFallback !== (fallback ?? "") ? (
              <p className="text-[10px] text-emerald-300/80">{t("routeLiveValue", { value: liveFallback || "—" })}</p>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-[var(--gc-text-faint)]">—</span>
        )}
        {modelSuggestions.length > 0 ? (
          <datalist id={listId}>
            {modelSuggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        ) : null}
      </td>
    </tr>
  );
}

function FieldRow({
  label,
  hint,
  source,
  children,
}: {
  label: string;
  hint?: string;
  source?: "env" | "db" | "none" | "product";
  children: ReactNode;
}) {
  return (
    <label className="group block space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--gc-text)]">{label}</span>
        {source ? <SourceBadge source={source} /> : null}
      </div>
      {hint ? <p className="text-xs leading-relaxed text-[var(--gc-text-faint)]">{hint}</p> : null}
      {children}
    </label>
  );
}

export function RuntimeConfigPanel({ headers, onNotice }: Props) {
  const t = useTranslations("adminPage.runtimeConfig");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<PanelSection>("providers");
  const [view, setView] = useState<RuntimeConfigView | null>(null);

  const [providersForm, setProvidersForm] = useState<ProviderFormState[]>([]);
  const [routesForm, setRoutesForm] = useState<RuntimeModelRoute[]>([]);
  const [savedProviders, setSavedProviders] = useState<ProviderFormState[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<RuntimeModelRoute[]>([]);
  const [newProviderTemplate, setNewProviderTemplate] = useState<ProviderTemplateId>("litellm");

  const inputCls =
    "w-full rounded-xl border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_92%,transparent)] px-4 py-3 text-sm text-[var(--gc-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)]";

  const hydrateForm = useCallback((data: RuntimeConfigView) => {
    const pf = data.providers.map(providerFromView);
    setProvidersForm(pf);
    setSavedProviders(JSON.parse(JSON.stringify(pf)) as ProviderFormState[]);
    setRoutesForm(data.routes.map((r) => ({ ...r, fallbacks: [...r.fallbacks] })));
    setSavedRoutes(JSON.parse(JSON.stringify(data.routes)) as RuntimeModelRoute[]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/runtime-config", { headers: headers() });
      if (!res.ok) throw new Error("forbidden");
      const data = (await res.json()) as RuntimeConfigView;
      setView(data);
      hydrateForm(data);
    } catch {
      onNotice({ kind: "error", text: t("loadFailed") });
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [headers, hydrateForm, onNotice, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const providerOptions = useMemo(
    () => providersForm.filter((p) => p.enabled).map((p) => ({ id: p.id, name: p.name.trim() || p.id })),
    [providersForm],
  );

  const providerStatus = useMemo(() => {
    const ready = providersForm.filter((p) => p.enabled && (p.apiKeyDraft || p.apiKeyMasked)).length;
    return { total: providersForm.length, ready };
  }, [providersForm]);

  const dirty = useMemo(() => {
    return JSON.stringify(providersForm) !== JSON.stringify(savedProviders)
      || JSON.stringify(routesForm) !== JSON.stringify(savedRoutes);
  }, [providersForm, routesForm, savedProviders, savedRoutes]);

  const savedProviderIds = useMemo(() => new Set(savedProviders.map((p) => p.id)), [savedProviders]);

  const draftProviders = useMemo(
    () => providersForm.filter((p) => !savedProviderIds.has(p.id)),
    [providersForm, savedProviderIds],
  );

  const savedProviderForms = useMemo(
    () => providersForm.filter((p) => savedProviderIds.has(p.id)),
    [providersForm, savedProviderIds],
  );

  function updateProvider(id: string, patch: Partial<ProviderFormState>) {
    setProvidersForm((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removeProvider(id: string) {
    setProvidersForm((prev) => prev.filter((p) => p.id !== id));
    setRoutesForm((prev) =>
      prev.map((r) => {
        if (r.providerId !== id) return r;
        const fallback = providersForm.find((p) => p.id !== id && p.enabled)?.id ?? "";
        return { ...r, providerId: fallback };
      }),
    );
  }

  function addProvider() {
    const draft = createProviderFromTemplate(newProviderTemplate);
    setProvidersForm((prev) => [
      ...prev,
      { ...providerFromView(publicProviderFromDraft(draft)), templateId: newProviderTemplate },
    ]);
  }

  function publicProviderFromDraft(p: RuntimeLlmProvider): RuntimeProviderPublic {
    return {
      id: p.id,
      name: p.name,
      protocol: p.protocol,
      baseUrl: p.baseUrl,
      apiKey: null,
      apiKeySource: "none",
      userAgent: p.userAgent ?? null,
      models: p.models,
      enabled: p.enabled,
    };
  }

  function duplicateProvider(id: string) {
    const src = providersForm.find((p) => p.id === id);
    if (!src) return;
    const copy = createProviderFromTemplate("custom");
    setProvidersForm((prev) => [
      ...prev,
      {
        ...src,
        id: copy.id,
        name: `${src.name.trim() || t("providerUnnamed")} (${t("providerCopySuffix")})`,
        apiKeyDraft: "",
        apiKeyMasked: src.apiKeyMasked,
      },
    ]);
  }

  function updateRoute(scene: RuntimeSceneKey, patch: Partial<RuntimeModelRoute>) {
    setRoutesForm((prev) => prev.map((r) => (r.scene === scene ? { ...r, ...patch } : r)));
  }

  function routeByScene(scene: RuntimeSceneKey): RuntimeModelRoute | undefined {
    return routesForm.find((r) => r.scene === scene);
  }

  function discardChanges() {
    setProvidersForm(JSON.parse(JSON.stringify(savedProviders)) as ProviderFormState[]);
    setRoutesForm(JSON.parse(JSON.stringify(savedRoutes)) as RuntimeModelRoute[]);
    onNotice({ kind: "ok", text: t("discardDone") });
  }

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/runtime-config", {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        onNotice({ kind: "error", text: t("saveFailed") });
        return null;
      }
      const data = (await res.json()) as RuntimeConfigView;
      setView(data);
      hydrateForm(data);
      return data;
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!view) return;
    if (!providersForm.length) {
      onNotice({ kind: "error", text: t("providerNeedOne") });
      return;
    }
    const data = await patch({
      providers: providersForm.map(providerToPayload),
      routes: routesForm,
    });
    if (data) onNotice({ kind: "ok", text: t("saveDone") });
  }

  async function seedProductDefaults() {
    if (!view) return;
    const d = view.productDefaults;
    const data = await patch({
      routes: RUNTIME_SCENE_CATALOG.map((meta) => {
        const existing = routesForm.find((r) => r.scene === meta.scene);
        const providerId =
          existing?.providerId
          ?? providersForm.find((p) => p.protocol === meta.defaultProtocol && p.enabled)?.id
          ?? providersForm[0]?.id
          ?? "";
        if (meta.scene === "game") {
          return { scene: meta.scene, providerId, primary: d.gamePrimary, fallbacks: [...d.gameFallbacks] };
        }
        if (meta.scene === "novel" || meta.scene === "novel_plan" || meta.scene === "comic_storyboard") {
          return {
            scene: meta.scene,
            providerId,
            primary: d.novelTextPrimary,
            fallbacks: [d.novelTextFallback],
          };
        }
        if (meta.scene === "comic_image_openai") {
          return { scene: meta.scene, providerId, primary: d.imageOpenAI, fallbacks: [] };
        }
        return { scene: meta.scene, providerId, primary: d.imageGemini, fallbacks: [] };
      }),
    });
    if (data) onNotice({ kind: "ok", text: t("seedDone") });
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-[color:color-mix(in_srgb,var(--gc-accent)_25%,transparent)]" />
          <p className="text-sm text-[var(--gc-muted)]">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 px-8 py-12 text-center text-sm text-red-200">
        {t("loadFailed")}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28" data-testid="admin-runtime-config">
      <div className="flex flex-wrap items-start justify-between gap-4" data-testid="admin-runtime-hero">
        <div>
          <h2 className="text-xl font-semibold text-[var(--gc-text)]">{t("title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--gc-muted)]">{t("desc")}</p>
          {view.updatedAt ? (
            <p className="mt-2 text-xs text-[var(--gc-text-faint)]">
              {t("lastUpdated", { at: new Date(view.updatedAt).toLocaleString() })}
            </p>
          ) : null}
        </div>
        <p className="text-xs text-[var(--gc-text-faint)]">
          {t("providerStatusCount", { ready: providerStatus.ready, total: providerStatus.total })}
        </p>
      </div>

      <LiveRuntimeSummary routes={savedRoutes} providers={savedProviders} />

      <EnvLegacySecretsPanel view={view} />

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "providers" as const, label: t("tabProviders") },
            { id: "routing" as const, label: t("tabRouting") },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            data-testid={`admin-runtime-section-${tab.id}`}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
              section === tab.id
                ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_20%,transparent)] text-[var(--gc-text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gc-accent)_40%,transparent)]"
                : "border border-[color:var(--gc-border)] text-[var(--gc-muted)] hover:text-[var(--gc-text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {section === "providers" ? (
        <div className="space-y-6">
          {draftProviders.length > 0 ? (
            <section className="space-y-3" data-testid="admin-runtime-draft-providers">
              <div>
                <h3 className="text-base font-semibold text-[var(--gc-text)]">{t("sectionDraftProviders")}</h3>
                <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("sectionDraftProvidersHint")}</p>
              </div>
              <div className="space-y-3">
                {draftProviders.map((provider) => {
                  const ready = Boolean(provider.apiKeyDraft || provider.apiKeyMasked);
                  return (
                    <ProviderEditor
                      key={provider.id}
                      provider={provider}
                      ready={ready}
                      editState="draft"
                      inputCls={inputCls}
                      headers={headers}
                      onUpdate={(patch) => updateProvider(provider.id, patch)}
                      onDuplicate={() => duplicateProvider(provider.id)}
                      onRemove={() => removeProvider(provider.id)}
                    />
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="space-y-3 rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] p-4 sm:p-5" data-testid="admin-runtime-add-provider-zone">
            <div>
              <h3 className="text-base font-semibold text-[var(--gc-text)]">{t("addProviderTemplate")}</h3>
              <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("sectionDraftProvidersHint")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RuntimeProviderTemplateSelect
                value={newProviderTemplate}
                onChange={setNewProviderTemplate}
                inputCls={inputCls}
              />
              <button
                type="button"
                onClick={addProvider}
                data-testid="admin-runtime-add-provider"
                className="rounded-lg border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-text)] hover:bg-white/5"
              >
                {t("addProvider")}
              </button>
            </div>
            <RuntimeProviderTemplateMeta templateId={newProviderTemplate} />
            <RuntimeProviderTemplateHint templateId={newProviderTemplate} />
          </section>

          <section className="space-y-3" data-testid="admin-runtime-saved-providers">
            <div>
              <h3 className="text-base font-semibold text-[var(--gc-text)]">{t("sectionSavedProviders")}</h3>
              <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("sectionSavedProvidersHint")}</p>
            </div>
            {savedProviderForms.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[color:var(--gc-border)] px-4 py-6 text-sm text-[var(--gc-muted)]">
                {t("savedProvidersEmpty")}
              </p>
            ) : (
              <div className="space-y-3">
                {savedProviderForms.map((provider) => {
                  const ready = Boolean(provider.apiKeyDraft || provider.apiKeyMasked);
                  const editState = providerEditState(provider.id, savedProviders, providersForm);
                  return (
                    <ProviderEditor
                      key={provider.id}
                      provider={provider}
                      ready={ready}
                      editState={editState}
                      inputCls={inputCls}
                      headers={headers}
                      onUpdate={(patch) => updateProvider(provider.id, patch)}
                      onDuplicate={() => duplicateProvider(provider.id)}
                      onRemove={() => removeProvider(provider.id)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]" data-testid="admin-runtime-routing-editor">
          <div className="border-b border-white/8 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[var(--gc-text)]">{t("sectionRoutingEdit")}</h3>
              {dirty ? <EditStateBadge state="routePending" /> : <EditStateBadge state="live" />}
            </div>
            <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("routingEditHint")}</p>
          </div>
          <div className="overflow-x-auto px-4 pb-2 sm:px-6">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-white/8 text-[11px] uppercase tracking-wide text-[var(--gc-text-faint)]">
                  <th className="py-3 pr-4 font-medium">{t("routeColDomain")}</th>
                  <th className="py-3 pr-4 font-medium">{t("routeColScene")}</th>
                  <th className="py-3 pr-4 font-medium">{t("routeColProvider")}</th>
                  <th className="py-3 pr-4 font-medium">{t("routeColPrimary")}</th>
                  <th className="py-3 font-medium">{t("routeColFallback")}</th>
                </tr>
              </thead>
              <tbody>
                {RUNTIME_SCENE_CATALOG.map((meta) => {
                  const route = routeByScene(meta.scene);
                  const savedRoute = savedRoutes.find((r) => r.scene === meta.scene);
                  const pending = routeIsPending(savedRoute, route);
                  const domain =
                    meta.domain === "game" ? DOMAIN.game : meta.domain === "novel" ? DOMAIN.novel : DOMAIN.comic;
                  const showFallback =
                    meta.scene === "game" || meta.scene === "novel" || meta.scene === "novel_plan" || meta.scene === "comic_storyboard";
                  const provider = providersForm.find((p) => p.id === route?.providerId);
                  const suggestions = provider ? parseModelsText(provider.modelsText) : [];
                  return (
                    <RouteRow
                      key={meta.scene}
                      domain={t(domain.labelKey)}
                      domainColor={domain.color}
                      scene={t(meta.labelKey)}
                      sceneDesc={t(meta.descKey)}
                      providerId={route?.providerId ?? ""}
                      providerOptions={providerOptions}
                      onProviderId={(id) => updateRoute(meta.scene, { providerId: id })}
                      primary={route?.primary ?? ""}
                      fallback={(route?.fallbacks ?? []).join(", ")}
                      onPrimary={(v) => updateRoute(meta.scene, { primary: v })}
                      onFallback={
                        showFallback
                          ? (v) =>
                              updateRoute(meta.scene, {
                                fallbacks: v.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean),
                              })
                          : undefined
                      }
                      modelSuggestions={suggestions}
                      fallbackOptional={!showFallback}
                      pending={pending}
                      livePrimary={savedRoute?.primary}
                      liveFallback={(savedRoute?.fallbacks ?? []).join(", ")}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg)_82%,transparent)] px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-[var(--gc-muted)]">
            {dirty ? (
              <span className="text-amber-200">{t("unsavedChanges")}</span>
            ) : (
              <span>{t("allSaved")}</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={discardChanges}
              data-testid="admin-runtime-discard"
              className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-muted)] transition hover:text-[var(--gc-text)] disabled:opacity-45"
            >
              {t("discardChanges")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void load()}
              className="rounded-xl border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-muted)] transition hover:text-[var(--gc-text)] disabled:opacity-50"
            >
              {t("reload")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void seedProductDefaults()}
              data-testid="admin-runtime-seed-defaults"
              className="rounded-xl border border-[color:color-mix(in_srgb,var(--gc-accent)_30%,var(--gc-border))] px-4 py-2.5 text-sm text-[var(--gc-text)] transition hover:bg-white/5 disabled:opacity-50"
            >
              {t("seedDefaults")}
            </button>
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={() => void save()}
              data-testid="admin-runtime-save"
              className="rounded-xl bg-[color:color-mix(in_srgb,var(--gc-accent)_28%,transparent)] px-6 py-2.5 text-sm font-semibold text-[var(--gc-text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gc-accent)_45%,transparent),0_8px_32px_color-mix(in_srgb,var(--gc-accent)_15%,transparent)] transition hover:brightness-110 disabled:opacity-45"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
