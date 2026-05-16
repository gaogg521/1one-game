import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { FeaturedGamesSection } from "@/components/FeaturedGamesSection";
import { FeaturedNovelsSection } from "@/components/FeaturedNovelsSection";
import { FeaturedComicsSection } from "@/components/FeaturedComicsSection";

const steps = [
  "输入一句话：场景 + 目标 + 障碍（可选：塔防、平台跳跃、像素、水彩风等玩法或画风）。",
  "系统自动扩写：章节与变奏、难度曲线、关卡蓝图（多塔多波次、多层平台等）。",
  "引擎编译为可玩版本：即时试玩、保存、分享链接，支持 Remix 继续进化。",
];

const pillars = [
  { en: "Capability", title: "人人都能上手", body: "不需要懂引擎、数值与关卡设计。用自然语言描述，系统自动补齐章节与玩法系统。" },
  { en: "Depth", title: "高复杂度也能「一句话」", body: "多塔多波次、长关卡平台跳跃、多阶段变奏均可自动生成，试玩即见分晓。" },
  { en: "Share", title: "分享与进化", body: "每条作品独立 URL；访客可玩，作者可复制到工作室继续 Remix。" },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <SiteHeader />
      <main className="@container/main relative flex min-h-full w-full min-w-0 flex-1 flex-col">
        <section className="relative min-h-[min(92vh,880px)] overflow-hidden px-6 pb-24 pt-20 sm:px-10 sm:pb-28 sm:pt-24 lg:min-h-[min(88vh,920px)] lg:px-14 lg:pb-32 lg:pt-28 xl:px-20 2xl:px-28">
          {/* 氛围底：多层光晕 + 噪点 */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_-30%,rgba(124,58,237,0.18),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_10%,rgba(34,211,238,0.1),transparent_50%),radial-gradient(ellipse_70%_45%_at_0%_80%,rgba(244,114,182,0.06),transparent_50%)]" />
            <div className="gc-home-noise" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--gc-bg)] to-transparent" />
          </div>

          {/* 左侧装饰线（大屏） */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-6 top-28 hidden h-[min(52vh,420px)] w-px bg-gradient-to-b from-transparent to-transparent xl:left-14 2xl:left-20 xl:block"
            style={{
              backgroundImage: "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--gc-accent) 35%, transparent), transparent)",
            }}
          />

          <div className="relative grid min-w-0 gap-16 xl:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] xl:items-start xl:gap-x-16 2xl:gap-x-24">
            <div className="min-w-0 pl-0 xl:pl-8 2xl:pl-10">
              <p className="inline-flex items-center gap-2 rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.32em] text-[var(--gc-muted)] shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)] backdrop-blur-sm">
                <span
                  className="h-1 w-1 rounded-full shadow-[0_0_10px_color-mix(in_srgb,var(--gc-cta-b)_60%,transparent)]"
                  style={{ background: "linear-gradient(90deg, var(--gc-cta-a), var(--gc-cta-c))" }}
                />
                1ONE · 人人都是游戏制作专家
              </p>

              <h1
                className="gc-theme-hero mt-10 text-nowrap bg-gradient-to-br from-[var(--gc-text)] via-[var(--gc-text-soft)] to-[var(--gc-muted)] bg-clip-text py-2 font-normal leading-[1.12] tracking-[0.03em] text-transparent [filter:drop-shadow(0_4px_48px_color-mix(in_srgb,var(--gc-text)_14%,transparent))] sm:mt-12"
                style={{
                  fontSize: "clamp(1.4rem, 0.4rem + 2.95cqi, 4.5rem)",
                }}
              >
                一句话，让你成为游戏制作专家
              </h1>

              <p className="mt-10 max-w-2xl text-pretty text-[15px] leading-[1.8] text-[var(--gc-muted)] sm:text-base lg:mt-12 lg:text-[17px] lg:leading-8">
                你只负责说出灵感，我们负责把它编译成
                <span className="bg-gradient-to-r from-[var(--gc-text)] to-[var(--gc-text-soft)] bg-clip-text font-medium text-transparent">
                  章节、节奏、系统与关卡
                </span>
                ——塔防、平台跳跃、收集、生存……都能生成可玩版本并一键分享。
              </p>

              <div className="mt-12 flex flex-wrap items-center gap-3 sm:mt-14 sm:gap-4">
                <Link
                  href="/create"
                  className="gc-theme-cta inline-flex items-center justify-center px-9 py-4 text-sm font-semibold transition duration-300 hover:scale-[1.02]"
                >
                  开始创作
                </Link>
                <Link
                  href="/samples"
                  className="inline-flex items-center justify-center rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] px-8 py-4 text-sm font-medium text-[var(--gc-text)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--gc-text)_10%,transparent)] backdrop-blur-md transition duration-300 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,var(--gc-border))] hover:bg-[var(--gc-surface-glass-strong)]"
                >
                  看样品
                </Link>
                <Link
                  href="/studio"
                  className="inline-flex items-center justify-center rounded-full px-7 py-4 text-sm font-medium text-[var(--gc-muted)] transition duration-300 hover:text-[var(--gc-text)]"
                >
                  我的作品
                </Link>
              </div>
            </div>

            <aside className="relative min-w-0 rounded-3xl border border-[color:var(--gc-border)] bg-gradient-to-b from-[var(--gc-surface-glass-strong)] via-[var(--gc-surface-glass)] to-transparent p-8 shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_32px_64px_-28px_rgba(0,0,0,0.55),0_0_80px_-30px_rgba(124,58,237,0.25)] backdrop-blur-xl sm:p-9 xl:p-10 xl:shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_40px_80px_-32px_rgba(0,0,0,0.5),0_0_100px_-40px_rgba(124,58,237,0.3)]">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[color:color-mix(in_srgb,var(--gc-text)_28%,transparent)] to-transparent"
              />
              <h2 className="text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--gc-muted)]">Workflow</h2>
              <p className="mt-2 text-base font-medium tracking-wide text-[var(--gc-text)]">三步，从一句话到可玩版本</p>
              <ol className="mt-8 space-y-7 border-t border-[color:var(--gc-border)] pt-8">
                {steps.map((text, i) => (
                  <li key={i} className="group flex gap-4">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--gc-border)] bg-[var(--gc-surface-glass)] font-mono text-[11px] tabular-nums text-[var(--gc-muted)] transition group-hover:border-[color:color-mix(in_srgb,var(--gc-accent)_35%,transparent)] group-hover:text-[color:color-mix(in_srgb,var(--gc-accent)_90%,var(--gc-text))]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-relaxed text-[var(--gc-muted)] transition group-hover:text-[var(--gc-text-soft)]">{text}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-8 rounded-2xl border border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-bg-elevated)_75%,transparent)] p-5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--gc-text-faint)]">Prompt 示例</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--gc-muted)]">
                  <span className="text-[var(--gc-muted)]">「</span>
                  <span className="text-[var(--gc-text-soft)]">手绘草地塔防，箭塔守着萝卜小屋，拦住沿土路行军的小小动物</span>
                  <span className="text-[var(--gc-muted)]">」</span>
                </p>
              </div>
            </aside>
          </div>
        </section>

        <div className="relative mx-6 h-px shrink-0 sm:mx-10 lg:mx-14 xl:mx-20 2xl:mx-28">
          <div
            className="absolute inset-x-0 -top-3 h-6 blur-md"
            style={{ background: "linear-gradient(to bottom, color-mix(in srgb, var(--gc-accent) 18%, transparent), transparent)" }}
          />
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[color:color-mix(in_srgb,var(--gc-muted)_35%,transparent)] to-transparent" />
        </div>

        <section className="px-6 py-20 sm:px-10 sm:py-24 lg:px-14 lg:py-28 xl:px-20 2xl:px-28">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--gc-text-faint)]">Why 1ONE</p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight text-[var(--gc-text)] sm:text-3xl">为创作留足空间</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--gc-muted)] sm:text-base">
                全宽画布式布局、克制的光感与玻璃层次——让灵感与流程并排呈现。
              </p>
            </div>
          </div>

          <div className="mt-14 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-8">
            {pillars.map((item) => (
              <div
                key={item.en}
                className="group relative overflow-hidden rounded-2xl border border-[color:var(--gc-border)] bg-gradient-to-b from-[var(--gc-surface-glass-strong)] to-transparent p-8 transition duration-500 hover:border-[color:color-mix(in_srgb,var(--gc-accent)_28%,var(--gc-border))] hover:from-[color:color-mix(in_srgb,var(--gc-text)_12%,transparent)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_24px_56px_-24px_rgba(0,0,0,0.45),0_0_60px_-20px_rgba(34,211,238,0.12)]"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-0 blur-2xl transition duration-500 group-hover:opacity-100"
                  style={{
                    background: "radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--gc-cta-b) 22%, transparent), color-mix(in srgb, var(--gc-cta-c) 15%, transparent))",
                  }}
                />
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--gc-text-faint)] transition group-hover:text-[var(--gc-muted)]">{item.en}</p>
                <h3 className="relative mt-4 text-lg font-medium tracking-tight text-[var(--gc-text)]">{item.title}</h3>
                <p className="relative mt-4 text-sm leading-relaxed text-[var(--gc-muted)] transition group-hover:text-[var(--gc-text-soft)] lg:text-[15px] lg:leading-7">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <FeaturedGamesSection />

        <FeaturedNovelsSection />

        <FeaturedComicsSection />
        <FeaturedNovelsSection />
        <FeaturedComicsSection />

        <section
          className="mt-auto border-t border-[color:var(--gc-border)] bg-gradient-to-b from-transparent via-transparent to-transparent px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-20 xl:px-20 2xl:px-28"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, color-mix(in srgb, var(--gc-cta-b) 14%, transparent), transparent, transparent)",
          }}
        >
          <div className="max-w-4xl">
            <p
              className="gc-theme-hero text-nowrap bg-gradient-to-r from-[var(--gc-text)] via-[var(--gc-text-soft)] to-[var(--gc-muted)] bg-clip-text font-normal leading-tight text-transparent [filter:drop-shadow(0_2px_28px_color-mix(in_srgb,var(--gc-text)_12%,transparent))]"
              style={{ fontSize: "clamp(1.35rem, 0.55rem + 2.2cqi, 2.65rem)" }}
            >
              让想象，当场可玩
            </p>
            <p
              className="gc-theme-soft mt-5 max-w-2xl text-[clamp(0.95rem,0.4rem+1.1cqi,1.2rem)] leading-relaxed text-[var(--gc-muted)] sm:mt-6"
            >
              灵感不必等排期；你说画风与玩法，下一刻就是可试玩的版本。
            </p>
            <p className="mt-8 text-sm leading-relaxed tracking-wide text-[var(--gc-text-faint)]">
              塔防、平台跳跃、生存收集、田园水彩或像素手绘……成章、成局、成链接；与好友分享，或在工作室继续 Remix，让作品一直进化。
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
