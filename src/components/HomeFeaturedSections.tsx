"use client";

import dynamic from "next/dynamic";
import { FeaturedShelfSkeleton } from "@/components/FeaturedShelfSkeleton";

const FeaturedGamesSection = dynamic(
  () => import("@/components/FeaturedGamesSection").then((m) => m.FeaturedGamesSection),
  { loading: () => <FeaturedShelfSkeleton count={6} aspect="920/560" /> },
);
const FeaturedNovelsSection = dynamic(
  () => import("@/components/FeaturedNovelsSection").then((m) => m.FeaturedNovelsSection),
  { loading: () => <FeaturedShelfSkeleton count={6} aspect="3/4" /> },
);
const FeaturedComicsSection = dynamic(
  () => import("@/components/FeaturedComicsSection").then((m) => m.FeaturedComicsSection),
  { loading: () => <FeaturedShelfSkeleton count={6} aspect="4/3" /> },
);

export function HomeFeaturedSections() {
  return (
    <>
      <FeaturedGamesSection />
      <FeaturedNovelsSection />
      <FeaturedComicsSection />
    </>
  );
}
