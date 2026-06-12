"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { withLocalePath } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

type SessionUser = {
  displayName: string | null;
  role: string;
  referralCode: string;
  quota?: { balance: number; plan: { name: string } };
};

export function AccountMenu({
  compact = false,
  menuPlacement = "bottom",
}: {
  compact?: boolean;
  menuPlacement?: "top" | "bottom";
}) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: SessionUser | null } | null) => setUser(d?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setOpen(false);
    window.location.reload();
  }

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const isDesktopMenu = window.matchMedia("(min-width: 640px)").matches;

    if (!isDesktopMenu) {
      setMenuStyle({
        left: 12,
        right: 12,
        top: "calc(env(safe-area-inset-top, 0px) + 3.25rem)",
      });
      return;
    }

    const verticalOffset = 8;
    const anchorEnd = rect.left + rect.width / 2 > window.innerWidth / 2;
    const horizontalStyle = anchorEnd
      ? { right: Math.max(12, window.innerWidth - rect.right) }
      : { left: Math.max(12, rect.left) };

    setMenuStyle(
      menuPlacement === "top"
        ? {
            ...horizontalStyle,
            bottom: Math.max(12, window.innerHeight - rect.top + verticalOffset),
            minWidth: 192,
            maxWidth: "min(18rem, calc(100vw - 1.5rem))",
          }
        : {
            ...horizontalStyle,
            top: rect.bottom + verticalOffset,
            minWidth: 192,
            maxWidth: "min(18rem, calc(100vw - 1.5rem))",
          },
    );
  }, [menuPlacement]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(ev: PointerEvent) {
      const target = ev.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, updateMenuPosition]);

  if (!user) {
    return (
      <Link
        href={withLocalePath("/login", locale)}
        className="gc-utility-btn"
      >
        {t("account.login")}
      </Link>
    );
  }

  const isAdmin = user.role === "admin" || user.role === "super_admin";
  const accountMenu =
    open && menuStyle
      ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[120] max-h-[min(70vh,24rem)] overflow-y-auto rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] py-2 shadow-lg"
          style={menuStyle ?? undefined}
          role="menu"
        >
          {user.quota ? (
            <p className="px-3 py-1 text-[10px] text-[var(--gc-text-faint)]">
              {t("account.quotaLine", {
                balance: user.quota.balance,
                plan: user.quota.plan.name,
              })}
            </p>
          ) : null}
          <Link
            href={withLocalePath("/billing", locale)}
            className="block px-3 py-2 text-xs hover:bg-[var(--gc-surface-glass)]"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            {t("account.billing")}
          </Link>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[10px] text-[var(--gc-text-faint)] hover:bg-[var(--gc-surface-glass)]"
            onClick={() => {
              const url = `${window.location.origin}${withLocalePath("/start", locale)}?ref=${user.referralCode}`;
              void navigator.clipboard.writeText(url);
              alert(t("common.copiedInviteLink"));
            }}
            role="menuitem"
          >
            {t("account.copyInvite", { code: `${user.referralCode.slice(0, 8)}…` })}
          </button>
          <Link href={withLocalePath("/studio", locale)} className="block px-3 py-2 text-xs hover:bg-[var(--gc-surface-glass)]" onClick={() => setOpen(false)} role="menuitem">
            {t("account.workspace")}
          </Link>
          {isAdmin ? (
            <Link
              href={withLocalePath("/admin", locale)}
              className="block px-3 py-2 text-xs text-[var(--gc-accent)] hover:bg-[var(--gc-surface-glass)]"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              {t("account.admin")}
            </Link>
          ) : null}
          <button type="button" className="block w-full px-3 py-2 text-left text-xs text-[var(--gc-muted)] hover:bg-[var(--gc-surface-glass)]" onClick={() => void logout()} role="menuitem">
            {t("account.logout")}
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            setMenuStyle(null);
            return;
          }
          updateMenuPosition();
          setOpen(true);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user.displayName ?? t("account.myAccount")}
        className={`gc-utility-btn max-w-[7.5rem] truncate sm:max-w-none ${compact ? "px-2 sm:px-3" : ""}`}
      >
        {compact ? (user.displayName?.slice(0, 4) ?? t("account.account")) : (user.displayName ?? t("account.myAccount"))}
      </button>
      {accountMenu}
    </div>
  );
}
