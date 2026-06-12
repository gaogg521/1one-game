"use client";

import { useTranslations } from "next-intl";

type Props = {
  buildUrl: string;
  title?: string;
  className?: string;
};

/** Godot Web 导出试玩（iframe）；静态路径提供 index.html + wasm */
export function GodotWebPlayer({ buildUrl, title, className = "" }: Props) {
  const t = useTranslations("godotWeb");
  const iframeTitle = title ?? t("playTitle");
  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-black ${className}`}>
      <p className="pointer-events-none absolute bottom-2 left-0 right-0 z-10 text-center text-[10px] text-white/45">
        {t("audioClickHint")}
      </p>
      <iframe
        title={iframeTitle}
        data-testid="godot-web-iframe"
        src={buildUrl}
        className="aspect-[4/3] w-full max-h-[min(72vh,640px)] min-h-[320px] border-0"
        allow="autoplay; fullscreen"
      />
    </div>
  );
}
