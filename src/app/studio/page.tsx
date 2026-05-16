"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";

type WorkType = "project" | "novel" | "comic";

type BaseRow = {
  id: string;
  title: string;
  prompt: string;
  status: string;
  shareCode: string | null;
  coverPath: string | null;
  playCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
};

type WorkRow = BaseRow & { type: WorkType };

function formatWhen(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("zh-Hans", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function getWorkLink(type: WorkType, id: string): string {
  switch (type) {
    case "project":
      return `/play/${id}`;
    case "novel":
      return `/novel/${id}`;
    case "comic":
      return `/comic/${id}`;
    default:
      return `/`;
  }
}

function getWorkIcon(type: WorkType): string {
  switch (type) {
    case "project":
      return "🎮";
    case "novel":
      return "📖";
    case "comic":
      return "🎨";
    default:
      return "📦";
  }
}

function getWorkTypeLabel(type: WorkType): string {
  switch (type) {
    case "project":
      return "游戏";
    case "novel":
      return "小说";
    case "comic":
      return "动漫";
    default:
      return "作品";
  }
}

export default function StudioPage() {
  const router = useRouter();
  const [rows, setRows] = useState<WorkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<WorkType | "all">("all");

  const filtered = useMemo(() => {
    if (!rows) return null;
    let t = rows;
    if (activeFilter !== "all") {
      t = t.filter((r) => r.type === activeFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return t;
    return t.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.prompt.toLowerCase().includes(q) ||
        (r.shareCode && r.shareCode.toLowerCase().includes(q)),
    );
  }, [rows, query, activeFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [projectsRes, novelsRes, comicsRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/novel?limit=100"),
          fetch("/api/comic?limit=100"),
        ]);

        const projectsData = (await projectsRes.json()) as { projects?: BaseRow[] };
        const novelsData = (await novelsRes.json()) as { novels?: BaseRow[] };
        const comicsData = (await comicsRes.json()) as { comics?: BaseRow[] };

        const allWorks: WorkRow[] = [
          ...(projectsData.projects ?? []).map((p) => ({ ...p, type: "project" as WorkType })),
          ...(novelsData.novels ?? []).map((n) => ({ ...n, type: "novel" as WorkType })),
          ...(comicsData.comics ?? []).map((c) => ({ ...c, type: "comic" as WorkType })),
        ];

        // Sort by updatedAt desc
        allWorks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        if (!cancelled) {
          setRows(allWorks);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("网络异常");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(id: string, type: WorkType) {
    if (!confirm("确定删除该作品？")) return;
    let res: Response;
    switch (type) {
      case "project":
        res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
        break;
      case "novel":
        res = await fetch(`/api/novel/${id}`, { method: "DELETE" });
        break;
      case "comic":
        res = await fetch(`/api/comic/${id}`, { method: "DELETE" });
        break;
    }
    if (!res!.ok) return;
    setRows((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }

  async function duplicateProject(id: string) {
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
    const data = (await res.json()) as { project?: { id: string }; error?: string };
    if (!res.ok) {
      alert(data.error ?? "复制失败");
      return;
    }
    if (data.project?.id) {
      router.push(`/play/${data.project.id}`);
    }
  }

  const filterButtons: { key: WorkType | "all"; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "project", label: "游戏" },
    { key: "novel", label: "小说" },
    { key: "comic", label: "动漫" },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col text-[var(--gc-text)] lg:flex-row">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-8 px-4 py-10 lg:px-8 xl:pr-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--gc-text)]">工作室</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--gc-muted)]">
              管理你的游戏、小说和动漫作品。按类型筛选，快速找到需要的内容。
            </p>
          </div>
          <Link
            href="/create"
            className="gc-theme-cta rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg hover:brightness-110"
          >
            新建作品
          </Link>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        ) : null}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setActiveFilter(btn.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                activeFilter === btn.key
                  ? "bg-[color:color-mix(in_srgb,var(--gc-accent)_18%,transparent)] text-[var(--gc-text)]"
                  : "text-[var(--gc-muted)] hover:text-[var(--gc-text)] border border-[color:var(--gc-border)]"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {rows && rows.length > 0 ? (
          <div className="max-w-md">
            <label htmlFor="studio-search" className="sr-only">
              搜索作品
            </label>
            <input
              id="studio-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="按标题、描述或短链片段筛选…"
              className="w-full rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-input-bg)] px-4 py-2.5 text-sm text-[var(--gc-text)] outline-none placeholder:text-[var(--gc-text-faint)] focus:border-[color:color-mix(in_srgb,var(--gc-accent)_45%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--gc-accent)_25%,transparent)]"
            />
          </div>
        ) : null}

        {rows === null ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="gc-card h-36 animate-pulse bg-[var(--gc-surface-glass)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="gc-card flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
            <p className="text-sm text-[var(--gc-muted)]">还没有作品。从一个念头开始。</p>
            <Link
              href="/create"
              className="gc-theme-cta rounded-full px-6 py-2 text-sm font-semibold hover:brightness-110"
            >
              去创作
            </Link>
          </div>
        ) : filtered?.length === 0 ? (
          <div className="gc-card px-8 py-14 text-center text-sm text-[var(--gc-muted)]">
            没有匹配的作品，换个关键词试试。
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {filtered?.map((r) => (
              <li
                key={`${r.type}-${r.id}`}
                className="gc-card flex flex-col gap-3 overflow-hidden p-0 transition hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)]"
              >
                <Link
                  href={getWorkLink(r.type, r.id)}
                  className="relative block aspect-video w-full overflow-hidden bg-[var(--gc-bg-elevated)]"
                >
                  {r.coverPath ? (
                    <Image
                      src={r.coverPath}
                      alt={`《${r.title}》封面`}
                      fill
                      className="object-cover transition duration-300 hover:scale-[1.03]"
                      sizes="(max-width: 640px) 100vw, 360px"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-bg))] to-[color:color-mix(in_srgb,var(--gc-cyan)_18%,var(--gc-bg))]">
                      <span className="text-3xl opacity-50" aria-hidden>
                        {getWorkIcon(r.type)}
                      </span>
                      <span className="text-[11px] font-medium text-[var(--gc-text-faint)]">
                        {r.type === "project" ? "试玩后自动生成封面" : "封面生成中…"}
                      </span>
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                    {getWorkTypeLabel(r.type)}
                  </span>
                </Link>
                <div className="flex flex-col gap-2 px-5 pb-1 pt-0">
                  <Link
                    href={getWorkLink(r.type, r.id)}
                    className="truncate text-lg font-semibold text-[var(--gc-text)] hover:text-[color:var(--gc-accent)]"
                  >
                    {r.title}
                  </Link>
                  <p className="line-clamp-2 text-sm text-[var(--gc-muted)]">{r.prompt}</p>
                  {r.shareCode ? (
                    <p className="font-mono text-[11px] text-[color:color-mix(in_srgb,var(--gc-accent)_85%,white)]">
                      短链 /s/{r.shareCode}
                    </p>
                  ) : null}
                  <p className="text-[11px] uppercase tracking-wider text-[var(--gc-text-faint)]">
                    更新 {formatWhen(r.updatedAt)}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-[var(--gc-text-faint)]">
                    {r.playCount > 0 && <span>▶ {r.playCount} 次试玩</span>}
                    {r.likeCount > 0 && <span>♥ {r.likeCount} 点赞</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[color:var(--gc-border)] px-5 pb-5 pt-3">
                  <Link
                    href={getWorkLink(r.type, r.id)}
                    className="rounded-full bg-[var(--gc-surface-glass-strong)] px-4 py-1.5 text-xs font-medium text-[var(--gc-text)] hover:bg-[color:color-mix(in_srgb,var(--gc-text)_14%,transparent)]"
                  >
                    打开
                  </Link>
                  {r.type === "project" && (
                    <>
                      <Link
                        href={`/create?from=${encodeURIComponent(r.id)}`}
                        className="rounded-full border border-[color:color-mix(in_srgb,var(--gc-accent)_40%,transparent)] bg-[color:color-mix(in_srgb,var(--gc-accent)_14%,transparent)] px-4 py-1.5 text-xs font-medium text-[color:color-mix(in_srgb,var(--gc-accent)_95%,white)] hover:bg-[color:color-mix(in_srgb,var(--gc-accent)_22%,transparent)]"
                      >
                        再生成
                      </Link>
                      <button
                        type="button"
                        onClick={() => void duplicateProject(r.id)}
                        className="rounded-full border border-[color:var(--gc-border)] px-4 py-1.5 text-xs font-medium text-[var(--gc-text-soft)] hover:border-[color:color-mix(in_srgb,var(--gc-accent)_50%,transparent)] hover:text-[var(--gc-text)]"
                      >
                        复制副本
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(r.id, r.type)}
                    className="ml-auto rounded-full px-3 py-1.5 text-xs text-[var(--gc-muted)] hover:text-red-400"
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
