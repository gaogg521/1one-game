"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { WeChatJssdkShare } from "@/components/share/WeChatJssdkShare";

type Props = {
  shareUrl: string;
  shareCode: string;
  workType: "game" | "novel" | "comic";
  workId: string;
  title?: string;
  coverUrl?: string;
};

function isWechatBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

export function SocialShareBar({ shareUrl, shareCode, workType, workId, title, coverUrl }: Props) {
  const t = useTranslations("share");
  const [jssdkEnabled, setJssdkEnabled] = useState(false);
  const [wxNativeReady, setWxNativeReady] = useState(false);

  const channels = useMemo(
    () =>
      [
        { id: "wechat", label: t("wechat"), hint: t("wechatHint") },
        { id: "qq", label: t("qq"), hint: t("qqHint") },
        { id: "feishu", label: t("feishu"), hint: t("feishuHint") },
        { id: "copy", label: t("copyLink"), hint: "" },
      ] as const,
    [t],
  );

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { wechatJssdk?: boolean }) => {
        setJssdkEnabled(Boolean(d.wechatJssdk) && isWechatBrowser());
      });
  }, []);

  const fullShareUrl = useMemo(() => {
    if (typeof window === "undefined") return shareUrl;
    const u = new URL(shareUrl, window.location.origin);
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) u.searchParams.set("ref", ref);
    return u.toString();
  }, [shareUrl]);

  async function track(channel: string) {
    try {
      await fetch("/api/share/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareCode, workType, workId, channel }),
      });
    } catch {
      /* ignore */
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(fullShareUrl);
    void track("copy");
    alert(t("linkCopied"));
  }

  async function handleWechatShare() {
    void track("wechat");
    if (wxNativeReady) {
      alert(t("wechatNativeHint"));
      return;
    }
    await copyLink();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <WeChatJssdkShare
        enabled={jssdkEnabled}
        share={{
          title: title ?? t("defaultWorkTitle"),
          desc: t("defaultDesc"),
          link: fullShareUrl,
          imgUrl: coverUrl,
        }}
        onReady={() => setWxNativeReady(true)}
        onFallback={() => setWxNativeReady(false)}
      />
      <span className="text-[11px] text-[var(--gc-muted)]">
        {title ? t("shareTitle", { title }) : t("shareTo")}
      </span>
      {wxNativeReady ? (
        <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-400">
          {t("wechatCardReady")}
        </span>
      ) : null}
      {channels.map((ch) => (
        <button
          key={ch.id}
          type="button"
          onClick={() => {
            if (ch.id === "wechat") void handleWechatShare();
            else {
              void track(ch.id === "copy" ? "copy" : ch.id);
              void copyLink();
            }
          }}
          title={ch.hint || undefined}
          className="rounded-full border border-[color:var(--gc-border)] px-3 py-1 text-[11px] text-[var(--gc-text-soft)] hover:border-[color:var(--gc-accent)]/40"
        >
          {ch.label}
        </button>
      ))}
    </div>
  );
}
