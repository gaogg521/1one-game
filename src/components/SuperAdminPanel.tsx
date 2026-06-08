"use client";

import { useEffect, useState } from "react";
import {
  getSuperAdminKey,
  isDevSuperAdminClientEnabled,
  setSuperAdminKey,
} from "@/lib/super-admin-client";

/** 小说 / 漫画广场共用的超级管理员密钥面板 */
export function SuperAdminPanel({ scope }: { scope: "novel" | "comic" }) {
  const devAutoAdmin = isDevSuperAdminClientEnabled();
  const [adminKeyDraft, setAdminKeyDraft] = useState("");
  const [adminEnabled, setAdminEnabled] = useState(false);

  useEffect(() => {
    setAdminEnabled(devAutoAdmin || !!getSuperAdminKey());
  }, [devAutoAdmin]);

  const scopeLabel = scope === "novel" ? "小说" : "漫画";

  if (devAutoAdmin) {
    return (
      <div className="mt-10 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm">
        <p className="font-medium text-emerald-200">开发模式 · 管理员已自动开启</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
          当前可删除广场内任意{scopeLabel}（卡片右上角「管理删除」）。由{" "}
          <code className="text-emerald-200/90">DEV_SUPER_ADMIN=1</code> 启用，仅本地 dev
          生效；上线前请在 <code className="text-emerald-200/90">.env</code> 中关闭并改做正式用户后台。
        </p>
      </div>
    );
  }

  return (
    <details className="mt-10 rounded-xl border border-dashed border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-[var(--gc-muted)]">
        超级管理员
        {adminEnabled ? (
          <span className="ml-2 text-xs text-emerald-400">已启用 · 可删除任意{scopeLabel}</span>
        ) : null}
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-[var(--gc-text-faint)]">
        系统没有预设密钥。请在本机项目根目录 <code className="text-[var(--gc-muted)]">.env</code> 中设置{" "}
        <code className="text-[var(--gc-muted)]">SUPER_ADMIN_SECRET=你的强密码</code>
        （步骤见 <code className="text-[var(--gc-muted)]">.env.example</code>），保存后重启{" "}
        <code className="text-[var(--gc-muted)]">npm run dev</code>，再在此处填入完全相同的字符串，即可删除他人
        {scopeLabel}。本地开发也可设 <code className="text-[var(--gc-muted)]">DEV_SUPER_ADMIN=1</code> 免填密钥。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={adminKeyDraft}
          onChange={(e) => setAdminKeyDraft(e.target.value)}
          placeholder="管理员密钥"
          className="min-w-[12rem] flex-1 rounded-lg border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] px-3 py-2 text-xs text-[var(--gc-text)]"
        />
        <button
          type="button"
          className="rounded-lg border border-[color:var(--gc-border)] px-3 py-2 text-xs text-[var(--gc-text)]"
          onClick={() => {
            setSuperAdminKey(adminKeyDraft);
            window.location.reload();
          }}
        >
          保存并刷新
        </button>
        {adminEnabled ? (
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-xs text-[var(--gc-muted)]"
            onClick={() => {
              setSuperAdminKey("");
              setAdminKeyDraft("");
              window.location.reload();
            }}
          >
            退出管理
          </button>
        ) : null}
      </div>
    </details>
  );
}
