import Link from "next/link";
import { notFound } from "next/navigation";
import TarotPageLayout from "@/components/TarotPageLayout";
import InterpretationSection from "./InterpretationSection";
import { getReading } from "./actions";
import { findCardByNameSafe } from "@/services/cardLookup";
import type { TarotCardData } from "@/types/models";
import ReadingTags from "@/components/ReadingTags";

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const ReadingDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const result = await getReading(id);

  if (!result.ok) {
    if (result.error === "Invalid reading ID.") notFound();
    return (
      <TarotPageLayout
        backButtonHref="/user/readings"
        backButtonLabel="Readings"
      >
        <div className="w-full max-w-3xl mx-auto mt-16 px-4 text-center">
          <p
            className="text-red-400/80"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            {result.error}
          </p>
        </div>
      </TarotPageLayout>
    );
  }

  const reading = result.data;

  // Build cardVisuals map: position → { card, reversed }
  const cardVisuals: Record<
    string,
    { card: TarotCardData; reversed: boolean } | null
  > = {};
  for (const saved of reading.cards) {
    const card = findCardByNameSafe(saved.name);
    cardVisuals[saved.position] = card
      ? { card, reversed: saved.orientation === "reversed" }
      : null;
  }

  return (
    <TarotPageLayout
      backButtonHref="/user/readings"
      backButtonLabel="Readings"
    >
      <div className="w-full max-w-3xl mx-auto mt-8 sm:mt-16 px-4 sm:px-0">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-4xl text-[#d4af37]/80">&#9733;</span>
          <h1
            className="text-2xl sm:text-3xl text-[#d4af37] tracking-[0.2em] mt-4"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 30px rgba(212,175,55,0.4)",
            }}
          >
            {reading.spread_type}
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#d4af37]/40" />
            <span className="text-[#d4af37]/60 text-sm">&#9765;</span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#d4af37]/40" />
          </div>
          <time
            dateTime={
              reading.spread_type === "Significators" && reading.birth_date
                ? reading.birth_date
                : reading.created_at
            }
            className="text-[#e6d5b8]/40 text-base sm:text-lg mt-3 block"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            {reading.spread_type === "Significators" && reading.birth_date
              ? formatDate(reading.birth_date)
              : formatDateTime(reading.created_at)}
          </time>
        </div>

        <ReadingTags key={reading._id} readingId={reading._id} initialTags={reading.tags} />

        {/* Interpretation content */}
        <InterpretationSection
          readingId={reading._id}
          spreadName={reading.spread_type}
          question={reading.question}
          birthDate={reading.birth_date}
          cardVisuals={cardVisuals}
          interpretation={reading.interpretation}
        />

        {/* Footer nav */}
        <div className="mt-8 flex justify-center text-xs">
          <Link
            href="/user/readings"
            className="text-[#d4af37]/50 hover:text-[#d4af37] transition-colors tracking-wider"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            &#8592; All Readings
          </Link>
        </div>

        {/* Footer decoration */}
        <div className="mt-12 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="text-[#d4af37]/40">&#10022;</span>
            <span className="text-[#d4af37]/30">&#10022;</span>
            <span className="text-[#d4af37]/40">&#9765;</span>
            <span className="text-[#d4af37]/30">&#10022;</span>
            <span className="text-[#d4af37]/40">&#10022;</span>
          </div>
        </div>
      </div>
    </TarotPageLayout>
  );
};

export default ReadingDetailPage;
