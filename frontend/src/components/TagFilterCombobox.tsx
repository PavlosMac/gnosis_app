"use client";

import { useState } from "react";
import type { KeyboardEvent, ClipboardEvent } from "react";
import type { TagSummary } from "@/types/reading";
import { filterTagSuggestions } from "@/lib/tag-suggestions";

interface TagFilterComboboxProps {
  availableTags: TagSummary[];
  selectedTags: string[];
  input: string;
  onSelectedTagsChange: (tags: string[]) => void;
  onInputChange: (value: string) => void;
}

const TagFilterCombobox = ({
  availableTags,
  selectedTags,
  input,
  onSelectedTagsChange,
  onInputChange,
}: TagFilterComboboxProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestions = filterTagSuggestions(availableTags, selectedTags, input);

  const commitTags = (rawTags: string[]) => {
    const next = [...selectedTags];
    for (const raw of rawTags) {
      const tag = raw.trim().toLowerCase();
      if (!tag || next.includes(tag)) continue;
      next.push(tag);
    }
    onSelectedTagsChange(next);
    onInputChange("");
    setHighlightedIndex(-1);
  };

  const removeTag = (tag: string) => {
    onSelectedTagsChange(selectedTags.filter((t) => t !== tag));
  };

  const handleInputChange = (value: string) => {
    if (value.includes(",")) {
      const parts = value.split(",");
      const last = parts.pop() ?? "";
      commitTags(parts);
      onInputChange(last);
    } else {
      onInputChange(value);
    }
    setDropdownOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setDropdownOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setHighlightedIndex((prev) =>
        Math.min(Math.max(prev + delta, -1), suggestions.length - 1)
      );
      return;
    }
    if (e.key === "Enter") {
      // Never let Enter bubble into an Apply — it commits a tag or does nothing
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        commitTags([suggestions[highlightedIndex].name]);
      } else if (input.trim()) {
        commitTags([input]);
      }
      return;
    }
    if (e.key === "Escape") {
      setDropdownOpen(false);
      setHighlightedIndex(-1);
      return;
    }
    if (e.key === "Backspace" && !input && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!pasted.includes(",")) return;
    e.preventDefault();
    commitTags(pasted.split(","));
  };

  const showDropdown = dropdownOpen && suggestions.length > 0;

  return (
    <div className="relative">
      <div
        className="flex flex-wrap items-center gap-2 w-full px-3 py-2 rounded-lg bg-[#0a0015]/60 border border-[#d4af37]/20
                   focus-within:border-[#d4af37]/60 focus-within:ring-1 focus-within:ring-[#d4af37]/20
                   transition-all duration-300"
      >
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1.5 pl-3 sm:pl-4 pr-1.5 sm:pr-2 py-1 sm:py-1.5 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/60 text-[#e6d5b8]/80 text-xs sm:text-sm tracking-wide"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="w-5 h-5 rounded-full text-[#d4af37]/60 hover:text-[#d4af37] hover:bg-[#d4af37]/10 flex items-center justify-center leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="tags-filter"
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="tags-filter-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 ? `tags-filter-option-${highlightedIndex}` : undefined
          }
          autoComplete="off"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => {
            setDropdownOpen(false);
            setHighlightedIndex(-1);
          }}
          placeholder={availableTags.length > 0 ? "Type to search tags…" : "career, love"}
          className="flex-1 min-w-[8rem] py-1 bg-transparent text-[#e6d5b8] placeholder-[#e6d5b8]/20 text-sm focus:outline-none"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        />
      </div>

      {showDropdown && (
        <ul
          id="tags-filter-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-lg
                     border border-[#d4af37]/50 py-1 shadow-[0_0_20px_rgba(212,175,55,0.25)]"
          // Background inline, not a Tailwind class: the dev server's CSS
          // regeneration intermittently misses newly-introduced utilities,
          // which turned this panel fully transparent.
          style={{
            zIndex: 50,
            backgroundColor: "#e6d5b8",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div className="h-px mx-3 mb-1 bg-gradient-to-r from-transparent via-[#b8942f]/50 to-transparent" />
          {suggestions.map((tag, i) => (
            <li
              key={tag.name}
              id={`tags-filter-option-${i}`}
              role="option"
              aria-selected={i === highlightedIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commitTags([tag.name])}
              onMouseEnter={() => setHighlightedIndex(i)}
              className="flex items-center justify-between px-4 py-2 text-sm cursor-pointer transition-colors duration-200"
              // Colors inline (same dev-CSS staleness guard as the panel bg)
              style={{
                fontFamily: "'Crimson Pro', serif",
                color: "#000",
                backgroundColor:
                  i === highlightedIndex ? "rgba(212, 175, 55, 0.4)" : "transparent",
              }}
            >
              {tag.name}
              <span className="text-xs" style={{ color: "rgba(0, 0, 0, 0.5)" }}>
                {tag.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TagFilterCombobox;
