import Link from "next/link";
import type { MDXComponents } from "mdx/types";

// Typography shared by all MDX content (legal documents and guide chapters; the
// guide adds its own elements in components/guide/guide-components.tsx). Layout-critical
// spacing is inline: a long-running dev server can miss newly introduced
// Tailwind utilities (ADR-008), and these pages must never render unspaced.
const HEADING = { fontFamily: "'Cinzel', serif" } as const;
const BODY = { fontFamily: "'Crimson Pro', serif" } as const;

const components: MDXComponents = {
  h1: ({ children }) => (
    <h2
      className="text-xl text-[#d4af37] tracking-wider"
      style={{ ...HEADING, marginTop: "2rem", marginBottom: "0.75rem" }}
    >
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3
      className="text-lg text-[#d4af37]/90 tracking-wide"
      style={{ ...HEADING, marginTop: "2rem", marginBottom: "0.75rem" }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      className="text-[#e6d5b8]/85 text-base leading-relaxed"
      style={{ ...BODY, marginBottom: "1rem" }}
    >
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul
      className="text-[#e6d5b8]/85 text-base leading-relaxed"
      style={{ ...BODY, listStyleType: "disc", paddingLeft: "1.5rem", marginBottom: "1rem" }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      className="text-[#e6d5b8]/85 text-base leading-relaxed"
      style={{ ...BODY, listStyleType: "decimal", paddingLeft: "1.5rem", marginBottom: "1rem" }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => <li style={{ marginBottom: "0.5rem" }}>{children}</li>,
  strong: ({ children }) => <strong className="text-[#e6d5b8] font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="text-[#d4af37]/90 text-sm" style={{ wordBreak: "break-all" }}>
      {children}
    </code>
  ),
  a: ({ href, children }) => {
    const className =
      "text-[#d4af37]/80 hover:text-[#d4af37] underline underline-offset-4 transition-colors";
    // In-site links navigate client-side; everything else (http, mailto, #anchors) stays a plain anchor
    if (href?.startsWith("/") && !href.startsWith("//")) {
      return (
        <Link href={href} className={className}>
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className={className}
        {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
};

export const useMDXComponents = (): MDXComponents => components;
