import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "工作室",
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
