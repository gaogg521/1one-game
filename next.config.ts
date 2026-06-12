import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  transpilePackages: ["phaser"],
  serverExternalPackages: ["pdf-parse", "mammoth"],
  /** Playwright / 局域网设备用 127.0.0.1 打开 dev HMR */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /** 关闭右下角 Next 开发指示器（Turbopack / 路由信息）；生产构建本就不包含 */
  devIndicators: false,
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
