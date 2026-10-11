import React from "react";

export interface ArticleSectionProps {
  title: string;
  symbol?: string;
  /** Put the body on the same panel the saved-reading page uses for its interpretation */
  framed?: boolean;
  children: React.ReactNode;
}

// Same panel as InterpretationSection on /user/readings/[id].
const FRAME_CLASS =
  "rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-8";

/** Article section heading with gradient rules, as used by the guide page. */
const ArticleSection: React.FC<ArticleSectionProps> = ({ title, symbol = "✦", framed = false, children }) => {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#d4af37]/50" />
        <span className="text-[#d4af37]/60">{symbol}</span>
        <h2
          className="text-xl sm:text-2xl text-[#d4af37] tracking-wider text-center"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {title}
        </h2>
        <span className="text-[#d4af37]/60">{symbol}</span>
        <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#d4af37]/50" />
      </div>
      {framed ? <div className={FRAME_CLASS}>{children}</div> : children}
    </div>
  );
};

export default ArticleSection;
