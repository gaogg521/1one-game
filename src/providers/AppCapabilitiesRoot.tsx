"use client";

/**
 * 全站底层能力挂载点：**主题**、**剪贴板图片队列**、开发期 canonical 域名提示。
 * 业务页通过 useTheme / useClipboardImageQueue 消费，不要把粘贴监听散落在各路由。
 */
import { DevCanonicalOriginBanner } from "@/components/DevCanonicalOriginBanner";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ClipboardImageQueueProvider } from "@/providers/ClipboardImageQueueProvider";

export function AppCapabilitiesRoot({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ClipboardImageQueueProvider>
        <DevCanonicalOriginBanner />
        {children}
      </ClipboardImageQueueProvider>
    </ThemeProvider>
  );
}
