import type { ComponentPropsWithoutRef, ReactNode } from "react";

/** 全站页面壳：侧栏 + 主内容横向排列，窄屏防溢出裁切 */
export function AppPageShell({
  children,
  className = "",
  ...props
}: {
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "className">) {
  return (
    <div
      {...props}
      className={`flex w-full min-w-0 flex-1 flex-col overflow-x-clip lg:min-h-[100dvh] lg:flex-row lg:items-start ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** 主内容区：在 flex 行布局中可收缩，避免把侧栏顶出视口 */
export function AppMain({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-h-0 min-w-0 w-full flex-1 self-stretch lg:pt-12 ${className}`.trim()}>{children}</div>
  );
}
