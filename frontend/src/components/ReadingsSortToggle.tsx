import Link from "next/link";
import { dateToggleTarget, isOldestFirst, listHref } from "@/lib/reading-list-context";
import type { ListContext } from "@/lib/reading-list-context";

/**
 * A quiet one-line sort toggle above the list: one link that flips the date
 * order. A plain link, so the order lives in the URL and any change returns to
 * page 1. scroll={false}: Next scrolls to the top of a changed page segment by
 * default, and the whole page changes here — a reorder should not move the view.
 */
const ReadingsSortToggle = ({ ctx }: { ctx: ListContext }) => {
  const oldestFirst = isOldestFirst(ctx.sort);
  const current = oldestFirst ? "Oldest first" : "Newest first";

  return (
    <nav
      aria-label="Sort readings"
      className="flex items-center justify-end mb-3 text-xs sm:text-sm tracking-wide"
      style={{ fontFamily: "'Crimson Pro', serif" }}
    >
      <Link
        href={listHref({ ...ctx, page: 1, sort: dateToggleTarget(ctx.sort) })}
        scroll={false}
        aria-label={`Sorted ${current.toLowerCase()}. Switch to ${oldestFirst ? "newest" : "oldest"} first`}
        className="text-[#d4af37]/80 hover:text-[#d4af37] transition-colors"
      >
        {current}{" "}
        <span aria-hidden="true">{oldestFirst ? "\u2191" : "\u2193"}</span>
      </Link>
    </nav>
  );
};

export default ReadingsSortToggle;
