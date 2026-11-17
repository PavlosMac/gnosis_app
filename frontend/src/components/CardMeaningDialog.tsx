"use client";

import { useEffect, useState } from "react";
import TarotCard from "@/components/TarotCard";
import type { TarotCardData } from "@/types/models";

const CINZEL = { fontFamily: "'Cinzel', serif" } as const;
const CRIMSON = { fontFamily: "'Crimson Pro', serif" } as const;

/** Shared by every dialog that shows a stored card text: the card of the day on the
    profile and a card clicked in a spread. `T` is that endpoint's response. */
export type MeaningState<T> =
  | { status: "loading" }
  | { status: "result"; meaning: T }
  | { status: "error"; message: string };

export type MeaningFetchResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface MeaningLoader<T> {
  /** What to render before any fetch: the cached text, or the waiting line */
  initial: (idx: number) => MeaningState<T>;
  has: (idx: number) => boolean;
  /** The cached text, or one call to the fetcher. Never rejects. */
  load: (idx: number) => Promise<MeaningState<T>>;
  clear: () => void;
}

/** The texts are the same for every user and never change within a visit, so a card
    fetched once is kept for the page's lifetime: reopening it shows the text at once,
    with no round trip. Only successes are kept, so an error is retried on the next open.
    Each kind of text gets its own loader, and so its own cache. */
export const createMeaningLoader = <T,>(
  fetcher: (idx: number) => Promise<MeaningFetchResult<T>>
): MeaningLoader<T> => {
  const cache = new Map<number, T>();

  const initial = (idx: number): MeaningState<T> => {
    const meaning = cache.get(idx);
    return meaning ? { status: "result", meaning } : { status: "loading" };
  };

  const load = async (idx: number): Promise<MeaningState<T>> => {
    const cached = cache.get(idx);
    if (cached) return { status: "result", meaning: cached };
    try {
      const result = await fetcher(idx);
      if (!result.ok) return { status: "error", message: result.error };
      cache.set(idx, result.data);
      return { status: "result", meaning: result.data };
    } catch {
      return { status: "error", message: "The card's meaning could not be reached." };
    }
  };

  return { initial, has: (idx) => cache.has(idx), load, clear: () => cache.clear() };
};

/** The text for one card: cached at once, otherwise fetched after mount. */
export const useCardMeaning = <T,>(loader: MeaningLoader<T>, idx: number): MeaningState<T> => {
  const [state, setState] = useState<MeaningState<T>>(() => loader.initial(idx));

  useEffect(() => {
    if (loader.has(idx)) return;
    let cancelled = false;
    loader.load(idx).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [loader, idx]);

  return state;
};

interface CardMeaningBodyProps<T> {
  card: TarotCardData;
  state: MeaningState<T>;
  /** The paragraphs to show, in order, deliberately unlabelled */
  paragraphs: (meaning: T) => string[];
}

/** Pure: the card beside its text. Stacked on a phone, side by side from `sm:`. */
export const CardMeaningBody = <T,>({ card, state, paragraphs }: CardMeaningBodyProps<T>) => (
  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 px-6 py-6">
    <div className="shrink-0">
      <TarotCard card={card} small showMeaning={false} />
    </div>

    <div className="flex-1 min-w-0 w-full">
      {state.status === "loading" && (
        <p role="status" className="text-[#d4af37]/80 tracking-wider py-4" style={CINZEL}>
          The card unfolds...
        </p>
      )}

      {state.status === "error" && (
        <p className="text-red-400 text-base py-4" style={CRIMSON}>
          {state.message}
        </p>
      )}

      {state.status === "result" &&
        paragraphs(state.meaning).map((text, i) => (
          <p
            key={i}
            className="text-[#e6d5b8]/90 text-base sm:text-lg leading-relaxed mb-5 last:mb-0"
            style={CRIMSON}
          >
            {text}
          </p>
        ))}
    </div>
  </div>
);
