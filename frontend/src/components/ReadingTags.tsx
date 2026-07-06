"use client";

import { useState } from "react";
import type { KeyboardEvent, ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { updateReadingTags } from "@/app/user/readings/[id]/actions";
import { MAX_TAGS_PER_READING, MAX_TAG_LENGTH } from "@/lib/validation/reading-schemas";

interface ReadingTagsProps {
  readingId: string;
  initialTags: string[];
}

const ReadingTags = ({ readingId, initialTags }: ReadingTagsProps) => {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(tags);
    setInput("");
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setInput("");
    setError(null);
  };

  const removeDraftTag = (tag: string) => {
    setDraft((prev) => prev.filter((t) => t !== tag));
    setError(null);
  };

  const commitTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    if (draft.length >= MAX_TAGS_PER_READING) return;
    if (tag.length > MAX_TAG_LENGTH) {
      setError("tags should be comma separated");
      return;
    }
    if (draft.includes(tag)) return;
    setDraft((prev) => [...prev, tag]);
    setError(null);
  };

  const handleInputChange = (value: string) => {
    if (value.includes(",")) {
      const parts = value.split(",");
      const last = parts.pop() ?? "";
      parts.forEach(commitTag);
      setInput(last);
      return;
    }
    setInput(value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTag(input);
      setInput("");
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!pasted.includes(",")) return;
    e.preventDefault();
    pasted.split(",").forEach(commitTag);
    setInput("");
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await updateReadingTags(readingId, draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTags(result.data.tags);
    setEditing(false);
    router.refresh();
  };

  const atMax = draft.length >= MAX_TAGS_PER_READING;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {(editing ? draft : tags).map((tag) => (
        <span
          key={tag}
          className={
            editing
              ? "flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/60 text-[#e6d5b8]/80 text-xs tracking-wide"
              : "px-3 py-1 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/60 text-[#e6d5b8]/80 text-xs tracking-wide"
          }
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          {tag}
          {editing && (
            <button
              type="button"
              onClick={() => removeDraftTag(tag)}
              aria-label={`Remove ${tag}`}
              className="w-4 h-4 rounded-full text-[#d4af37]/60 hover:text-[#d4af37] hover:bg-[#d4af37]/10 flex items-center justify-center leading-none"
            >
              ×
            </button>
          )}
        </span>
      ))}

      {editing && (
        <input
          type="text"
          value={input}
          disabled={atMax}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={atMax ? "Max 5 tags" : "Add a tag…"}
          className="px-3 py-1 rounded-full border border-[#d4af37]/30 bg-[#1a0033]/40 text-[#e6d5b8] text-xs
                     placeholder-[#e6d5b8]/30 focus:outline-none focus:border-[#d4af37]/60 disabled:opacity-50"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        />
      )}

      {editing ? (
        <>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-7 h-7 rounded-full border border-[#d4af37]/50 text-[#d4af37]/70
                       hover:text-[#d4af37] hover:border-[#d4af37]
                       hover:shadow-[0_0_10px_rgba(212,175,55,0.4)]
                       transition-all duration-300 flex items-center justify-center text-sm disabled:opacity-50"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={cancelEditing}
            className="w-7 h-7 rounded-full border border-[#d4af37]/50 text-[#d4af37]/70
                       hover:text-[#d4af37] hover:border-[#d4af37]
                       hover:shadow-[0_0_10px_rgba(212,175,55,0.4)]
                       transition-all duration-300 flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="w-7 h-7 rounded-full border border-[#d4af37]/50 text-[#d4af37]/70
                     hover:text-[#d4af37] hover:border-[#d4af37]
                     hover:shadow-[0_0_10px_rgba(212,175,55,0.4)]
                     transition-all duration-300 flex items-center justify-center text-sm"
        >
          +
        </button>
      )}

      {error && (
        <p className="w-full text-xs text-red-400/80" style={{ fontFamily: "'Crimson Pro', serif" }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default ReadingTags;
