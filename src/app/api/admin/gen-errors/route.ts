import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const contentType = url.searchParams.get("contentType")?.trim();
  const errorType = url.searchParams.get("errorType")?.trim();
  const sinceDays = Number.parseInt(url.searchParams.get("sinceDays") ?? "7", 10);

  const where: Record<string, unknown> = {};
  if (contentType) where.contentType = contentType;
  if (errorType) where.errorType = errorType;
  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    where.createdAt = { gte: new Date(Date.now() - sinceDays * 86_400_000) };
  }

  const [errors, total] = await Promise.all([
    prisma.generationError.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        contentType: true,
        errorType: true,
        errorMessage: true,
        promptSnippet: true,
        ownerKey: true,
        createdAt: true,
      },
    }),
    prisma.generationError.count({ where }),
  ]);

  return NextResponse.json({ errors, total, limit });
}
