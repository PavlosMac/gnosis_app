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

  const buildNextTags = (base: string[], rawTags: string[]) => {
    const next = [...base];
    let rejected: string | null = null;
    for (const raw of rawTags) {
      const tag = raw.trim().toLowerCase();
      if (!tag) continue;
      if (next.length >= MAX_TAGS_PER_READING) continue;
      if (tag.length > MAX_TAG_LENGTH) {
        rejected = "tags should be comma separated";
        continue;
      }
      if (next.includes(tag)) continue;
      next.push(tag);
    }
    return { next, rejected };
  };

  const commitTags = (rawTags: string[]) => {
    const { next, rejected } = buildNextTags(draft, rawTags);
    setDraft(next);
    setError(rejected);
  };

  const handleInputChange = (value: string) => {
    if (value.includes(",")) {
      const parts = value.split(",");
      const last = parts.pop() ?? "";
      commitTags(parts);
      setInput(last);
      return;
    }
    setInput(value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTags([input]);
      setInput("");
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!pasted.includes(",")) return;
    e.preventDefault();
    commitTags(pasted.split(","));
    setInput("");
  };

  const save = async () => {
    const { next: tagsToSave, rejected } = buildNextTags(draft, input ? [input] : []);
    if (rejected) {
      setError(rejected);
      return;
    }

    setSaving(true);
    setError(null);
    const result = await updateReadingTags(readingId, tagsToSave);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTags(result.data.tags);
    setInput("");
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
            disabled={saving}
            className="w-7 h-7 rounded-full border border-[#d4af37]/50 text-[#d4af37]/70
                       hover:text-[#d4af37] hover:border-[#d4af37]
                       hover:shadow-[0_0_10px_rgba(212,175,55,0.4)]
                       transition-all duration-300 flex items-center justify-center text-sm disabled:opacity-50"
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
