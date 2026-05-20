"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GameSpec } from "@/lib/game-spec";
import { GamePlayer } from "@/components/GamePlayer";
import { GameRuntimeTabs } from "@/components/GameRuntimeTabs";
import { readReferenceImagePayloadsFromSession } from "@/lib/assets/reference-image-payloads.client";
import { prefetchGodotExport } from "@/lib/godot-prefetch.client";
import { isGodotExportSupported } from "@/lib/godot-spec-bridge-codegen";
import { PRODUCT } from "@/lib/product-config";
import { GameRuntimePreferenceControl } from "@/components/GameRuntimePreferenceControl";
import { SpecQuickTunePanel } from "@/components/SpecQuickTunePanel";
import { SiteHeader } from "@/components/SiteHeader";

export function PlayGameClient({ id }: { id: string }) {
  const router = useRouter();
  const [spec, setSpec] = useState<GameSpec | null>(null);
  const [meta, setMeta] = useState<{
    title: string;
    prompt: string;
    isOwner: boolean;
    shareCode: string | null;
    likeCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shortCopied, setShortCopied] = useState(false);
  const [remixBusy, setRemixBusy] = useState(false);
  const [mintBusy, setMintBusy] = useState(false);
  const [patchPrompt, setPatchPrompt] = useState("");
  const [refineMode, setRefineMode] = useState<"patch" | "regenerate">("patch");
  const [refinementHistory, setRefinementHistory] = useState<Array<{ at: string; mode: string; instruction: string }>>(
    [],
  );
  const [patchBusy, setPatchBusy] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${id}`);
        const data = (await res.json()) as {
          spec?: GameSpec;
          project?: {
            title: string;
            prompt: string;
            isOwner: boolean;
            shareCode: string | null;
            likeCount?: number;
          };
          refinementHistory?: Array<{ at: string; mode: string; instruction: string }>;
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "加载失败");
          return;
        }
        if (!data.spec || !data.project) {
          if (!cancelled) setError("数据不完整");
          return;
        }
        if (!cancelled) {
          setSpec(data.spec);
          if (PRODUCT.godot.enabled && isGodotExportSupported(data.spec)) {
            prefetchGodotExport(data.spec, { projectId: id });
          }
          setMeta({
            title: data.project.title,
            prompt: data.project.prompt,
            isOwner: data.project.isOwner,
            shareCode: data.project.shareCode ?? null,
            likeCount: data.project.likeCount ?? 0,
          });
          setLikeCount(data.project.likeCount ?? 0);
          if (typeof localStorage !== "undefined") {
            setLiked(!!localStorage.getItem(`liked:${id}`));
          }
          if (Array.isArray(data.refinementHistory)) {
            setRefinementHistory(data.refinementHistory);
          } else {
            setRefinementHistory([]);
          }
        }
      } catch {
        if (!cancelled) setError("网络异常");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function copyShortUrl() {
    if (!meta?.shareCode) return;
    const url = `${window.location.origin}/s/${meta.shareCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setShortCopied(true);
      setTimeout(() => setShortCopied(false), 2000);
    } catch {
      setShortCopied(false);
    }
  }

  async function mintShareCode() {
    setMintBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensureShareCode: true }),
      });
      const data = (await res.json()) as {
        project?: { shareCode?: string | null };
        error?: string;
      };
      if (!res.ok) {
        alert(data.error ?? "生成失败");
        return;
      }
      const code = data.project?.shareCode;
      if (code) {
        setMeta((m) => (m ? { ...m, shareCode: code } : m));
      }
    } finally {
      setMintBusy(false);
    }
  }

  function handleLike() {
    if (liked) return;
    setLiked(true);
    setLikeCount((n) => n + 1);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`liked:${id}`, "1");
    }
    void fetch(`/api/projects/${id}/like`, { method: "POST" });
  }

  async function remix() {
    setRemixBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      const data = (await res.json()) as { project?: { id: string }; error?: string };
      if (!res.ok) {
        alert(data.error ?? "复制失败");
        return;
      }
      if (data.project?.id) {
        router.push(`/play/${data.project.id}`);
      }
    } finally {
      setRemixBusy(false);
    }
  }

  async function applyPatch(e: React.FormEvent) {
    e.preventDefault();
    if (!spec || !patchPrompt.trim() || patchBusy) return;
    setPatchBusy(true);
    setPatchError(null);
    try {
      if (meta?.isOwner) {
        const res = await fetch(`/api/projects/${id}/refine`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction: patchPrompt.trim(), mode: refineMode }),
        });
        const data = (await res.json()) as {
          spec?: GameSpec;
          prompt?: string;
          refinementHistory?: Array<{ at: string; mode: string; instruction: string }>;
          error?: string;
        };
        if (!res.ok || !data.spec) {
          setPatchError(data.error ?? "精炼失败");
          return;
        }
        setSpec(data.spec);
        if (typeof data.prompt === "string" && data.prompt.trim()) {
          setMeta((m) => (m ? { ...m, prompt: data.prompt! } : m));
        }
        if (Array.isArray(data.refinementHistory)) {
          setRefinementHistory(data.refinementHistory);
        }
        setPatchPrompt("");
        return;
      }

      const res = await fetch("/api/generate/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: patchPrompt.trim(), currentSpec: spec, currentPrompt: meta?.prompt ?? "" }),
      });
      const data = (await res.json()) as { spec?: GameSpec; prompt?: string; error?: string };
      if (!res.ok || !data.spec) {
        setPatchError(data.error ?? "修改失败");
        return;
      }
      setSpec(data.spec);
      if (typeof data.prompt === "string" && data.prompt.trim()) {
        setMeta((m) => (m ? { ...m, prompt: data.prompt! } : m));
      }
      setPatchPrompt("");
    } catch {
      setPatchError("网络异常，请稍后重试");
    } finally {
      setPatchBusy(false);
    }
  }

  async function saveProjectSpec() {
    if (!spec || !meta || !meta.isOwner || saveBusy) return;
    setSaveBusy(true);
    setSaveMsg(null);
    setPatchError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: meta.prompt, spec }),
      });
      const data = (await res.json()) as {
        error?: string;
        project?: { title?: string; prompt?: string };
      };
      if (!res.ok) {
        setPatchError(data.error ?? "保存失败");
        return;
      }
      setMeta((m) =>
        m
          ? {
              ...m,
              title: typeof data.project?.title === "string" ? data.project.title : m.title,
              prompt: typeof data.project?.prompt === "string" ? data.project.prompt : m.prompt,
            }
          : m,
      );
      setSaveMsg("已保存到项目版本");
      window.setTimeout(() => setSaveMsg(null), 2200);
    } catch {
      setPatchError("保存时网络异常");
    } finally {
      setSaveBusy(false);
    }
  }

  const shortUrl =
    meta?.shareCode && typeof window !== "undefined"
      ? `${window.location.origin}/s/${meta.shareCode}`
      : meta?.shareCode
        ? `/s/${meta.shareCode}`
        : null;

  return (
    <div className="flex min-h-full flex-1 flex-col text-[var(--gc-text)] lg:flex-row">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-8 px-4 py-10 lg:px-8 xl:pr-12">
        {error ? (
          <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        ) : !spec || !meta ? (
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-[var(--gc-surface-glass-strong)]" />
            <div className="h-64 animate-pulse rounded-2xl bg-[var(--gc-surface-glass)]" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--gc-text)]">{meta.title}</h1>
                <p className="text-sm leading-relaxed text-[var(--gc-muted)]">{meta.prompt}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <GameRuntimePreferenceControl />
                <button
                  type="button"
                  onClick={handleLike}
                  className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
                    liked
                      ? "border-red-400/40 bg-red-400/10 text-red-400"
                      : "border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] text-[var(--gc-text)] hover:border-red-400/40 hover:text-red-400"
                  }`}
                >
                  {liked ? "♥" : "♡"} {likeCount > 0 ? likeCount : "点赞"}
                </button>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-sm font-medium text-[var(--gc-text)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))]"
                >
                  {copied ? "已复制完整链接" : "复制完整链接"}
                </button>
                {meta.shareCode ? (
                  <button
                    type="button"
                    onClick={() => void copyShortUrl()}
                    className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_10%,transparent)] px-4 py-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_16%,transparent)]"
                  >
                    {shortCopied ? "已复制短链" : "复制短链接"}
                  </button>
                ) : meta.isOwner ? (
                  <button
                    type="button"
                    disabled={mintBusy}
                    onClick={() => void mintShareCode()}
                    className="rounded-full border border-dashed border-[color:var(--gc-border)] px-4 py-2 text-sm text-[var(--gc-text-soft)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] hover:text-[var(--gc-text)] disabled:opacity-50"
                  >
                    {mintBusy ? "生成中…" : "生成短链接"}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={remixBusy}
                  onClick={() => void remix()}
                  className="rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-sm font-medium text-[var(--gc-text)] hover:bg-[var(--gc-surface-glass-strong)] disabled:opacity-50"
                >
                  {remixBusy ? "复制中…" : "Remix 到我的工作室"}
                </button>
                <Link
                  href={`/create?from=${encodeURIComponent(id)}`}
                  className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] px-4 py-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)]"
                >
                  用同一设定再生成
                </Link>
                <Link
                  href="/create"
                  className="rounded-full px-4 py-2 text-sm font-medium text-[var(--gc-muted)] underline-offset-4 hover:text-[var(--gc-text)] hover:underline"
                >
                  新建空白创作
                </Link>
                {meta.isOwner ? (
                  <Link
                    href="/studio"
                    className="gc-theme-cta rounded-full px-4 py-2 text-sm font-semibold"
                  >
                    工作室
                  </Link>
                ) : (
                  <span className="rounded-full border border-[color:var(--gc-border)] px-4 py-2 text-xs text-[var(--gc-muted)]">
                    访客试玩 · Remix 可存入你的会话库
                  </span>
                )}
              </div>
            </div>

            {shortUrl ? (
              <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-xs text-[var(--gc-muted)]">
                <span className="text-[var(--gc-text-faint)]">短链（便于口头分享）：</span>{" "}
                <code className="break-all text-[var(--gc-text-soft)]">{shortUrl}</code>
              </div>
            ) : null}

            <GameRuntimeTabs
              spec={spec}
              projectId={id}
              phaser={<GamePlayer spec={spec} coverCapture={meta.isOwner ? { projectId: id } : null} />}
            />
            {meta.isOwner ? <SpecQuickTunePanel spec={spec} onChange={(next) => setSpec(next)} /> : null}

            {/* Runtime AI patch panel */}
            <div className="space-y-3 rounded-2xl border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--gc-text-soft)]">继续共创</p>
                <p className="text-xs leading-relaxed text-[var(--gc-muted)]">
                  AI patch 和上方快速调参都可以继续沉淀回当前项目，不再只是一次性试玩结果。
                  {meta.isOwner ? " 你是作品主人：精炼会记入版本日志（「局部 patch」或「整盘 regenerate」）。访客仍走匿名 patch。" : ""}
                </p>
              </div>
              {meta.isOwner ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="text-[var(--gc-muted)]">模式：</span>
                  <button
                    type="button"
                    onClick={() => setRefineMode("patch")}
                    className={`rounded-full px-3 py-1 font-medium ${
                      refineMode === "patch"
                        ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)] text-[var(--gc-text)]"
                        : "border border-[color:var(--gc-border)] text-[var(--gc-muted)]"
                    }`}
                  >
                    局部 patch
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefineMode("regenerate")}
                    className={`rounded-full px-3 py-1 font-medium ${
                      refineMode === "regenerate"
                        ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)] text-[var(--gc-text)]"
                        : "border border-[color:var(--gc-border)] text-[var(--gc-muted)]"
                    }`}
                  >
                    整盘 regenerate
                  </button>
                </div>
              ) : null}
              <form onSubmit={(e) => void applyPatch(e)} className="flex items-center gap-2">
                <input
                  id="patch-prompt"
                  name="patch-prompt"
                  type="text"
                  value={patchPrompt}
                  onChange={(e) => {
                    setPatchPrompt(e.target.value);
                    setPatchError(null);
                    setSaveMsg(null);
                  }}
                  placeholder="用一句话修改游戏，例如：把敌人速度加快一倍，改成宇宙主题…"
                  disabled={patchBusy}
                  className="min-w-0 flex-1 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-2 text-sm text-[var(--gc-text)] placeholder:text-[var(--gc-muted)] focus:outline-none focus:ring-1 focus:ring-[color:color-mix(in_srgb,var(--gc-accent)_50%,transparent)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={patchBusy || !patchPrompt.trim()}
                  className="shrink-0 rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_12%,transparent)] px-5 py-2 text-sm font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_20%,transparent)] disabled:opacity-40"
                >
                  {patchBusy
                    ? refineMode === "regenerate"
                      ? "生成中…"
                      : "修改中…"
                    : meta?.isOwner && refineMode === "regenerate"
                      ? "AI 重新生成"
                      : "AI 修改"}
                </button>
                {meta.isOwner ? (
                  <button
                    type="button"
                    disabled={saveBusy}
                    onClick={() => void saveProjectSpec()}
                    className="shrink-0 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-5 py-2 text-sm font-medium text-[var(--gc-text)] hover:bg-[var(--gc-surface-glass-strong)] disabled:opacity-40"
                  >
                    {saveBusy ? "保存中…" : "应用并保存"}
                  </button>
                ) : null}
              </form>
              {meta.isOwner && refinementHistory.length > 0 ? (
                <div className="rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2 text-[11px] text-[var(--gc-muted)]">
                  <p className="mb-1 font-medium text-[var(--gc-text-soft)]">最近精炼（最新在后）</p>
                  <ul className="max-h-28 space-y-1 overflow-y-auto">
                    {refinementHistory.map((r, i) => (
                      <li key={`${r.at}-${i}`} className="truncate">
                        <span className="text-[var(--gc-text-faint)]">{r.mode}</span> · {r.instruction}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {saveMsg ? (
              <p className="text-xs text-emerald-400" role="status">
                {saveMsg}
              </p>
            ) : null}
            {patchError ? (
              <p className="text-xs text-red-400">{patchError}</p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
