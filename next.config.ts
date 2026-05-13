import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["phaser"],
  serverExternalPackages: ["pdf-parse", "mammoth"],
  /** 关闭右下角 Next 开发指示器（Turbopack / 路由信息）；生产构建本就不包含 */
  devIndicators: false,
};

export default nextConfig;
