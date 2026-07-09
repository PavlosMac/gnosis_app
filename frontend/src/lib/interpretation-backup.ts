import type { Interpretation } from "@/types/interpret";

const backupKey = (readingId: string) => `interpretation-backup:${readingId}`;

export const writeInterpretationBackup = (
  readingId: string,
  interpretation: Interpretation
): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(backupKey(readingId), JSON.stringify(interpretation));
  } catch {
    // best-effort per spec: storage full/blocked means no backup, never a failed save
  }
};

export const readInterpretationBackup = (
  readingId: string
): Interpretation | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(backupKey(readingId));
    return raw ? (JSON.parse(raw) as Interpretation) : null;
  } catch {
    return null;
  }
};
