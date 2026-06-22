"use client";

import { useCallback, useRef } from "react";

/** 右侧窄条手势区：Phaser 占满触控时仍可上滑切卡 */
export function FeedScrollRail({
  onSwipeNext,
  onSwipePrev,
}: {
  onSwipeNext: () => void;
  onSwipePrev?: () => void;
}) {
  const touchY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchY.current = e.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchY.current;
      touchY.current = null;
      if (start == null) return;
      const end = e.changedTouches[0]?.clientY;
      if (end == null) return;
      const delta = start - end;
      if (delta > 48) {
        onSwipeNext();
        return;
      }
      if (delta < -48) onSwipePrev?.();
    },
    [onSwipeNext, onSwipePrev],
  );

  return (
    <div
      className="absolute bottom-28 right-0 top-20 z-20 w-10 touch-pan-y md:hidden"
      aria-hidden
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    />
  );
}
