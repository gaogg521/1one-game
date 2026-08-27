import { loadRuntimeConfig } from "../src/lib/runtime-config";
import { prisma } from "../src/lib/prisma";

type RouteLike = {
  scene?: string;
  providerId?: string;
  primary?: string;
  model?: string;
  fallbacks?: string[];
  fallbackCandidates?: Array<{ providerId?: string; model?: string }>;
  localeGroup?: string | null;
};

function summarize(route: RouteLike) {
  return {
    scene: route.scene,
    providerId: route.providerId,
    model: route.primary || route.model,
    fallbacks: route.fallbacks ?? [],
    fallbackCandidates: (route.fallbackCandidates ?? []).map((candidate) => ({
      providerId: candidate.providerId,
      model: candidate.model,
    })),
    localeGroup: route.localeGroup ?? null,
  };
}

async function recent(
  delegate: {
    findMany: (args: object) => Promise<Array<{
      id: string;
      title: string;
      createdAt: Date;
      generationProvider: string | null;
      generationModel: string | null;
    }>>;
  },
  type: string,
) {
  const rows = await delegate.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      title: true,
      createdAt: true,
      generationProvider: true,
      generationModel: true,
    },
  });
  return rows.map((row) => ({
    type,
    id: row.id,
    title: (row.title || "").slice(0, 40),
    createdAt: row.createdAt,
    generation:
      [row.generationProvider, row.generationModel].filter(Boolean).join(" · ") || "unrecorded",
  }));
}

async function main() {
  const runtime = await loadRuntimeConfig();
  const payload = runtime.payload;
  const out = {
    providers: (payload.providers ?? []).map((provider) => ({
      id: provider.id,
      protocol: provider.protocol,
      hasKey: Boolean(provider.apiKey),
      baseHost: (() => {
        try {
          return provider.baseUrl ? new URL(provider.baseUrl).host : null;
        } catch {
          return null;
        }
      })(),
    })),
    routes: (payload.routes ?? []).map(summarize),
    localeRoutes: (payload.localeRoutes ?? []).map(summarize),
    recentWorks: [
      ...(await recent(prisma.project, "game")),
      ...(await recent(prisma.novel, "novel")),
      ...(await recent(prisma.comic, "comic")),
    ],
  };
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
