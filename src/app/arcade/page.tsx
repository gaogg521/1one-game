import type { Metadata } from "next";
import { ArcadeFeedClient } from "./ArcadeFeedClient";

export const metadata: Metadata = {
  title: "刷游戏 — OperOne",
  description: "上滑切换，像刷短视频一样试玩小游戏",
};

export default function ArcadePage() {
  return <ArcadeFeedClient />;
}
