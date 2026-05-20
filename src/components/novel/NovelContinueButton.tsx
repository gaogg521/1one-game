"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { NOVEL_CONTINUE_CHAPTER_PRESETS } from "@/lib/novel-continue-options";
import { novelMaxChars, parseNovelLengthTier } from "@/lib/novel-length";
import { PRODUCT } from "@/lib/product-config";

type Props = {
  novelId: string;
  initialContent: string;
  lengthTier: string | null;
  canContinue: boolean;
  continuationReason: string;
  remainingChapterCount?: number;
  onCompleted: (data: { content: string; summary?: string | null }) => void;
  onError: (message: string) => void;
  className?: string;
  style?: CSSProperties;
};

export function NovelContinueButton({
  novelId,
  initialContent,
  lengthTier,
  canContinue,
  continuationReason,
  remainingChapterCount = 0,
  onCompleted,
  onError,
  className,
  style,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [maxChapters, setMaxChapters] = useState<number>(
    PRODUCT.novel.longSegmented.continueDefaultMaxChapters,
  );
  const [polish, setPolish] = useState<boolean>(PRODUCT.novel.longSegmented.polishAfterSegment);

  if (!canContinue) return null;

  const presets = NOVEL_CONTINUE_CHAPTER_PRESETS;

  async function handleContinue() {
    if (loading) return;
    setLoading(true);
    setProgress("连接续写服务…");
    onError("");

    const body = {
      maxChapters: maxChapters <= 0 ? 0 : maxChapters,
      polish,
    };

    try {
      const res = await fetch(`/api/novel/${encodeURIComponent(novelId)}/continue/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        onError(data.error || `请求失败（${res.status}）`);
        setLoading(false);
        return;
      }

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream") || !res.body) {
        onError("服务器未返回流式响应");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = "";
      let streamError = "";
      let done = false;
      const tier = parseNovelLengthTier(lengthTier);
      const cap = novelMaxChars(tier);
      let previewLen = initialContent.length;

      while (true) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;
        sseBuf += decoder.decode(value, { stream: true });
        for (;;) {
          const sep = sseBuf.indexOf("\n\n");
          if (sep < 0) break;
          const rawBlock = sseBuf.slice(0, sep).trim();
          sseBuf = sseBuf.slice(sep + 2);
          for (const line of rawBlock.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            type Ev = {
              step?: string;
              text?: string;
              message?: string;
              novel?: { content?: string; summary?: string | null };
            };
            let ev: Ev;
            try {
              ev = JSON.parse(payload) as Ev;
            } catch {
              continue;
            }
            if (ev.step === "ping") continue;
            if (ev.message) setProgress(ev.message);
            if (ev.step === "delta" && typeof ev.text === "string") {
              previewLen += ev.text.length;
              setProgress(`续写中… 全文约 ${previewLen.toLocaleString()} / ${cap.toLocaleString()} 字`);
            }
            if (
              ev.step === "polish_start" ||
              ev.step === "polish_batch_start" ||
              ev.step === "polish_done" ||
              ev.step === "polish_batch_done"
            ) {
              if (ev.message) setProgress(ev.message);
            }
            if (ev.step === "done" && ev.novel?.content) {
              onCompleted({
                content: ev.novel.content,
                summary: ev.novel.summary,
              });
              done = true;
            }
            if (ev.step === "error") {
              streamError = ev.message ?? "续写失败";
            }
          }
        }
      }

      if (!done) {
        onError(streamError || "续写连接中断，请保持页面打开后重试");
      }
    } catch {
      onError("网络错误");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide opacity-70">本次章数</label>
        <select
          value={maxChapters}
          disabled={loading}
          onChange={(e) => setMaxChapters(Number(e.target.value))}
          className="rounded-lg border bg-transparent px-2 py-1.5 text-xs"
          style={{ borderColor: "inherit", color: "inherit" }}
          title={continuationReason}
        >
          {presets.map((n) => (
            <option key={n} value={n}>
              {n === 0
                ? `全部待写${remainingChapterCount > 0 ? `（约 ${remainingChapterCount} 章）` : ""}`
                : `${n} 章`}
            </option>
          ))}
        </select>
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={polish}
          disabled={loading}
          onChange={(e) => setPolish(e.target.checked)}
          className="rounded"
        />
        润色
      </label>
      <button
        type="button"
        onClick={handleContinue}
        disabled={loading}
        className={className}
        style={style}
      >
        {loading ? progress || "续写中…" : "续写"}
      </button>
    </div>
  );
}
