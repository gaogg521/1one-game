"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";

type GenErrorRow = {
  id: string;
  contentType: string;
  errorType: string;
  errorMessage: string | null;
  promptSnippet: string;
  ownerKey: string | null;
  createdAt: string;
};

type Filter = {
  contentType: string;
  errorType: string;
  sinceDays: string;
};

type GenerationJob = {
  id: string; type: string; status: string; attempts: number; maxAttempts: number; lastErrorCode: string | null;
  updatedAt: string; project: { kind: string; title: string };
};

export function GenErrorsPanel({ headers }: { headers?: () => HeadersInit }) {
  const t = useTranslations("adminPage");
  const [rows, setRows] = useState<GenErrorRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>({ contentType: "", errorType: "", sinceDays: "7" });
  const [loaded, setLoaded] = useState(false);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [jobSummary, setJobSummary] = useState<Record<string, number>>({});

  const fetchErrors = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", sinceDays: f.sinceDays || "7" });
      if (f.contentType) params.set("contentType", f.contentType);
      if (f.errorType) params.set("errorType", f.errorType);
      const res = await fetch(`/api/admin/gen-errors?${params}`, headers ? { headers: headers() } : undefined);
      if (!res.ok) return;
      const data = await res.json();
      setRows(data.errors ?? []);
      setTotal(data.total ?? null);
      setJobs(data.jobs ?? []);
      setJobSummary(data.jobSummary ?? {});
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const handleLoad = () => fetchErrors(filter);

  const errorTypeColor: Record<string, string> = {
    timeout: "bg-yellow-100 text-yellow-800",
    rate_limit: "bg-orange-100 text-orange-800",
    context_length: "bg-blue-100 text-blue-800",
    parse_error: "bg-purple-100 text-purple-800",
    upstream: "bg-red-100 text-red-800",
    unknown: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t("genErrorContentType")}</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={filter.contentType}
            onChange={(e) => setFilter((f) => ({ ...f, contentType: e.target.value }))}
          >
            <option value="">{t("genErrorAll")}</option>
            <option value="game">game</option>
            <option value="novel">novel</option>
            <option value="comic">comic</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t("genErrorErrorType")}</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={filter.errorType}
            onChange={(e) => setFilter((f) => ({ ...f, errorType: e.target.value }))}
          >
            <option value="">{t("genErrorAll")}</option>
            {["timeout", "rate_limit", "context_length", "parse_error", "upstream", "unknown"].map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t("genErrorSinceDays")}</label>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={filter.sinceDays}
            onChange={(e) => setFilter((f) => ({ ...f, sinceDays: e.target.value }))}
          >
            <option value="1">1d</option>
            <option value="7">7d</option>
            <option value="30">30d</option>
          </select>
        </div>
        <button
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          onClick={handleLoad}
          disabled={loading}
        >
          {loading ? t("genErrorLoading") : t("genErrorLoad")}
        </button>
        {loaded && total !== null && (
          <span className="text-sm text-gray-500">{t("genErrorTotal", { total })}</span>
        )}
      </div>

      {loaded && rows.length === 0 && (
        <p className="text-sm text-gray-400">{t("genErrorEmpty")}</p>
      )}

      {loaded ? (
        <section className="rounded border bg-white p-4" data-testid="admin-generation-ops-jobs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium text-slate-900">生成运营队列</h3>
              <p className="mt-1 text-xs text-slate-500">统一查看游戏、小说、漫画的待执行、运行中、重试和失败任务；不暴露原始提示词或密钥。</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {["queued", "running", "retrying", "failed"].map((status) => (
                <span key={status} className="rounded bg-slate-100 px-2 py-1 text-slate-700">{status}: {jobSummary[status] ?? 0}</span>
              ))}
            </div>
          </div>
          {jobs.length ? (
            <div className="mt-3 overflow-auto">
              <table className="w-full text-xs"><thead className="text-left text-slate-500"><tr><th>作品</th><th>任务</th><th>状态</th><th>重试</th><th>最近错误</th><th>更新时间</th></tr></thead>
                <tbody className="divide-y">{jobs.map((job) => <tr key={job.id}><td className="py-2 pr-3">{job.project.kind} · {job.project.title}</td><td className="py-2 pr-3">{job.type}</td><td className="py-2 pr-3">{job.status}</td><td className="py-2 pr-3">{job.attempts}/{job.maxAttempts}</td><td className="py-2 pr-3">{job.lastErrorCode ?? "—"}</td><td className="py-2">{new Date(job.updatedAt).toLocaleString()}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="mt-3 text-sm text-slate-500">当前没有待处理生成任务。</p>}
        </section>
      ) : null}

      {rows.length > 0 && (
        <div className="overflow-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Error</th>
                <th className="px-3 py-2 text-left">Message</th>
                <th className="px-3 py-2 text-left">Prompt</th>
                <th className="px-3 py-2 text-left">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="rounded px-1 bg-slate-100 text-slate-700">{row.contentType}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`rounded px-1 text-xs font-medium ${errorTypeColor[row.errorType] ?? "bg-gray-100 text-gray-700"}`}>
                      {row.errorType}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate text-gray-600" title={row.errorMessage ?? ""}>
                    {row.errorMessage ?? "-"}
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate text-gray-500" title={row.promptSnippet}>
                    {row.promptSnippet || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-400">
                    {row.ownerKey ? row.ownerKey.slice(0, 12) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
