"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { NovelChapter } from "@/lib/novel-chapters";
import { mergeLocaleHeaders } from "@/lib/i18n/client-headers";
import type { AppLocale } from "@/i18n/routing";
import {
  buildNovelTtsQueue,
  isBrowserTtsSupported,
  listChineseSpeechVoices,
  pickChineseSpeechVoice,
  type TtsQueueItem,
} from "@/lib/novel-tts";

export type NovelListenState = "idle" | "playing" | "paused" | "loading";
export type NovelListenProvider = "volc" | "browser" | "none";

export type TtsVoiceOption = { id: string; label: string };

const RATE_OPTIONS = [0.85, 1, 1.15, 1.35] as const;
const VOLC_VOICE_STORAGE_KEY = "game-novel-tts-volc-voice";
const BROWSER_VOICE_STORAGE_KEY = "game-novel-tts-browser-voice-uri";

type VolcStatus = {
  available: boolean;
  provider: string | null;
  voiceLabel: string | null;
  defaultVoiceType?: string | null;
  voices?: TtsVoiceOption[];
};

function readStoredVolcVoice(): string | null {
  try {
    return localStorage.getItem(VOLC_VOICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readStoredBrowserVoiceUri(): string | null {
  try {
    return localStorage.getItem(BROWSER_VOICE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useNovelListen(
  chapters: NovelChapter[],
  options?: {
    onChapterFocus?: (chapterId: string) => void;
    syncChapterId?: string;
  },
) {
  const t = useTranslations("novelListen");
  const locale = useLocale() as AppLocale;
  const [provider, setProvider] = useState<NovelListenProvider>("none");
  const [volcStatus, setVolcStatus] = useState<VolcStatus | null>(null);
  const [volcVoices, setVolcVoices] = useState<TtsVoiceOption[]>([]);
  const [selectedVolcVoice, setSelectedVolcVoice] = useState<string>("");
  const [browserVoices, setBrowserVoices] = useState<TtsVoiceOption[]>([]);
  const [selectedBrowserVoiceUri, setSelectedBrowserVoiceUri] = useState<string>("");
  const [state, setState] = useState<NovelListenState>("idle");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [rateIndex, setRateIndex] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queueRef = useRef<TtsQueueItem[]>([]);
  const queuePosRef = useRef(0);
  const stoppedRef = useRef(true);
  const rateRef = useRef<number>(RATE_OPTIONS[1]);
  const volcVoiceRef = useRef<string>("");
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const prefetchRef = useRef<Map<number, Blob>>(new Map());
  const onChapterFocusRef = useRef(options?.onChapterFocus);
  onChapterFocusRef.current = options?.onChapterFocus;

  const rate = RATE_OPTIONS[rateIndex] ?? 1;
  const supported = provider !== "none";

  useEffect(() => {
    rateRef.current = rate;
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    volcVoiceRef.current = selectedVolcVoice;
  }, [selectedVolcVoice]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/novel/tts", { headers: mergeLocaleHeaders(locale) });
        const data = (await res.json()) as VolcStatus & {
          available?: boolean;
          voices?: TtsVoiceOption[];
          defaultVoiceType?: string;
        };
        if (cancelled) return;
        if (data.available && data.voices?.length) {
          setVolcStatus(data);
          setVolcVoices(data.voices);
          const stored = readStoredVolcVoice();
          const initial =
            stored && data.voices.some((v) => v.id === stored) ?
              stored
            : data.defaultVoiceType && data.voices.some((v) => v.id === data.defaultVoiceType) ?
              data.defaultVoiceType
            : data.voices[0]!.id;
          setSelectedVolcVoice(initial);
          volcVoiceRef.current = initial;
          setProvider("volc");
          return;
        }
      } catch {
        /* fallback */
      }
      if (cancelled) return;
      if (isBrowserTtsSupported()) {
        setProvider("browser");
      } else {
        setProvider("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (provider !== "browser") return;
    const syncVoices = () => {
      const raw = window.speechSynthesis.getVoices();
      const listed = listChineseSpeechVoices(raw);
      setBrowserVoices(
        listed.map((v) => ({ id: v.uri, label: v.name || v.lang })),
      );
      const stored = readStoredBrowserVoiceUri();
      const picked = pickChineseSpeechVoice(raw, stored);
      if (picked) {
        voiceRef.current = picked;
        setSelectedBrowserVoiceUri(picked.voiceURI);
      }
    };
    syncVoices();
    window.speechSynthesis.addEventListener("voiceschanged", syncVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", syncVoices);
  }, [provider]);

  useEffect(() => {
    if (provider !== "browser" || !selectedBrowserVoiceUri) return;
    const raw = window.speechSynthesis.getVoices();
    voiceRef.current = pickChineseSpeechVoice(raw, selectedBrowserVoiceUri);
  }, [provider, selectedBrowserVoiceUri]);

  useEffect(() => {
    if (state !== "idle" || !options?.syncChapterId) return;
    const idx = chapters.findIndex((c) => c.id === options.syncChapterId);
    if (idx >= 0) setChapterIndex(idx);
  }, [options?.syncChapterId, chapters, state]);

  const focusChapter = useCallback(
    (index: number) => {
      const ch = chapters[index];
      if (!ch) return;
      setChapterIndex(index);
      onChapterFocusRef.current?.(ch.id);
    },
    [chapters],
  );

  const releaseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const fetchVolcAudio = useCallback(async (text: string): Promise<Blob> => {
    const res = await fetch("/api/novel/tts", {
      method: "POST",
      headers: mergeLocaleHeaders(locale, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        text,
        speedRatio: rateRef.current,
        voiceType: volcVoiceRef.current,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || t("ttsRequestFailed", { status: res.status }));
    }
    return res.blob();
  }, [locale, t]);

  const prefetchVolc = useCallback(
    (pos: number) => {
      if (provider !== "volc") return;
      const item = queueRef.current[pos];
      if (!item || prefetchRef.current.has(pos)) return;
      void fetchVolcAudio(item.text)
        .then((blob) => {
          if (!stoppedRef.current) prefetchRef.current.set(pos, blob);
        })
        .catch(() => {});
    },
    [provider, fetchVolcAudio],
  );

  const speakBrowserAt = useCallback(
    (pos: number) => {
      if (stoppedRef.current || pos >= queueRef.current.length) {
        setState("idle");
        stoppedRef.current = true;
        return;
      }

      queuePosRef.current = pos;
      const item = queueRef.current[pos]!;
      focusChapter(item.chapterIndex);
      setStatusMessage(null);

      const utter = new SpeechSynthesisUtterance(item.text);
      utter.lang = "zh-CN";
      utter.rate = rateRef.current;
      if (voiceRef.current) utter.voice = voiceRef.current;

      utter.onend = () => {
        if (!stoppedRef.current) speakBrowserAt(pos + 1);
      };
      utter.onerror = () => {
        if (!stoppedRef.current) speakBrowserAt(pos + 1);
      };

      window.speechSynthesis.speak(utter);
    },
    [focusChapter],
  );

  const playVolcBlob = useCallback(
    (blob: Blob): Promise<void> =>
      new Promise((resolve, reject) => {
        releaseAudio();
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audio.playbackRate = rateRef.current;
        audioRef.current = audio;
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error(t("audioPlayFailed")));
        void audio.play().catch(reject);
      }),
    [releaseAudio],
  );

  const speakVolcAt = useCallback(
    async (pos: number) => {
      if (stoppedRef.current || pos >= queueRef.current.length) {
        releaseAudio();
        setState("idle");
        stoppedRef.current = true;
        setStatusMessage(null);
        return;
      }

      queuePosRef.current = pos;
      const item = queueRef.current[pos]!;
      focusChapter(item.chapterIndex);
      prefetchVolc(pos + 1);

      try {
        setState("loading");
        setStatusMessage(
          t("synthesizingProgress", { current: pos + 1, total: queueRef.current.length }),
        );
        setError(null);

        let blob = prefetchRef.current.get(pos);
        if (!blob) {
          blob = await fetchVolcAudio(item.text);
        } else {
          prefetchRef.current.delete(pos);
        }

        if (stoppedRef.current) return;

        setState("playing");
        setStatusMessage(null);
        await playVolcBlob(blob);

        if (!stoppedRef.current) await speakVolcAt(pos + 1);
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("readFailed");
        setError(msg);
        setState("idle");
        stoppedRef.current = true;
        releaseAudio();
      }
    },
    [focusChapter, prefetchVolc, fetchVolcAudio, playVolcBlob, releaseAudio, t],
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    window.speechSynthesis?.cancel();
    releaseAudio();
    prefetchRef.current.clear();
    setState("idle");
    setStatusMessage(null);
  }, [releaseAudio]);

  const play = useCallback(
    (fromChapterIndex?: number) => {
      if (!supported || chapters.length === 0) return;

      const start =
        fromChapterIndex !== undefined ?
          Math.max(0, Math.min(fromChapterIndex, chapters.length - 1))
        : chapterIndex;

      window.speechSynthesis?.cancel();
      releaseAudio();
      prefetchRef.current.clear();
      stoppedRef.current = false;
      queueRef.current = buildNovelTtsQueue(chapters, start, locale);
      queuePosRef.current = 0;

      if (queueRef.current.length === 0) {
        setState("idle");
        return;
      }

      setError(null);
      if (provider === "volc") {
        void speakVolcAt(0);
      } else {
        setState("playing");
        speakBrowserAt(0);
      }
    },
    [supported, chapters, chapterIndex, provider, releaseAudio, speakVolcAt, speakBrowserAt, locale],
  );

  const pause = useCallback(() => {
    if (state === "playing") {
      if (provider === "volc" && audioRef.current) {
        audioRef.current.pause();
      } else {
        window.speechSynthesis.pause();
      }
      setState("paused");
    }
  }, [state, provider]);

  const resume = useCallback(() => {
    if (state === "paused") {
      if (provider === "volc" && audioRef.current) {
        void audioRef.current.play();
      } else {
        window.speechSynthesis.resume();
      }
      setState("playing");
    }
  }, [state, provider]);

  const toggle = useCallback(() => {
    if (state === "playing") pause();
    else if (state === "paused") resume();
    else if (state !== "loading") play(chapterIndex);
  }, [state, pause, resume, play, chapterIndex]);

  const prevChapter = useCallback(() => {
    const next = Math.max(0, chapterIndex - 1);
    if (state === "idle") {
      focusChapter(next);
      return;
    }
    play(next);
  }, [chapterIndex, state, focusChapter, play]);

  const nextChapter = useCallback(() => {
    const next = Math.min(chapters.length - 1, chapterIndex + 1);
    if (state === "idle") {
      focusChapter(next);
      return;
    }
    play(next);
  }, [chapterIndex, chapters.length, state, focusChapter, play]);

  const cycleRate = useCallback(() => {
    setRateIndex((i) => (i + 1) % RATE_OPTIONS.length);
  }, []);

  const setVolcVoice = useCallback(
    (voiceId: string) => {
      if (!volcVoices.some((v) => v.id === voiceId)) return;
      setSelectedVolcVoice(voiceId);
      volcVoiceRef.current = voiceId;
      try {
        localStorage.setItem(VOLC_VOICE_STORAGE_KEY, voiceId);
      } catch {
        /* ignore */
      }
      if (state !== "idle") {
        stop();
        setStatusMessage(t("voiceSwitched"));
      }
    },
    [volcVoices, state, stop],
  );

  const setBrowserVoice = useCallback(
    (voiceUri: string) => {
      if (!browserVoices.some((v) => v.id === voiceUri)) return;
      setSelectedBrowserVoiceUri(voiceUri);
      const raw = window.speechSynthesis.getVoices();
      voiceRef.current = pickChineseSpeechVoice(raw, voiceUri);
      try {
        localStorage.setItem(BROWSER_VOICE_STORAGE_KEY, voiceUri);
      } catch {
        /* ignore */
      }
      if (state !== "idle") {
        stop();
        window.speechSynthesis.cancel();
        setStatusMessage(t("voiceSwitched"));
      }
    },
    [browserVoices, state, stop],
  );

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      window.speechSynthesis?.cancel();
      releaseAudio();
      prefetchRef.current.clear();
    };
  }, [releaseAudio]);

  const currentChapter = chapters[chapterIndex];
  const voiceOptions = provider === "volc" ? volcVoices : browserVoices;
  const selectedVoiceId =
    provider === "volc" ? selectedVolcVoice : selectedBrowserVoiceUri;
  const selectedVoiceLabel =
    voiceOptions.find((v) => v.id === selectedVoiceId)?.label ?? null;

  const providerLabel =
    provider === "volc" ?
      selectedVoiceLabel ? t("providerDoubaoNamed", { name: selectedVoiceLabel })
      : volcStatus?.voiceLabel ? t("providerDoubaoNamed", { name: volcStatus.voiceLabel })
      : t("providerDoubao")
    : provider === "browser" ?
      selectedVoiceLabel ? t("providerSystemNamed", { name: selectedVoiceLabel })
      : t("providerSystem")
    : "";

  return {
    supported,
    provider,
    providerLabel,
    voiceOptions,
    selectedVoiceId,
    setVolcVoice,
    setBrowserVoice,
    state,
    chapterIndex,
    currentChapter,
    rate,
    rateLabel: `${rate}×`,
    statusMessage,
    error,
    play,
    pause,
    resume,
    stop,
    toggle,
    prevChapter,
    nextChapter,
    cycleRate,
    canPrev: chapterIndex > 0,
    canNext: chapterIndex < chapters.length - 1,
  };
}
