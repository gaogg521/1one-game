import type { Metadata } from "next";
import { ArcadeFeedClient } from "./ArcadeFeedClient";

export const metadata: Metadata = {
  title: "Arcade — 游戏广场",
  description: "上划切换，无限畅玩",
};

export default function ArcadePage() {
  return <ArcadeFeedClient />;
}
