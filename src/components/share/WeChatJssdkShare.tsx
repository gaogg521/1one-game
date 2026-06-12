"use client";

import { useEffect, useRef } from "react";

type SharePayload = {
  title: string;
  desc: string;
  link: string;
  imgUrl?: string;
};

type WxApi = {
  config: (opts: Record<string, unknown>) => void;
  ready: (fn: () => void) => void;
  error: (fn: (err: unknown) => void) => void;
  updateAppMessageShareData: (opts: SharePayload) => void;
  updateTimelineShareData: (opts: { title: string; link: string; imgUrl?: string }) => void;
};

declare global {
  interface Window {
    wx?: WxApi;
  }
}

const SCRIPT_ID = "wechat-jssdk-script";

function loadWxScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.wx) {
      resolve();
      return;
    }
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("wx script load failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("wx script load failed"));
    document.head.appendChild(s);
  });
}

type Props = {
  enabled: boolean;
  share: SharePayload;
  onReady?: () => void;
  onFallback?: () => void;
};

/** 微信内浏览器：配置 JS-SDK 原生分享卡片 */
export function WeChatJssdkShare({ enabled, share, onReady, onFallback }: Props) {
  const configured = useRef(false);

  useEffect(() => {
    if (!enabled || configured.current) return;
    const url = window.location.href.split("#")[0] ?? window.location.href;

    void (async () => {
      try {
        const res = await fetch(`/api/wechat/jssdk-config?url=${encodeURIComponent(url)}`);
        const data = (await res.json()) as {
          enabled?: boolean;
          appId?: string;
          timestamp?: number;
          nonceStr?: string;
          signature?: string;
          jsApiList?: string[];
        };
        if (!data.enabled || !data.appId) {
          onFallback?.();
          return;
        }
        await loadWxScript();
        const wx = window.wx;
        if (!wx) {
          onFallback?.();
          return;
        }
        wx.config({
          debug: false,
          appId: data.appId,
          timestamp: data.timestamp,
          nonceStr: data.nonceStr,
          signature: data.signature,
          jsApiList: data.jsApiList ?? ["updateAppMessageShareData", "updateTimelineShareData"],
        });
        wx.ready(() => {
          configured.current = true;
          wx.updateAppMessageShareData({
            title: share.title,
            desc: share.desc,
            link: share.link,
            imgUrl: share.imgUrl ?? `${window.location.origin}/favicon.ico`,
          });
          wx.updateTimelineShareData({
            title: share.title,
            link: share.link,
            imgUrl: share.imgUrl ?? `${window.location.origin}/favicon.ico`,
          });
          onReady?.();
        });
        wx.error(() => onFallback?.());
      } catch {
        onFallback?.();
      }
    })();
  }, [enabled, share.title, share.desc, share.link, share.imgUrl, onReady, onFallback]);

  return null;
}
