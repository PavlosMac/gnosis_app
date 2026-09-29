"use client";

import { useRouter } from "next/navigation";
import { PAGE_SIZE_OPTIONS, listHref, pageSizeOf } from "@/lib/reading-list-context";
import type { ListContext } from "@/lib/reading-list-context";

/**
 * A deliberately quiet page-size picker for the far right of the pagination row.
 * A native select keeps it small, keyboard- and touch-friendly; appearance is
 * reset and the caret drawn here so Safari and Chrome render it alike.
 */
const PageSizeSelect = ({ ctx }: { ctx: ListContext }) => {
  const router = useRouter();

  return (
    <label
      className="inline-flex items-center gap-2 text-[#e6d5b8]/40 text-xs sm:text-sm"
      style={{ fontFamily: "'Crimson Pro', serif" }}
    >
      <span>Per page</span>
      <span className="relative inline-flex items-center">
        <select
          value={pageSizeOf(ctx)}
          // scroll: false — resizing the page should not jump the view to the top
          onChange={(e) =>
            router.push(listHref({ ...ctx, page: 1, pageSize: Number(e.target.value) }), {
              scroll: false,
            })
          }
          className="cursor-pointer rounded-md border border-[#d4af37]/15 bg-transparent
                     py-1.5 pl-3 pr-8 text-xs sm:text-sm text-[#e6d5b8]/60
                     hover:border-[#d4af37]/40 hover:text-[#e6d5b8]/90
                     focus:outline-none focus:border-[#d4af37]/60 transition-colors"
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            colorScheme: "dark",
            fontFamily: "'Crimson Pro', serif",
          }}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 text-xs text-[#d4af37]/50"
        >
          &#9662;
        </span>
      </span>
    </label>
  );
};

export default PageSizeSelect;
