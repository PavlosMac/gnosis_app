import Link from "next/link";
import TarotPageLayout from "@/components/TarotPageLayout";
import { getUsers } from "./actions";

const PAGE_SIZE = 20;

const SuperadminPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) => {
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const result = await getUsers(currentPage, PAGE_SIZE);

  const totalPages = result.ok
    ? Math.max(1, Math.ceil(result.total / PAGE_SIZE))
    : 1;

  return (
    <TarotPageLayout backButtonHref="/user/profile" backButtonLabel="Profile">
      <div className="w-full max-w-5xl mx-auto mt-8 sm:mt-16 px-4 sm:px-0">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-4xl text-[#d4af37]/80">&#9878;</span>
          <h1
            className="text-3xl text-[#d4af37] tracking-[0.2em] mt-4"
            style={{
              fontFamily: "'Cinzel', serif",
              textShadow: "0 0 30px rgba(212,175,55,0.4)",
            }}
          >
            All Seekers
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
              {result.total} seeker{result.total !== 1 ? "s" : ""} in the
              archive
            </p>
          )}
        </div>

        {!result.ok ? (
          <div className="text-center text-red-400/80 py-8">
            <p style={{ fontFamily: "'Crimson Pro', serif" }}>
              {result.error}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#d4af37]/20">
                      {["Email", "Name", "Credits", "Joined"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-4 sm:px-6 py-4 text-[#d4af37]/80 text-xs tracking-[0.15em] uppercase whitespace-nowrap"
                            style={{ fontFamily: "'Cinzel', serif" }}
                          >
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {result.users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-[#d4af37]/10 last:border-b-0 hover:bg-[#d4af37]/5 transition-colors"
                      >
                        <td
                          className="px-4 sm:px-6 py-3 text-[#e6d5b8] text-sm"
                          style={{ fontFamily: "'Crimson Pro', serif" }}
                        >
                          {user.email}
                        </td>
                        <td
                          className="px-4 sm:px-6 py-3 text-[#e6d5b8]/80 text-sm"
                          style={{ fontFamily: "'Crimson Pro', serif" }}
                        >
                          {user.displayName || "—"}
                        </td>
                        <td
                          className="px-4 sm:px-6 py-3 text-[#d4af37] text-sm"
                          style={{ fontFamily: "'Cinzel', serif" }}
                        >
                          {user.credits}
                        </td>
                        <td
                          className="px-4 sm:px-6 py-3 text-[#e6d5b8]/60 text-sm whitespace-nowrap"
                          style={{ fontFamily: "'Crimson Pro', serif" }}
                        >
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                {currentPage > 1 ? (
                  <Link
                    href={`/superadmin?page=${currentPage - 1}`}
                    className="px-4 py-2 rounded-lg border border-[#d4af37]/30 text-[#d4af37] text-sm tracking-[0.1em] hover:bg-[#d4af37]/10 transition-colors"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    &#9664; Prev
                  </Link>
                ) : (
                  <span className="px-4 py-2 rounded-lg border border-[#d4af37]/10 text-[#d4af37]/30 text-sm tracking-[0.1em] cursor-not-allowed"
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
                    href={`/superadmin?page=${currentPage + 1}`}
                    className="px-4 py-2 rounded-lg border border-[#d4af37]/30 text-[#d4af37] text-sm tracking-[0.1em] hover:bg-[#d4af37]/10 transition-colors"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    Next &#9654;
                  </Link>
                ) : (
                  <span className="px-4 py-2 rounded-lg border border-[#d4af37]/10 text-[#d4af37]/30 text-sm tracking-[0.1em] cursor-not-allowed"
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

export default SuperadminPage;
