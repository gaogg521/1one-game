"use client";

import { useTranslations } from "next-intl";

type WorkKind = "game" | "novel" | "comic";

type Props = {
  kind: WorkKind;
  playCount?: number;
  likeCount?: number;
  className?: string;
  /** 卡片右侧另有 Like 按钮时隐藏重复点赞数 */
  hideLikes?: boolean;
  /** 紧凑单行（卡片） vs 详情页稍大间距 */
  size?: "sm" | "md";
};

export function WorkEngagementStats({
  kind,
  playCount = 0,
  likeCount = 0,
  className = "",
  hideLikes = false,
  size = "sm",
}: Props) {
  const tf = useTranslations("featured");
  const gap = size === "sm" ? "gap-2" : "gap-3";
  const text = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div
      className={`flex flex-wrap items-center ${gap} ${text} text-[var(--gc-muted)] ${className}`}
      data-testid="work-engagement-stats"
    >
      {kind !== "comic" && playCount > 0 ? (
        <span>
          {kind === "game"
            ? tf("playsShort", { count: playCount })
            : tf("readsShort", { count: playCount })}
        </span>
      ) : null}
      {likeCount > 0 && !hideLikes ? <span>♥ {likeCount}</span> : null}
      {kind !== "comic" && playCount === 0 && (hideLikes || likeCount === 0) ? (
        <span className="text-[var(--gc-text-faint)]">—</span>
      ) : null}
      {kind === "comic" && likeCount === 0 && hideLikes ? (
        <span className="text-[var(--gc-text-faint)]">—</span>
      ) : null}
    </div>
  );
}
