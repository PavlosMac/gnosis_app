"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import OrnateFrame from "@/components/OrnateFrame";

/*
 * The shared chrome of every dialog: portal, body scroll-lock, Escape-to-close,
 * blurred backdrop, gradient panel with ornate corners, and the sticky header
 * with title + close button. Callers render only their own body.
 */

const PANEL_BACKGROUND = {
  background: "linear-gradient(135deg, rgba(26,0,51,0.97) 0%, rgba(45,27,78,0.97) 100%)",
} as const;

const HEADER_BACKGROUND = {
  background: "linear-gradient(135deg, rgba(26,0,51,0.98) 0%, rgba(45,27,78,0.98) 100%)",
} as const;

const PANEL_SIZE = {
  /** Forms: fixed width, grows with content */
  sm: "max-w-md",
  /** Long content: wider and scrolls inside the panel */
  lg: "max-w-3xl max-h-[calc(100vh-4rem)] overflow-y-auto",
} as const;

interface SanctumModalProps {
  title: string;
  /** Muted line under the title, e.g. the spread name */
  subtitle?: React.ReactNode;
  size?: keyof typeof PANEL_SIZE;
  onClose: () => void;
  children: React.ReactNode;
}

const SanctumModal = ({ title, subtitle, size = "sm", onClose, children }: SanctumModalProps) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center isolate"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-0" onClick={onClose} />

      <div
        className={`relative z-10 w-full mx-4 my-8 ${PANEL_SIZE[size]} rounded-xl border-2 border-[#d4af37]/40 shadow-2xl`}
        style={PANEL_BACKGROUND}
        onClick={(e) => e.stopPropagation()}
      >
        <OrnateFrame size="sm" corners="top" />

        <div
          className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-[#d4af37]/20"
          style={HEADER_BACKGROUND}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <h2
              className="text-xl sm:text-2xl font-bold text-[#d4af37] tracking-wider"
              style={{
                fontFamily: "'Cinzel', serif",
                textShadow: "0 0 15px rgba(212,175,55,0.4)",
              }}
            >
              ✦ {title} ✦
            </h2>
            {subtitle && (
              <p
                className="text-xs sm:text-sm text-[#d4af37]/70 tracking-wide truncate"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-[#d4af37]/60 hover:text-[#d4af37] transition-colors text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default SanctumModal;
