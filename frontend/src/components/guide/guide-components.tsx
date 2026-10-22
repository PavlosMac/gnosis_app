import type React from "react";
import type { MDXComponents } from "mdx/types";
import Shot from "@/components/guide/Shot";

// Elements only the guide chapters use. They are passed to the chapter body as its
// `components` prop, not added to the shared map in src/mdx-components.tsx, so the
// legal documents (versioned, shown exactly as accepted) never pick up their styling.
const HEADING = { fontFamily: "'Cinzel', serif" } as const;

/** Gold-highlighted phrase inside a paragraph */
const Gold = ({ children }: { children: React.ReactNode }) => <span className="text-[#d4af37]">{children}</span>;

/** Boxed aside with a small-caps label, used for tips, examples and cross-links */
const Callout = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div
    className="border border-[#d4af37]/30 rounded-lg bg-[#1a0033]/50"
    style={{ padding: "1rem", margin: "1.5rem 0" }}
  >
    <p
      className="text-[#d4af37]/80 text-sm uppercase tracking-widest"
      style={{ ...HEADING, marginBottom: "0.5rem" }}
    >
      {title}
    </p>
    <div className="text-[#e6d5b8]/80">{children}</div>
  </div>
);

export const guideComponents: MDXComponents = {
  h3: ({ children }) => (
    <h4
      className="text-base text-[#d4af37]/80 tracking-wide"
      style={{ ...HEADING, marginTop: "1.5rem", marginBottom: "0.5rem" }}
    >
      {children}
    </h4>
  ),
  blockquote: ({ children }) => (
    <blockquote
      className="text-[#e6d5b8]/70 italic"
      style={{ borderLeft: "2px solid rgba(212,175,55,0.4)", paddingLeft: "1rem", margin: "1rem 0" }}
    >
      {children}
    </blockquote>
  ),
  Gold,
  Callout,
  Shot,
};
