import Link from "next/link";
import TarotPageLayout from "@/components/TarotPageLayout";
import { getReadings } from "./actions";
import ReadingsFilterPanel from "@/components/ReadingsFilterPanel";
import {
  READINGS_PAGE_SIZE,
  parseListContext,
  listHref,
  readingHref,
} from "@/lib/reading-list-context";
import {
  formatReadingDate as formatDate,
  truncateQuestion as truncate,
} from "@/lib/profile-dashboard";

/** Entry point for readings done with a physical deck — wording over iconography */
const ManualReadingHint = ({ className = "" }: { className?: string }) => (
  <p
    className={`${className} text-center text-[#e6d5b8]/50 text-sm`}
    style={{ fontFamily: "'Crimson Pro', serif" }}
  >
    Read with your own deck?{" "}
    <Link
      href="/user/manual-reading"
      className="text-[#d4af37]/70 hover:text-[#d4af37] transition-colors underline-offset-4 hover:underline"
    >
      Record that reading here
    </Link>
  </p>
);

const ReadingsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    spread_type?: string;
    tags?: string;
    birth_date?: string;
  }>;
}) => {
  const ctx = parseListContext(await searchParams) ?? { page: 1 };
  const { page: currentPage, spreadType, tags, birthDate } = ctx;
  const result = await getReadings(currentPage, READINGS_PAGE_SIZE, {
    spreadType,
    tags,
    birthDate,
  });

  const totalPages = result.ok
    ? Math.max(1, Math.ceil(result.data.total / READINGS_PAGE_SIZE))
    : 1;

  const pageHref = (targetPage: number) => listHref({ ...ctx, page: targetPage });

  return (
    <TarotPageLayout backButtonHref="/user/profile" backButtonLabel="Profile">
      <div className="w-full max-w-4xl mx-auto mt-8 sm:mt-16 px-4 sm:px-0">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-4xl text-[#d4af37]/80">&#9733;</span>
          <h1
            className="text-3xl text-[#d4af37] tracking-[0.2em] mt-4"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 30px rgba(212,175,55,0.4)",
            }}
          >
            Readings Journal
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#d4af37]/40" />
            <span className="text-[#d4af37]/60 text-sm">&#9765;</span>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#d4af37]/40" />
          </div>
          {result.ok && (
            <p
              className="text-[#e6d5b8]/50 text-sm mt-3"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              {result.data.total} reading{result.data.total !== 1 ? "s" : ""} in
              the archive
              {tags && " (sorted by relevance)"}
            </p>
          )}
        </div>

        <ReadingsFilterPanel
          key={`${spreadType ?? ""}|${tags ?? ""}|${birthDate ?? ""}`}
          currentSpreadType={spreadType}
          currentTags={tags}
          currentBirthDate={birthDate}
          availableTags={result.ok ? result.data.user_tags ?? [] : []}
        />

        {!result.ok ? (
          <div className="text-center text-red-400/80 py-8">
            <p style={{ fontFamily: "'Crimson Pro', serif" }}>
              {result.error}
            </p>
          </div>
        ) : result.data.items.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="text-6xl text-[#d4af37]/20">&#9734;</div>
            <p
              className="text-[#e6d5b8]/50 text-lg text-center"
              style={{ fontFamily: "'Crimson Pro', serif" }}
            >
              No readings yet. The cards await your first question.
            </p>
            <Link
              href="/"
              className="px-8 py-3 bg-gradient-to-br from-[#d4af37] to-[#b8942f] text-[#1a0033] rounded-lg
                         font-bold hover:scale-105 active:scale-95 transition-all duration-300
                         border border-[#d4af37]/50 shadow-lg"
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.1em" }}
            >
              ✦ Begin a Reading ✦
            </Link>
            <ManualReadingHint />
          </div>
        ) : (
          <>
            {/* Readings list */}
            <div className="flex flex-col gap-4">
              {result.data.items.map((reading) => (
                <Link
                  key={reading._id}
                  href={readingHref(reading._id, ctx)}
                  className="group block rounded-xl border border-[#d4af37]/15 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80
                             backdrop-blur-sm p-5 sm:p-6 transition-all duration-300
                             hover:border-[#d4af37]/40 hover:shadow-lg hover:shadow-[#d4af37]/5"
                >
                  {/* Top row: spread type + date */}
                  <div className="flex items-center justify-between gap-4">
                    <h3
                      className="text-[#d4af37] font-semibold text-base sm:text-lg tracking-wide group-hover:text-[#e6c84a] transition-colors"
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      {reading.spread_type}
                    </h3>
                    <time
                      dateTime={reading.created_at}
                      className="text-[#e6d5b8]/40 text-xs whitespace-nowrap shrink-0"
                      style={{ fontFamily: "'Crimson Pro', serif" }}
                    >
                      {formatDate(reading.created_at)}
                    </time>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-[#d4af37]/20 via-[#d4af37]/10 to-transparent my-3" />

                  {/* Question */}
                  {reading.question && (
                    <p
                      className="text-[#e6d5b8]/60 text-sm italic mb-3 line-clamp-2 whitespace-pre-line"
                      style={{ fontFamily: "'Crimson Pro', serif" }}
                    >
                      &ldquo;{truncate(reading.question, 120)}&rdquo;
                    </p>
                  )}

                  {/* Birth Date (for Significators) */}
                  {reading.birth_date && (
                    <p
                      className="text-[#e6d5b8]/50 text-sm mb-3"
                      style={{ fontFamily: "'Crimson Pro', serif" }}
                    >
                      Birth Date: {formatDate(reading.birth_date)}
                    </p>
                  )}

                  {/* Tags */}
                  {reading.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {reading.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/60
                                     text-[#e6d5b8]/80 text-xs sm:text-sm tracking-wide"
                          style={{ fontFamily: "'Crimson Pro', serif" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Card count + View Reading footer */}
                  <div className="flex items-center justify-between mt-3">
                    <span
                      className="text-[#e6d5b8]/30 text-xs"
                      style={{ fontFamily: "'Crimson Pro', serif" }}
                    >
                      {reading.cards.length} card{reading.cards.length !== 1 ? "s" : ""}
                    </span>
                    <span
                      className="text-[#d4af37]/0 group-hover:text-[#d4af37]/60 text-xs tracking-[0.15em] transition-all duration-300"
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      View Reading &#8250;
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                {currentPage > 1 ? (
                  <Link
                    href={pageHref(currentPage - 1)}
                    className="px-4 py-2 rounded-lg border border-[#d4af37]/30 text-[#d4af37] text-sm tracking-[0.1em] hover:bg-[#d4af37]/10 transition-colors"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    &#9664; Prev
                  </Link>
                ) : (
                  <span
                    className="px-4 py-2 rounded-lg border border-[#d4af37]/10 text-[#d4af37]/30 text-sm tracking-[0.1em] cursor-not-allowed"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    &#9664; Prev
                  </span>
                )}

                <span
                  className="text-[#e6d5b8]/60 text-sm"
                  style={{ fontFamily: "'Crimson Pro', serif" }}
                >
                  Page {currentPage} of {totalPages}
                </span>

                {currentPage < totalPages ? (
                  <Link
                    href={pageHref(currentPage + 1)}
                    className="px-4 py-2 rounded-lg border border-[#d4af37]/30 text-[#d4af37] text-sm tracking-[0.1em] hover:bg-[#d4af37]/10 transition-colors"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    Next &#9654;
                  </Link>
                ) : (
                  <span
                    className="px-4 py-2 rounded-lg border border-[#d4af37]/10 text-[#d4af37]/30 text-sm tracking-[0.1em] cursor-not-allowed"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    Next &#9654;
                  </span>
                )}
              </div>
            )}

            <ManualReadingHint className="mt-8" />
          </>
        )}

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

export default ReadingsPage;
