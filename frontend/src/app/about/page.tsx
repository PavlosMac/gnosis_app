import type { Metadata } from "next";
import Link from "next/link";
import TarotPageLayout from "@/components/TarotPageLayout";
import ArticleSection from "@/components/ArticleSection";
import AboutSpreadList from "@/components/AboutSpreadList";
import SignificatorPositionCards from "@/components/SignificatorPositionCards";
import TreeOfLifeDiagram from "@/components/TreeOfLifeDiagram";
import { TREE_PATHS, aboutSpreads, significatorPositions, treeOfLifeNodes } from "@/lib/about-content";

export const metadata: Metadata = {
  title: "About | Tarot Divinations",
  description:
    "What Tarot Divinations offers: the Reading Oracle and its spreads, the Readings Journal, Oracle interpretations, your Significators and the Tree of Life.",
};

const BODY_FONT = { fontFamily: "'Crimson Pro', serif" } as const;
const HEADING_FONT = { fontFamily: "'Cinzel', serif" } as const;

const Body: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-4 text-[#e6d5b8]/90 leading-relaxed" style={BODY_FONT}>
    {children}
  </div>
);

const P: React.FC<{ children: React.ReactNode; aside?: boolean }> = ({ children, aside = false }) => (
  <p className={`text-lg sm:text-xl${aside ? " italic text-[#e6d5b8]/70" : ""}`}>{children}</p>
);

const Callout: React.FC<{ label: string; items: string[] }> = ({ label, items }) => (
  <div className="mt-6 p-4 border border-[#d4af37]/30 rounded-lg bg-[#1a0033]/50">
    <p className="text-[#d4af37]/80 text-sm uppercase tracking-widest mb-2" style={HEADING_FONT}>
      {label}
    </p>
    <ul className="list-disc list-inside space-y-2 text-[#e6d5b8]/80 text-lg" style={BODY_FONT}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  </div>
);

const INLINE_LINK = "text-[#d4af37] hover:text-[#ffd700] underline underline-offset-2";

export default function AboutPage() {
  const spreads = aboutSpreads();
  const drawnSpreads = spreads.filter((s) => s.cardCount !== null).length;

  return (
    <TarotPageLayout scrollable>
      <div className="w-full max-w-3xl mx-auto">
        {/* Page header */}
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#d4af37] tracking-wider mb-4"
            style={{ ...HEADING_FONT, textShadow: "0 0 30px rgba(212,175,55,0.4)" }}
          >
            About Tarot Divinations
          </h1>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-[#d4af37]" />
            <span className="text-[#d4af37] text-xl">☥</span>
            <div className="w-24 h-px bg-gradient-to-l from-transparent via-[#d4af37]/60 to-[#d4af37]" />
          </div>
          <p
            className="text-[#e6d5b8]/70 text-lg sm:text-xl mt-6 max-w-2xl mx-auto leading-relaxed"
            style={BODY_FONT}
          >
            What the platform offers, and why it was built
          </p>
        </div>

        <ArticleSection framed title="A Decade of Investigation" symbol="✧">
          <Body>
            <P>
              Tarot Divinations is the culmination of a decade-long investigation into the Tarot.
              Much inspiration to build this platform has come from Michael Tsarion&apos;s{" "}
              <span className="text-[#d4af37]">Path of the Fool</span>, his take on the 78-card deck.
              This is a &lsquo;spirit tooling&rsquo; platform, architected to encourage a person to
              take and reflect on their life through the perspective of the authentic Self.
            </P>
            <P>
              The Tarot offers us a symbolically rich tapestry on which to map the soul&apos;s path
              through life. Creating spreads and pulling cards is a way to mirror the subconscious.
              We offer this platform where you can make many readings and get
              interpretive data quickly.
            </P>
            <P>
              Once you have made a reading and saved it, you can send the spread to the LLM, which
              returns the interpretation in text form within seconds, or up to a minute for the
              bigger spreads. The <span className="text-[#d4af37]">Oracle Interpretation</span> is
              the core of our platform. We save it for you to view again whenever you please. The
              complementary feature is the Readings database: many readings, at lightning speed,
              using AI, yes.
            </P>
            <P>
              Instructions on how to use the oracle are given{" "}
              <Link href="/guide" className={INLINE_LINK}>
                here
              </Link>
              , but are more suggestions on best practices.
              We encourage our users to build their own rituals for using our Reading Oracle.
              Certain cards appear multiple times in different spreads, giving you a
              unique perspective on the queries you make. You will begin to experience
              real magic when this happens.
            </P>
            <P aside>
              It might be easy to disregard AI when it comes to divination. Our hope is that offering a service
              where users can get reading material interpreted quickly and accurately will encourage them to deepen their
              interest in the divination arts.
            </P>
          </Body>
        </ArticleSection>

        <ArticleSection framed title="The Product" symbol="☥">
          <Callout
            label="What you get"
            items={[
              `The Reading Oracle, with ${drawnSpreads} spreads and the Significators chart calculator`,
              "A Readings Journal with tags and filtering",
              "Oracle interpretations written by a large language model (including the Significators chart)",
              "User login and account settings",
            ]}
          />
        </ArticleSection>

        <ArticleSection framed title="The Reading Oracle" symbol="✦">
          <Body>
            <P>
              <span className="text-[#d4af37]">A truly random shuffle.</span> Our shuffle module
              uses your machine&apos;s entropy. This is done with the browser&apos;s own
              cryptographic library, which draws on your device&apos;s pool of physical
              unpredictability. It works the way drawing names from a hat does: each card has an
              equal chance of landing in every position. No one can predict the order, not even
              us. Give your subconscious the best conditions to pick the cards it wants you to see.
            </P>
            <P>
              The Reading Oracle offers {drawnSpreads} spreads. You can choose whether some cards
              may appear reversed, or none, and for the open-question spreads you can add your
              question.
            </P>
          </Body>
          <div className="mt-6">
            <AboutSpreadList spreads={spreads} />
          </div>
        </ArticleSection>

        <ArticleSection framed title="Readings Journal" symbol="☾">
          <Body>
            <P>
              Every reading you save lands in your journal, where patterns start to show.
            </P>
          </Body>
          <Callout
            label="In the journal"
            items={[
              "Tag your favourite readings (great for pattern observability)",
              "Paginate and filter on spread type, birth date and tags; sort on date created",
              "Your readings are kept in a safeguarded database: no cloud, no big US tech. A pre-disclosed European location under the safekeeping of the maintainer of this project",
            ]}
          />
        </ArticleSection>

        <ArticleSection framed title="Oracle Interpretations" symbol="☉">
          <Body>
            <P>
              After much experimentation we are happy with the ability of OpenAI&apos;s GPT models
              to synthesise card data into meaningful interpretations. Frontier models are trained
              on vast datasets, and this includes occult and esoteric material.
            </P>
            <P>
              Although we are not in favour of using AI everywhere, we found that it can give high value reading
              interpretations, both in text quality and speed. So this is what we use for our Oracle Interpretations data.
              However, we would like to remind users that receiving a reading synthesis from a person will never measure
              against an interpretation from an LLM and hence our interpretations should be taken with &lsquo;a pinch of salt&rsquo;.
            </P>
            <P>
              It&apos;s up to users to deduce the meaning from the interpretations in an effort to eventually and
              ultimately become the true Reader of their own spreads. Quick reading information,
              not a wait of days, is the core of our platform: curate meaningful readings, see the
              patterns and experience the magic.
            </P>
          </Body>
        </ArticleSection>

        <ArticleSection framed title="Significators" symbol="⚝">
          <Body>
            <P>
              The Significators spread is the personal Tarot chart and takes a birthday as its
              input. From that particular day we can deduce a number of significant cards which
              reference core character, challenges, strengths and destiny. Like an astrological
              chart, the Significators chart highlights the attributes and personal traits of the
              person born on that day.
            </P>
            <P>
              When using the Tarot it is important to know the significators of the people a
              reading concerns, including the querent&apos;s own. Their significators may show up,
              and if they do, more meaning should be given to that reading.
            </P>
          </Body>
          <div className="mt-6">
            <SignificatorPositionCards positions={significatorPositions()} />
          </div>
          <p className="mt-4 text-lg sm:text-xl text-[#e6d5b8]/80" style={BODY_FONT}>
            <Link href="/significators" className={INLINE_LINK}>
              Calculate your own significators
            </Link>
            .
          </p>
        </ArticleSection>

        <ArticleSection framed title="Tree of Life" symbol="✦">
          <Body>
            <P>
              This reading is the classic Kabbalistic spread, offering eleven sephiroth and one
              card for each. The zones sent for interpretation are the named sephiroth. The Tree
              of Life reading gives important information about past, present and future
              influences, and can be considered a divination art of its own. Eleven perspectives,
              with rich enigmatic Tarot imagery and symbolism, make this spread a particularly
              powerful player.
            </P>
            <P aside>Select a sephira on the tree to read what that zone covers.</P>
          </Body>
          <div className="mt-6">
            <TreeOfLifeDiagram nodes={treeOfLifeNodes()} paths={TREE_PATHS} />
          </div>
        </ArticleSection>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            href="/reading"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-lg
                      border border-[#d4af37]/40 bg-gradient-to-r from-[#d4af37]/10 to-transparent
                      hover:border-[#d4af37] hover:bg-[#d4af37]/20
                      transition-all duration-500"
          >
            <span
              className="text-sm text-[#d4af37] tracking-widest uppercase hover:text-[#ffd700] transition-colors"
              style={HEADING_FONT}
            >
              Consult the Oracle
            </span>
            <span className="text-xl text-[#d4af37]">→</span>
          </Link>
        </div>

        {/* Footer decoration */}
        <div className="mt-16 text-center">
          <div className="flex items-center justify-center gap-3">
            <span className="text-[#d4af37]/40">✦</span>
            <span className="text-[#d4af37]/30">✦</span>
            <span className="text-[#d4af37]/40">☥</span>
            <span className="text-[#d4af37]/30">✦</span>
            <span className="text-[#d4af37]/40">✦</span>
          </div>
        </div>
      </div>
    </TarotPageLayout>
  );
}
