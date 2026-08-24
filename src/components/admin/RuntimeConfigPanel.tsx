"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CHART_COLORS } from "@/components/admin/AdminCharts";
import type {
  LlmProtocol,
  RuntimeLlmProvider,
  RuntimeLocaleModelRoute,
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
import type { ProviderPricingRule } from "@/lib/runtime-config";

export type RuntimeConfigView = {
  updatedAt: string | null;
  secrets: {
    openaiApiKey: string | null;
    openaiBaseUrl: string | null;
    openaiUserAgent: string | null;
    geminiApiKey: string | null;
    geminiBaseUrl: string | null;
    anthropicApiKey: string | null;
    replicateApiKey: string | null;
  };
  sources: Record<string, "env" | "db" | "none">;
  models: {
    gameTextPrimary: string;
    gameTextFallbacks: string[];
    gameVisionPrimary: string;
    gameVisionFallbacks: string[];
    gamePrimary: string;
    gameFallbacks: string[];
    novelTextPrimary: string;
    novelTextFallback: string;
    imageOpenAI: string;
    imageGemini: string;
  };
  modelSources: Record<string, "product" | "db">;
  productDefaults: {
    gameTextPrimary?: string;
    gameTextFallbacks?: string[];
    gameVisionPrimary?: string;
    gameVisionFallbacks?: string[];
    gamePrimary: string;
    gameFallbacks: string[];
    novelTextPrimary: string;
    novelTextFallback: string;
    imageOpenAI: string;
    imageGemini: string;
  };
  providers: RuntimeProviderPublic[];
  routes: RuntimeModelRoute[];
  localeRoutes: RuntimeLocaleModelRoute[];
  providerPricing: ProviderPricingRule[];
  dailyBudgetMicros: number | null;
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

type PanelSection = "providers" | "routing" | "pricing";

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

function BgmServicePanel({
  view,
  headers,
  onNotice,
  onView,
}: {
  view: RuntimeConfigView;
  headers: () => HeadersInit;
  onNotice: (n: { kind: "ok" | "error"; text: string }) => void;
  onView: (v: RuntimeConfigView) => void;
}) {
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const source = view.sources.replicateApiKey ?? "none";
  const masked = view.secrets.replicateApiKey;

  async function saveKey() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/runtime-config", {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ secrets: { replicateApiKey: keyInput.trim() || null } }),
      });
      if (!res.ok) { onNotice({ kind: "error", text: "保存失败" }); return; }
      const data = (await res.json()) as RuntimeConfigView;
      onView(data);
      setKeyInput("");
      onNotice({ kind: "ok", text: "Replicate API Key 已保存" });
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/runtime-config", {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ secrets: { replicateApiKey: null } }),
      });
      if (!res.ok) { onNotice({ kind: "error", text: "清除失败" }); return; }
      const data = (await res.json()) as RuntimeConfigView;
      onView(data);
      onNotice({ kind: "ok", text: "Replicate API Key 已清除" });
    } finally {
      setSaving(false);
    }
  }

  const bgmMode = source !== "none" ? "replicate" : "llm-fallback";

  return (
    <section
      className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-4 sm:px-5"
      data-testid="admin-bgm-service-panel"
    >
      <h3 className="text-base font-semibold text-[var(--gc-text)]">BGM 生成服务</h3>
      <p className="mt-1 text-xs leading-relaxed text-[var(--gc-muted)]">
        配置第三方音乐生成 API。有 Replicate Key 时自动使用 MusicGen 生成每款游戏专属 BGM；无 Key 时降级为 LLM 音符序列生成。
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[var(--gc-text-soft)]">当前模式</span>
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            bgmMode === "replicate"
              ? "bg-green-500/15 text-green-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {bgmMode === "replicate" ? "Replicate MusicGen" : "LLM 降级模式"}
        </span>
        <SourceBadge source={source} />
        {masked && (
          <span className="font-mono text-[11px] text-[var(--gc-muted)]">{masked}</span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="password"
          placeholder="r8_xxxx… (留空清除)"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          className="h-8 flex-1 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-surface)] px-3 text-xs text-[var(--gc-text)] placeholder:text-[var(--gc-text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--gc-accent)]"
        />
        <button
          type="button"
          disabled={saving}
          onClick={saveKey}
          className="h-8 rounded-lg bg-[var(--gc-accent)] px-3 text-xs font-medium text-white disabled:opacity-50"
        >
          保存
        </button>
        {source === "db" && (
          <button
            type="button"
            disabled={saving}
            onClick={clearKey}
            className="h-8 rounded-lg border border-[color:var(--gc-border)] px-3 text-xs font-medium text-[var(--gc-text-soft)] disabled:opacity-50"
          >
            清除
          </button>
        )}
      </div>
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
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [modelDiscoveryMsg, setModelDiscoveryMsg] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const protocolLabel =
    provider.protocol === "gemini"
      ? t("protocolGemini")
      : provider.protocol === "anthropic"
        ? t("protocolAnthropic")
        : t("protocolOpenAI");
  const modelCount = parseModelsText(provider.modelsText).length;
  const keyConfigured = Boolean(provider.apiKeyDraft || provider.apiKeyMasked);
  const configuredModels = new Set(parseModelsText(provider.modelsText));

  async function testConnection() {
    const apiKey = provider.apiKeyDraft.trim();
    const useSavedProvider = editState === "live" && Boolean(provider.apiKeyMasked);
    if (!useSavedProvider && !apiKey) {
      setTestMsg(t("testEnterKey"));
      return;
    }
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/admin/runtime-config/test-provider", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(
          useSavedProvider
            ? { providerId: provider.id }
            : { provider: providerToPayload({ ...provider, apiKeyDraft: apiKey }) },
        ),
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

  async function discoverModels() {
    const apiKey = provider.apiKeyDraft.trim();
    const useSavedProvider = editState === "live" && Boolean(provider.apiKeyMasked);
    if (!useSavedProvider && !apiKey) {
      setModelDiscoveryMsg(t("discoverModelsEnterKey"));
      return;
    }
    setDiscoveringModels(true);
    setModelDiscoveryMsg(null);
    try {
      const res = await fetch("/api/admin/runtime-config/discover-models", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(
          useSavedProvider
            ? { providerId: provider.id }
            : { provider: providerToPayload({ ...provider, apiKeyDraft: apiKey }) },
        ),
      });
      const data = (await res.json()) as { ok?: boolean; models?: string[]; message?: string };
      if (data.ok && Array.isArray(data.models)) {
        setDiscoveredModels(data.models);
        setModelDiscoveryMsg(t("discoverModelsOk", { count: data.models.length }));
      } else {
        const key = data.message ? (`discoverModelsErr_${data.message}` as Parameters<typeof t>[0]) : null;
        setModelDiscoveryMsg(key && t.has(key) ? t(key) : t("discoverModelsFail"));
      }
    } catch {
      setModelDiscoveryMsg(t("discoverModelsFail"));
    } finally {
      setDiscoveringModels(false);
    }
  }

  function setDiscoveredModelSelected(model: string, selected: boolean) {
    const models = parseModelsText(provider.modelsText);
    const next = selected ? [...models, model] : models.filter((item) => item !== model);
    onUpdate({ modelsText: Array.from(new Set(next)).join(", ") });
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
            <div className="mt-3 space-y-3">
              <FieldRow label={t("fieldModelList")} hint={t("fieldModelListHint")}>
                <textarea
                  className={`${inputCls} min-h-[72px] font-mono text-[13px]`}
                  value={provider.modelsText}
                  onChange={(e) => onUpdate({ modelsText: e.target.value })}
                  placeholder="gpt-4o, deepseek-chat"
                />
              </FieldRow>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={discoveringModels || provider.protocol !== "openai_compatible"}
                  onClick={() => void discoverModels()}
                  data-testid={`admin-runtime-provider-${provider.id}-discover-models`}
                  className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs font-medium text-[var(--gc-text)] hover:border-[color:var(--gc-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {discoveringModels ? t("discoverModelsBusy") : t("discoverModels")}
                </button>
                <span className="text-xs text-[var(--gc-muted)]">
                  {provider.protocol === "openai_compatible" ? t("discoverModelsHint") : t("discoverModelsProtocolHint")}
                </span>
              </div>
              {modelDiscoveryMsg ? <p className="text-xs text-[var(--gc-muted)]">{modelDiscoveryMsg}</p> : null}
              {discoveredModels.length > 0 ? (
                <div className="max-h-56 overflow-y-auto rounded-lg border border-[color:var(--gc-border)] bg-black/10 p-2">
                  <p className="px-1 pb-2 text-xs text-[var(--gc-muted)]">{t("discoverModelsSelectHint")}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {discoveredModels.map((model) => (
                      <label key={model} className="flex min-w-0 items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-white/5">
                        <input
                          type="checkbox"
                          checked={configuredModels.has(model)}
                          onChange={(event) => setDiscoveredModelSelected(model, event.target.checked)}
                        />
                        <span className="truncate font-mono text-[var(--gc-text)]" title={model}>{model}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
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
                data-testid={`admin-runtime-provider-${provider.id}-test`}
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

function RouteModelPicker({
  sceneKey,
  field,
  label,
  value,
  onChange,
  modelSuggestions,
}: {
  sceneKey: RuntimeSceneKey;
  field: "primary" | "fallback";
  label: string;
  value: string;
  onChange: (value: string) => void;
  modelSuggestions: string[];
}) {
  const t = useTranslations("adminPage.runtimeConfig");
  const inputCls =
    "w-full rounded-lg border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_92%,transparent)] px-3 py-2 font-mono text-[12px] text-[var(--gc-text)] outline-none focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))]";

  return (
    <div className="space-y-1.5">
      <span className="text-[10px] text-[var(--gc-text-faint)]">{label}</span>
      {modelSuggestions.length > 0 ? (
        <select
          aria-label={t("routeCatalogSelectAria", { label })}
          className={inputCls}
          data-testid={`admin-runtime-route-${sceneKey}-${field}-catalog`}
          value=""
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="" disabled>
            {t("routeCatalogPlaceholder")}
          </option>
          {modelSuggestions.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-[10px] leading-relaxed text-amber-200/80">{t("routeCatalogEmpty")}</p>
      )}
      <input
        aria-label={t("routeModelInputAria", { label })}
        className={inputCls}
        data-testid={`admin-runtime-route-${sceneKey}-${field}-model`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-[10px] leading-relaxed text-[var(--gc-text-faint)]">{t("routeModelPickerHint")}</p>
    </div>
  );
}

function RouteRow({
  sceneKey,
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
  sceneKey: RuntimeSceneKey;
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
  const selectCls =
    "w-full appearance-none rounded-lg border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_92%,transparent)] px-3 py-2 font-mono text-[12px] text-[var(--gc-text)] outline-none focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))]";
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
        <RouteModelPicker
          sceneKey={sceneKey}
          field="primary"
          label={t("routePrimary")}
          value={primary}
          onChange={onPrimary}
          modelSuggestions={modelSuggestions}
        />
        {pending && livePrimary && livePrimary !== primary ? (
          <p className="mt-1 text-[10px] text-emerald-300/80">{t("routeLiveValue", { value: livePrimary })}</p>
        ) : null}
      </td>
      <td className="py-4 align-top">
        {onFallback ? (
          <>
            <RouteModelPicker
              sceneKey={sceneKey}
              field="fallback"
              label={fallbackOptional ? t("routeFallbackOptional") : t("routeFallback")}
              value={fallback ?? ""}
              onChange={onFallback}
              modelSuggestions={modelSuggestions}
            />
            {pending && liveFallback !== undefined && liveFallback !== (fallback ?? "") ? (
              <p className="mt-1 text-[10px] text-emerald-300/80">{t("routeLiveValue", { value: liveFallback || "—" })}</p>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-[var(--gc-text-faint)]">—</span>
        )}
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

function ProviderPricingEditor({
  rules,
  dailyBudgetMicros,
  inputCls,
  onChange,
  onDailyBudgetMicrosChange,
}: {
  rules: ProviderPricingRule[];
  dailyBudgetMicros: string;
  inputCls: string;
  onChange: (rules: ProviderPricingRule[]) => void;
  onDailyBudgetMicrosChange: (value: string) => void;
}) {
  const t = useTranslations("adminPage.runtimeConfig");
  const update = (index: number, patch: Partial<ProviderPricingRule>) => {
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };
  return (
    <section className="overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]" data-testid="admin-runtime-pricing-editor">
      <div className="border-b border-white/8 px-4 py-4 sm:px-5">
        <h3 className="text-base font-semibold text-[var(--gc-text)]">{t("pricingTitle")}</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--gc-muted)]">{t("pricingHint")}</p>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="rounded-lg border border-white/8 p-3">
          <label className="block text-sm font-medium text-[var(--gc-text)]" htmlFor="runtime-daily-budget">当日模型预算阈值（微单位）</label>
          <p className="mt-1 text-xs leading-relaxed text-[var(--gc-muted)]">按实际用量账本的 estimatedCostMicros 汇总。留空即不启用；没有匹配成本规则的调用不会被虚构计费。</p>
          <input id="runtime-daily-budget" className={`mt-3 max-w-sm ${inputCls}`} type="number" min="1" step="1" value={dailyBudgetMicros} onChange={(event) => onDailyBudgetMicrosChange(event.target.value)} placeholder="例如 1000000" />
        </div>
        {rules.length === 0 ? <p className="text-sm text-[var(--gc-muted)]">{t("pricingEmpty")}</p> : null}
        {rules.map((rule, index) => (
          <div key={`${index}-${rule.provider}-${rule.model}`} className="grid gap-3 rounded-lg border border-white/8 p-3 md:grid-cols-[1fr_1fr_130px_130px_150px_auto]">
            <input className={inputCls} value={rule.provider} onChange={(e) => update(index, { provider: e.target.value })} placeholder={t("pricingProviderPlaceholder")} aria-label={t("pricingProvider")} />
            <input className={inputCls} value={rule.model} onChange={(e) => update(index, { model: e.target.value })} placeholder={t("pricingModelPlaceholder")} aria-label={t("pricingModel")} />
            <select className={inputCls} value={rule.modality} onChange={(e) => update(index, { modality: e.target.value as ProviderPricingRule["modality"] })} aria-label={t("pricingModality")}>
              <option value="llm">LLM</option><option value="image">Image</option>
            </select>
            <select className={inputCls} value={rule.operation} onChange={(e) => update(index, { operation: e.target.value as ProviderPricingRule["operation"] })} aria-label={t("pricingOperation")}>
              <option value="text">text</option><option value="json">json</option><option value="image">image</option><option value="image_batch">image_batch</option>
            </select>
            <input className={inputCls} type="number" min="0" step="1" value={rule.estimatedCostMicros} onChange={(e) => update(index, { estimatedCostMicros: Number(e.target.value) })} aria-label={t("pricingMicros")} />
            <button type="button" className="text-sm text-red-300 hover:text-red-200" onClick={() => onChange(rules.filter((_, i) => i !== index))}>{t("removeProvider")}</button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...rules, { provider: "*", model: "*", modality: "llm", operation: "text", estimatedCostMicros: 0 }])}
          className="rounded-lg border border-[color:var(--gc-border)] px-4 py-2.5 text-sm text-[var(--gc-text)] hover:bg-white/5"
        >
          {t("pricingAdd")}
        </button>
      </div>
    </section>
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
  const [localeRoutesForm, setLocaleRoutesForm] = useState<RuntimeLocaleModelRoute[]>([]);
  const [savedProviders, setSavedProviders] = useState<ProviderFormState[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<RuntimeModelRoute[]>([]);
  const [savedLocaleRoutes, setSavedLocaleRoutes] = useState<RuntimeLocaleModelRoute[]>([]);
  const [pricingForm, setPricingForm] = useState<ProviderPricingRule[]>([]);
  const [savedPricing, setSavedPricing] = useState<ProviderPricingRule[]>([]);
  const [dailyBudgetMicrosForm, setDailyBudgetMicrosForm] = useState("");
  const [savedDailyBudgetMicros, setSavedDailyBudgetMicros] = useState("");
  const [newProviderTemplate, setNewProviderTemplate] = useState<ProviderTemplateId>("litellm");

  const inputCls =
    "w-full rounded-xl border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_92%,transparent)] px-4 py-3 text-sm text-[var(--gc-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,var(--gc-border))] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)]";

  const hydrateForm = useCallback((data: RuntimeConfigView) => {
    const pf = data.providers.map(providerFromView);
    setProvidersForm(pf);
    setSavedProviders(JSON.parse(JSON.stringify(pf)) as ProviderFormState[]);
    setRoutesForm(data.routes.map((r) => ({ ...r, fallbacks: [...r.fallbacks] })));
    setSavedRoutes(JSON.parse(JSON.stringify(data.routes)) as RuntimeModelRoute[]);
    setLocaleRoutesForm(data.localeRoutes.map((r) => ({ ...r, fallbacks: [...r.fallbacks] })));
    setSavedLocaleRoutes(JSON.parse(JSON.stringify(data.localeRoutes)) as RuntimeLocaleModelRoute[]);
    setPricingForm(JSON.parse(JSON.stringify(data.providerPricing ?? [])) as ProviderPricingRule[]);
    setSavedPricing(JSON.parse(JSON.stringify(data.providerPricing ?? [])) as ProviderPricingRule[]);
    const budget = data.dailyBudgetMicros == null ? "" : String(data.dailyBudgetMicros);
    setDailyBudgetMicrosForm(budget);
    setSavedDailyBudgetMicros(budget);
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
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
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
      || JSON.stringify(routesForm) !== JSON.stringify(savedRoutes)
      || JSON.stringify(localeRoutesForm) !== JSON.stringify(savedLocaleRoutes)
      || JSON.stringify(pricingForm) !== JSON.stringify(savedPricing)
      || dailyBudgetMicrosForm !== savedDailyBudgetMicros;
  }, [dailyBudgetMicrosForm, localeRoutesForm, pricingForm, providersForm, routesForm, savedDailyBudgetMicros, savedLocaleRoutes, savedPricing, savedProviders, savedRoutes]);

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

  function localeRouteByScene(scene: RuntimeSceneKey, localeGroup: "zh" | "international") {
    return localeRoutesForm.find((route) => route.scene === scene && route.localeGroup === localeGroup);
  }

  function updateLocaleRoute(
    scene: RuntimeSceneKey,
    localeGroup: "zh" | "international",
    patch: Partial<RuntimeModelRoute>,
  ) {
    setLocaleRoutesForm((current) => {
      const existing = current.find((route) => route.scene === scene && route.localeGroup === localeGroup);
      const fallback = routesForm.find((route) => route.scene === scene);
      const next: RuntimeLocaleModelRoute = {
        scene,
        localeGroup,
        providerId: existing?.providerId ?? fallback?.providerId ?? providerOptions[0]?.id ?? "",
        primary: existing?.primary ?? fallback?.primary ?? "",
        fallbacks: existing?.fallbacks ?? fallback?.fallbacks ?? [],
        ...patch,
      };
      return existing
        ? current.map((route) => route === existing ? next : route)
        : [...current, next];
    });
  }

  function clearLocaleRoute(scene: RuntimeSceneKey, localeGroup: "zh" | "international") {
    setLocaleRoutesForm((current) => current.filter((route) => route.scene !== scene || route.localeGroup !== localeGroup));
  }

  function routeByScene(scene: RuntimeSceneKey): RuntimeModelRoute | undefined {
    return routesForm.find((r) => r.scene === scene);
  }

  function discardChanges() {
    setProvidersForm(JSON.parse(JSON.stringify(savedProviders)) as ProviderFormState[]);
    setRoutesForm(JSON.parse(JSON.stringify(savedRoutes)) as RuntimeModelRoute[]);
    setLocaleRoutesForm(JSON.parse(JSON.stringify(savedLocaleRoutes)) as RuntimeLocaleModelRoute[]);
    setPricingForm(JSON.parse(JSON.stringify(savedPricing)) as ProviderPricingRule[]);
    setDailyBudgetMicrosForm(savedDailyBudgetMicros);
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
      localeRoutes: localeRoutesForm,
      providerPricing: pricingForm,
      dailyBudgetMicros: dailyBudgetMicrosForm.trim() ? Number(dailyBudgetMicrosForm) : null,
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
        if (meta.scene === "game_text") {
          return {
            scene: meta.scene,
            providerId,
            primary: d.gameTextPrimary ?? d.gamePrimary,
            fallbacks: [...(d.gameTextFallbacks ?? d.gameFallbacks)],
          };
        }
        if (meta.scene === "game_vision") {
          return {
            scene: meta.scene,
            providerId,
            primary: d.gameVisionPrimary ?? d.gamePrimary,
            fallbacks: [...(d.gameVisionFallbacks ?? d.gameFallbacks)],
          };
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

      <BgmServicePanel
        view={view}
        headers={headers}
        onNotice={onNotice}
        onView={(v) => { setView(v); hydrateForm(v); }}
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "providers" as const, label: t("tabProviders") },
            { id: "routing" as const, label: t("tabRouting") },
            { id: "pricing" as const, label: t("tabPricing") },
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
      ) : section === "routing" ? (
        <div className="overflow-hidden rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)]" data-testid="admin-runtime-routing-editor">
          <div className="border-b border-white/8 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[var(--gc-text)]">{t("sectionRoutingEdit")}</h3>
              {dirty ? <EditStateBadge state="routePending" /> : <EditStateBadge state="live" />}
            </div>
            <p className="mt-1 text-sm text-[var(--gc-muted)]">{t("routingEditHint")}</p>
          </div>
          <section className="border-b border-white/8 bg-sky-500/5 px-4 py-5 sm:px-6" data-testid="admin-runtime-locale-routing">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-[var(--gc-text)]">语言模型策略</h4>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--gc-muted)]">
                  简体中文与繁体中文共用“中文”池；英语、马来语、泰语等使用“国际”池。未设置的场景保持使用下方全局分域模型，确保旧生产配置不受影响。
                </p>
              </div>
              <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-xs text-sky-200">
                {localeRoutesForm.length} 个语言覆盖已配置
              </span>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {(["zh", "international"] as const).map((localeGroup) => (
                <div key={localeGroup} className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h5 className="font-medium text-[var(--gc-text)]">{localeGroup === "zh" ? "中文池（简体 / 繁体）" : "国际池（非中文）"}</h5>
                      <p className="mt-1 text-xs text-[var(--gc-text-faint)]">
                        {localeGroup === "zh" ? "建议中文图像使用 doubao-seedream-5-0-pro" : "建议国际图像使用 gpt-image-2"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {RUNTIME_SCENE_CATALOG.map((meta) => {
                      const override = localeRouteByScene(meta.scene, localeGroup);
                      const inherited = routesForm.find((route) => route.scene === meta.scene);
                      const route = override ?? inherited;
                      const provider = providersForm.find((item) => item.id === route?.providerId);
                      const suggestions = provider ? parseModelsText(provider.modelsText) : [];
                      return (
                        <div key={meta.scene} className="grid gap-2 rounded-lg border border-white/6 p-2.5 md:grid-cols-[minmax(118px,0.8fr)_minmax(120px,1fr)_minmax(150px,1.2fr)_auto] md:items-center">
                          <div>
                            <p className="text-xs font-medium text-[var(--gc-text)]">{t(meta.labelKey)}</p>
                            <p className="text-[10px] text-[var(--gc-text-faint)]">{override ? "语言覆盖" : "继承全局"}</p>
                          </div>
                          <select className={inputCls} value={route?.providerId ?? ""} onChange={(e) => updateLocaleRoute(meta.scene, localeGroup, { providerId: e.target.value })}>
                            {providerOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                          </select>
                          <div className="space-y-1">
                            {suggestions.length > 0 ? (
                              <select className={inputCls} value={route?.primary ?? ""} onChange={(e) => updateLocaleRoute(meta.scene, localeGroup, { primary: e.target.value })}>
                                <option value="">选择模型</option>
                                {suggestions.map((model) => <option key={model} value={model}>{model}</option>)}
                              </select>
                            ) : null}
                            <input className={inputCls} value={route?.primary ?? ""} onChange={(e) => updateLocaleRoute(meta.scene, localeGroup, { primary: e.target.value })} placeholder="模型 ID" />
                          </div>
                          {override ? <button type="button" onClick={() => clearLocaleRoute(meta.scene, localeGroup)} className="text-xs text-[var(--gc-muted)] hover:text-red-200">恢复继承</button> : <span className="text-xs text-[var(--gc-text-faint)]">全局</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
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
                    meta.scene === "game_text"
                    || meta.scene === "game_vision"
                    || meta.scene === "novel"
                    || meta.scene === "novel_plan"
                    || meta.scene === "comic_storyboard";
                  const provider = providersForm.find((p) => p.id === route?.providerId);
                  const suggestions = provider ? parseModelsText(provider.modelsText) : [];
                  return (
                    <RouteRow
                      key={meta.scene}
                      sceneKey={meta.scene}
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
      ) : (
        <ProviderPricingEditor rules={pricingForm} dailyBudgetMicros={dailyBudgetMicrosForm} inputCls={inputCls} onChange={setPricingForm} onDailyBudgetMicrosChange={setDailyBudgetMicrosForm} />
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
