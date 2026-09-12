import Link from "next/link";
import { PlayingCards, PlayingCardsFan } from "lucide-react";
import { listHref, readingHref } from "@/lib/reading-list-context";
import { formatReadingDate, truncateQuestion, tagHref } from "@/lib/profile-dashboard";
import type { ReadingDetail, TagSummary } from "@/types/reading";

const MAX_TAG_CHIPS = 12;

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2
    className="text-[#d4af37]/80 text-xs tracking-[0.3em] uppercase text-center mb-6"
    style={{ fontFamily: "'Cinzel', serif" }}
  >
    ✦ {children} ✦
  </h2>
);

const SubLabel = ({ children }: { children: React.ReactNode }) => (
  <h3
    className="text-[#e6d5b8]/50 text-xs tracking-[0.2em] uppercase mb-3"
    style={{ fontFamily: "'Cinzel', serif" }}
  >
    {children}
  </h3>
);

const LastReadingCard = ({ reading }: { reading: ReadingDetail }) => (
  <Link
    href={readingHref(reading._id, null)}
    className="group block rounded-xl border border-[#d4af37]/15 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80
               backdrop-blur-sm p-5 transition-all duration-300
               hover:border-[#d4af37]/40 hover:shadow-lg hover:shadow-[#d4af37]/5"
  >
    <div className="flex items-center justify-between gap-4">
      <h4
        className="text-[#d4af37] font-semibold text-base tracking-wide group-hover:text-[#e6c84a] transition-colors"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        {reading.spread_type}
      </h4>
      <time
        dateTime={reading.created_at}
        className="text-[#e6d5b8]/40 text-xs whitespace-nowrap shrink-0"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        {formatReadingDate(reading.created_at)}
      </time>
    </div>

    <div className="h-px bg-gradient-to-r from-[#d4af37]/20 via-[#d4af37]/10 to-transparent my-3" />

    {reading.question && (
      <p
        className="text-[#e6d5b8]/60 text-sm italic mb-3 line-clamp-2 whitespace-pre-line"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        &ldquo;{truncateQuestion(reading.question, 120)}&rdquo;
      </p>
    )}

    <div className="flex items-center justify-between mt-3">
      <span
        className="text-[#e6d5b8]/30 text-xs"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        {(reading.cards?.length ?? 0)} card{(reading.cards?.length ?? 0) !== 1 ? "s" : ""}
        {reading.interpretation && (
          <span className="text-[#d4af37]/60"> · ✦ Interpreted</span>
        )}
      </span>
      <span
        className="text-[#d4af37]/0 group-hover:text-[#d4af37]/60 text-xs tracking-[0.15em] transition-all duration-300"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        View Reading &#8250;
      </span>
    </div>
  </Link>
);

const TagChips = ({ tags }: { tags: TagSummary[] }) => {
  const visible = tags.slice(0, MAX_TAG_CHIPS);
  const hidden = tags.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((tag) => (
        <Link
          key={tag.name}
          href={tagHref(tag.name)}
          className="px-3 py-1 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/60
                     text-[#e6d5b8]/80 text-xs sm:text-sm tracking-wide
                     hover:border-[#d4af37]/40 hover:text-[#d4af37] transition-colors"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {tag.name}
          <span className="text-[#e6d5b8]/40"> · {tag.count}</span>
        </Link>
      ))}
      {hidden > 0 && (
        <Link
          href={listHref(null)}
          className="px-3 py-1 rounded-full border border-[#d4af37]/10 text-[#e6d5b8]/50 text-xs sm:text-sm tracking-wide hover:text-[#d4af37] transition-colors"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          +{hidden} more
        </Link>
      )}
    </div>
  );
};

export interface ReadingsSummary {
  total: number;
  lastReading: ReadingDetail | null;
  tags: TagSummary[];
}

interface ReadingsPanelProps {
  /** null when the ledger could not be fetched */
  summary: ReadingsSummary | null;
}

const ReadingsPanel = ({ summary }: ReadingsPanelProps) => (
  <div className="flex flex-col p-5 sm:p-8">
    <SectionLabel>Readings Journal</SectionLabel>

    {summary ? (
      // Inline gap: a dev server can serve Tailwind CSS that lacks utilities first
      // introduced in a new file (see CLAUDE.md); spacing this visible shouldn't depend on it
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Count */}
        <div className="text-center">
          <div
            className="text-4xl text-[#d4af37]"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 20px rgba(212,175,55,0.5)",
            }}
          >
            {summary.total}
          </div>
          <div
            className="text-[#e6d5b8]/50 text-sm tracking-[0.2em] uppercase mt-1"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Reading{summary.total !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Last reading */}
        <div>
          <SubLabel>Last Reading</SubLabel>
          {summary.lastReading ? (
            <LastReadingCard reading={summary.lastReading} />
          ) : (
            <p
              className="text-[#e6d5b8]/50 text-sm italic"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              No readings yet. The cards await your first question.
            </p>
          )}
        </div>

        {/* Tags */}
        {summary.tags.length > 0 && (
          <div>
            <SubLabel>Focused</SubLabel>
            <TagChips tags={summary.tags} />
          </div>
        )}
      </div>
    ) : (
      <p
        className="text-[#e6d5b8]/40 text-sm italic text-center py-8"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        The oracle&rsquo;s ledger is unavailable
      </p>
    )}

    {/* Actions: icon-only buttons; the tooltip is a real element (not a pseudo-element)
        so every engine shows it on hover/focus, and aria-label carries the name */}
    <div className="sanctum-actions" style={{ marginTop: "auto", paddingTop: "2rem" }}>
      <Link
        href="/reading"
        aria-label="New reading"
        className="sanctum-tip flex-1 inline-flex items-center justify-center px-6 py-3 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                   font-bold hover:scale-105 active:scale-95 transition-all duration-300
                   border border-[#d4af37]/50 shadow-lg"
      >
        <PlayingCards size={22} strokeWidth={1.75} aria-hidden="true" />
        <span className="sanctum-tip__label" aria-hidden="true">
          New reading
        </span>
      </Link>
      <Link
        href={listHref(null)}
        aria-label="All readings"
        className="sanctum-tip flex-1 inline-flex items-center justify-center px-6 py-3 rounded-lg border border-[#d4af37]/30 text-[#d4af37]
                   hover:border-[#d4af37]/60 hover:bg-[#d4af37]/10 transition-all duration-300"
      >
        <PlayingCardsFan size={22} strokeWidth={1.75} aria-hidden="true" />
        <span className="sanctum-tip__label" aria-hidden="true">
          All readings
        </span>
      </Link>
    </div>
  </div>
);

export default ReadingsPanel;
