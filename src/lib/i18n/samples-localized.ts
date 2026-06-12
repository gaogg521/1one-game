import type { AppLocale } from "@/i18n/routing";
import { getMessages } from "@/lib/i18n/messages";
import {
  SAMPLES,
  type Sample,
  type SampleShelf,
  samplesByShelf,
  shelfConfig,
} from "@/lib/samples";

type SampleItemMessages = {
  title?: string;
  subtitle?: string;
  prompt?: string;
  coverAlt?: string;
  creator?: string;
  tags?: string[];
};

type SampleShelfMessages = {
  title?: string;
  description?: string;
};

type SamplesMessages = {
  shelves?: Partial<Record<SampleShelf, SampleShelfMessages>>;
  items?: Record<string, SampleItemMessages>;
};

function sampleMessages(locale: AppLocale): SamplesMessages {
  return (getMessages(locale).samples ?? {}) as SamplesMessages;
}

export function getLocalizedSample(base: Sample, locale: AppLocale): Sample {
  const item = sampleMessages(locale).items?.[base.id];
  if (!item) return base;
  return {
    ...base,
    title: item.title ?? base.title,
    subtitle: item.subtitle ?? base.subtitle,
    prompt: item.prompt ?? base.prompt,
    coverAlt: item.coverAlt ?? base.coverAlt,
    creator: item.creator ?? base.creator,
    tags: item.tags?.length ? item.tags : base.tags,
  };
}

export function getLocalizedShelfMeta(shelf: SampleShelf, locale: AppLocale) {
  const base = shelfConfig(shelf);
  const shelfMsg = sampleMessages(locale).shelves?.[shelf];
  if (!shelfMsg) return base;
  return {
    ...base,
    title: shelfMsg.title ?? base.title,
    description: shelfMsg.description ?? base.description,
  };
}

export function getLocalizedSamplesByShelf(shelf: SampleShelf, locale: AppLocale): Sample[] {
  return samplesByShelf(shelf).map((s) => getLocalizedSample(s, locale));
}

/** Stable ids for prefetch / Godot warm-up (locale-agnostic). */
export function getSampleIds(): string[] {
  return SAMPLES.map((s) => s.id);
}
