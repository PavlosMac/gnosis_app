import Link from "next/link";
import TarotPageLayout from "@/components/TarotPageLayout";
import { getReadings } from "./actions";

const PAGE_SIZE = 10;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const truncate = (text: string | null, max: number) => {
  if (!text) return null;
  return text.length > max ? text.slice(0, max) + "…" : text;
};

const ReadingsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) => {
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const result = await getReadings(currentPage, PAGE_SIZE);

  const totalPages = result.ok
    ? Math.max(1, Math.ceil(result.data.total / PAGE_SIZE))
    : 1;

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
            Past Readings
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
            </p>
          )}
        </div>

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
          </div>
        ) : (
          <>
            {/* Readings list */}
            <div className="flex flex-col gap-4">
              {result.data.items.map((reading) => (
                <Link
                  key={reading._id}
                  href={`/user/readings/${reading._id}`}
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
                      className="text-[#e6d5b8]/60 text-sm italic mb-3 line-clamp-2"
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
                    href={`/user/readings?page=${currentPage - 1}`}
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
                    href={`/user/readings?page=${currentPage + 1}`}
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
