"use client";

import { useEffect, useRef, useState } from "react";

export function NovelSynopsisBlurb({
  text,
  mutedColor,
}: {
  text: string;
  mutedColor?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;

    const check = () => {
      setOverflows(el.scrollHeight > el.clientHeight + 2);
    };
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text, expanded]);

  return (
    <div className="mt-2 max-w-2xl">
      <p
        ref={ref}
        className={
          expanded ?
            "text-sm leading-relaxed"
          : "line-clamp-2 text-sm leading-relaxed"
        }
        style={{ color: mutedColor }}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs transition hover:opacity-80"
          style={{ color: mutedColor }}
        >
          {expanded ? "收起" : "… 查看更多"}
        </button>
      )}
    </div>
  );
}
