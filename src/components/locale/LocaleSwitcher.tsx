"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { localeLabels, localeShortLabels, locales } from "@/i18n/routing";
import { withLocalePath } from "@/i18n/navigation";
import { LOCALE_COOKIE } from "@/lib/constants";

function writeLocaleCookie(locale: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
  try {
    localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {
    /* ignore */
  }
}

function IconGlobe(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 1 4 10 14.5 14.5 0 0 1-4 10 14.5 14.5 0 0 1-4-10 14.5 14.5 0 0 1 4-10z" />
      <path d="M2 12h20" />
    </svg>
  );
}

export function LocaleSwitcher({
  compact = false,
  menuPlacement = "bottom",
}: {
  compact?: boolean;
  menuPlacement?: "top" | "bottom";
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const currentPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }, []);

  const updatePosition = useCallback(() => {
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
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function onPointerDown(ev: PointerEvent) {
      const target = ev.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, updatePosition]);

  const menu =
    open && menuStyle
      ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[120] max-h-[min(70vh,24rem)] overflow-y-auto rounded-xl border border-[color:var(--gc-border)] bg-[var(--gc-bg-elevated)] py-2 shadow-lg"
          style={menuStyle ?? undefined}
          role="menu"
          aria-label={t("language")}
        >
          {locales.map((item) => {
            const href = withLocalePath(currentPath, item);
            const active = item === locale;
            return (
              <a
                key={item}
                href={href}
                role="menuitem"
                onClick={() => {
                  writeLocaleCookie(item);
                  setOpen(false);
                }}
                className={`flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-[var(--gc-surface-glass)] ${
                  active ? "text-[var(--gc-text)]" : "text-[var(--gc-text-soft)]"
                }`}
              >
                <span>{localeLabels[item]}</span>
                {active ? <span className="text-[10px] text-[var(--gc-accent)]">✓</span> : null}
              </a>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("language")}
        onClick={() => {
          if (open) {
            setOpen(false);
            setMenuStyle(null);
            return;
          }
          updatePosition();
          setOpen(true);
        }}
        className={`gc-utility-btn ${compact ? "px-2 sm:px-3" : ""}`}
      >
        {compact ? (
          <>
            <IconGlobe className="h-3.5 w-3.5 shrink-0 opacity-80" />
            <span>{localeShortLabels[locale]}</span>
          </>
        ) : (
          <>
            <IconGlobe className="h-3.5 w-3.5 shrink-0 opacity-80" />
            <span>
              {t("language")} · {localeShortLabels[locale]}
            </span>
          </>
        )}
      </button>
      {menu}
    </div>
  );
}
