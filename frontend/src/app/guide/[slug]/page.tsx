import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TarotPageLayout from "@/components/TarotPageLayout";
import ArticleSection from "@/components/ArticleSection";
import { guideComponents } from "@/components/guide/guide-components";
import { GUIDE_BODIES } from "@/content/guide";
import { GUIDE_CHAPTERS, adjacentChapters, getChapter, type GuideChapter } from "@/lib/guide-chapters";

interface GuideChapterPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export const generateStaticParams = () => GUIDE_CHAPTERS.map(({ slug }) => ({ slug }));

export const generateMetadata = async ({ params }: GuideChapterPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const chapter = getChapter(slug);
  return chapter ? { title: `${chapter.title} | Guide | Tarot Divinations`, description: chapter.summary } : {};
};

const HEADING_FONT = { fontFamily: "'Cinzel', serif" } as const;
const BODY_FONT = { fontFamily: "'Crimson Pro', serif" } as const;
const NAV_LINK =
  "flex-1 rounded-lg border border-[#d4af37]/20 px-4 py-3 text-[#d4af37]/80 hover:text-[#d4af37] hover:border-[#d4af37]/60 transition-colors";

const ChapterLink = ({ chapter, direction }: { chapter: GuideChapter; direction: "prev" | "next" }) => (
  <Link
    href={`/guide/${chapter.slug}`}
    className={`${NAV_LINK} ${direction === "next" ? "text-right" : "text-left"}`}
    style={HEADING_FONT}
  >
    <span className="block text-xs tracking-widest uppercase text-[#e6d5b8]/50">
      {direction === "prev" ? "← Previous" : "Next →"}
    </span>
    <span className="block text-sm tracking-wide">{chapter.title}</span>
  </Link>
);

/** One chapter of the guide (public) */
const GuideChapterPage = async ({ params }: GuideChapterPageProps) => {
  const { slug } = await params;
  const chapter = getChapter(slug);
  const Body = GUIDE_BODIES[slug];
  if (!chapter || !Body) notFound();
  const { prev, next } = adjacentChapters(slug);

  return (
    <TarotPageLayout backButtonHref="/guide" backButtonLabel="Guide" scrollable>
      <div className="w-full max-w-3xl mx-auto mt-8 sm:mt-12">
        <h1 className="sr-only">{chapter.title}</h1>
        <ArticleSection framed title={chapter.title} symbol={chapter.symbol}>
          {chapter.requiresAccount && (
            <p className="text-[#e6d5b8]/50 text-sm italic" style={{ ...BODY_FONT, marginBottom: "1rem" }}>
              This chapter walks through pages that need an account.
            </p>
          )}
          <Body components={guideComponents} />
        </ArticleSection>

        <nav aria-label="Guide chapters" className="flex flex-col sm:flex-row gap-3 mb-12">
          {prev ? <ChapterLink chapter={prev} direction="prev" /> : <span className="flex-1" />}
          {next ? <ChapterLink chapter={next} direction="next" /> : <span className="flex-1" />}
        </nav>
      </div>
    </TarotPageLayout>
  );
};

export default GuideChapterPage;
