"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import TarotCard from "./TarotCard";
import { TAROT_DECK, TAROT_MAP } from "@/lib/cards";

const REFRESH_INTERVAL = 30000; // 30 seconds

// Numerology: reduce to single digit root
const getRoot = (n: number): number => {
  while (n > 9) {
    n = String(n).split('').reduce((a, b) => a + Number(b), 0);
  }
  return n;
};

// Get all Major Arcana cards that share the same numerological root
const getRelatedMajorArcana = (cardIdx: number): number[] => {
  const root = getRoot(cardIdx);
  const related = TAROT_MAP.majorArcana
    .map(card => card.idx)
    .filter(idx => getRoot(idx) === root);
  return related.sort((a, b) => a - b);
};

// Get random card from array
const getRandomCard = (cards: typeof TAROT_DECK) => {
  return cards[Math.floor(Math.random() * cards.length)];
};

interface AnimatedCardSectionProps {
  cards: typeof TAROT_DECK;
  interval: number;
  showRelated?: boolean;
}

const AnimatedCardSection: React.FC<AnimatedCardSectionProps> = ({
  cards,
  interval,
  showRelated = false,
}) => {
  const [displayCards, setDisplayCards] = useState<typeof TAROT_DECK>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const refreshCards = useCallback(() => {
    setIsTransitioning(true);
    transitionTimeoutRef.current = setTimeout(() => {
      const selectedCard = getRandomCard(cards);
      if (showRelated) {
        const relatedIndices = getRelatedMajorArcana(selectedCard.idx);
        setDisplayCards(relatedIndices.map(idx => TAROT_DECK[idx]));
      } else {
        setDisplayCards([selectedCard]);
      }
      setIsTransitioning(false);
    }, 300);
  }, [cards, showRelated]);

  useEffect(() => {
    refreshCards();
    const timer = setInterval(refreshCards, interval);
    return () => {
      clearInterval(timer);
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [refreshCards, interval]);

  return (
    <div
      className={`flex flex-row gap-4 justify-center items-start flex-wrap transition-opacity duration-500
                  ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
    >
      {displayCards.map((card, i) => (
        <div key={`${card.idx}-${i}`} className="flex flex-col items-center">
          <TarotCard card={card} small={false} showMeaning={false} />
        </div>
      ))}
    </div>
  );
};

interface SectionProps {
  title: string;
  symbol?: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, symbol = "✦", children }) => {
  return (
    <div className="mb-16">
      {/* Section header */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="w-16 h-px bg-gradient-to-r from-transparent to-[#d4af37]/50" />
        <span className="text-[#d4af37]/60">{symbol}</span>
        <h2
          className="text-2xl sm:text-3xl text-[#d4af37] tracking-wider text-center"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {title}
        </h2>
        <span className="text-[#d4af37]/60">{symbol}</span>
        <div className="w-16 h-px bg-gradient-to-l from-transparent to-[#d4af37]/50" />
      </div>
      {children}
    </div>
  );
};

const TarotChart: React.FC = () => {
  // Memoize the card arrays to prevent unnecessary re-renders
  const majorArcana = useMemo(() => TAROT_MAP.majorArcana, []);
  const minorArcana = useMemo(() => TAROT_MAP.minorArcana, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="text-center mb-16">
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#d4af37] tracking-wider mb-4"
          style={{
            fontFamily: "'Cinzel', serif",
            textShadow: "0 0 30px rgba(212,175,55,0.4)",
          }}
        >
          Your Tarot Chart
        </h1>
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-[#d4af37]" />
          <span className="text-[#d4af37] text-xl">☥</span>
          <div className="w-24 h-px bg-gradient-to-l from-transparent via-[#d4af37]/60 to-[#d4af37]" />
        </div>
      </div>

      {/* Introduction */}
      <Section title="Personal Significators" symbol="⚝">
        <div className="space-y-6 text-[#e6d5b8]/90 leading-relaxed" style={{ fontFamily: "'Crimson Pro', serif" }}>
          <p className="text-lg sm:text-xl">
            The Taroscopic System is an esoteric framework that unites Astrology, Tarot, Kabbalah,
            and Numerology into a single, coherent method of divination. At its core lie the
            Decanates and Personal Significators - concepts rarely discussed in conventional Tarot
            literature, yet essential for accurate and meaningful readings.
          </p>
          <p className="text-lg sm:text-xl">
            Significators function as a personal chart, revealing character, destiny, and life
            cycles with a depth comparable to an astrological horoscope. Personal Significators
            are Tarot cards that specifically represent an individual. They act as symbolic
            &ldquo;personal mandalas,&rdquo; encoding both positive and challenging aspects of personality,
            as well as broader patterns of fate.
          </p>
                    <p className="text-lg sm:text-xl">
            The importance of Significators became evident through long-term observation. When
            reviewing past Tarot readings, it was discovered that Personal Significator cards
            frequently appeared in spreads, often in prominent positions, without being recognized
            as such by readers. As a result, much vital information was overlooked.
          </p>
                    <p className="text-lg sm:text-xl">
            This insight led to the understanding that only a fraction of a reading&apos;s potential
            meaning is accessed when Significators are ignored. In professional practice, a
            Taroscopic Chart is created for each client prior to a reading. This process
            identifies their Personal Significators, which are then expected to emerge during
            the session.
          </p>
                    <p className="text-lg sm:text-xl">
            When Significators appear in readings, they offer direct and highly specific insight.
            In fact, readings can be performed using Significators alone, without traditional
            spreads, making them especially valuable for beginners and advanced practitioners alike.
          </p>
          <p className="text-lg sm:text-xl">
            There are three primary reasons Significators are indispensable: First, they reveal
            essential information about character and destiny. Second, they consistently appear
            in key positions within spreads, acting as markers that demand attention. Third,
            they function as navigational tools within readings, greatly enhancing accuracy
            and coherence.
          </p>
          <p className="text-lg sm:text-xl">
            Personal Significators are derived by converting key astrological and numerological
            data into Tarot archetypes. These include the Star Sign (linked to the Major Arcana),
            the Astrological Decanate (linked to the Minor Arcana), the Life Number, Day Number,
            Destiny Number, and relevant Court Cards.
          </p>
          <p className="text-lg sm:text-xl italic text-[#e6d5b8]/70">
            The Tarot, in this sense, becomes a true &ldquo;Book of Life,&rdquo; with each person reflected
            directly within the deck rather than merely interpreted through abstract spreads.
          </p>
        </div>
      </Section>

      {/* Astrological Sign */}
      <Section title="Astrological Sign" symbol="☉">
        <div className="space-y-6 text-[#e6d5b8]/90 leading-relaxed mb-8" style={{ fontFamily: "'Crimson Pro', serif" }}>

          <p className="text-lg sm:text-xl">
            Your Star Sign is linked to the Major Arcana and represents your birth month sign. This card would be most familiar to those who practice astrology.
          </p>
        </div>
        <AnimatedCardSection cards={majorArcana} interval={REFRESH_INTERVAL} />
      </Section>

      {/* Life Number */}
      <Section title="Life Number" symbol="∞">
        <div className="space-y-6 text-[#e6d5b8]/90 leading-relaxed mb-8" style={{ fontFamily: "'Crimson Pro', serif" }}>

          <p className="text-lg sm:text-xl">
            The Life Number reveals cards that share your numerological root, numbers that reduce
            to the same single digit are spiritually connected, forming a chain of meaning
            through the Major Arcana.
          </p>
        </div>
        <AnimatedCardSection cards={majorArcana} interval={REFRESH_INTERVAL} showRelated={true} />
      </Section>

      {/* Day Number */}
      <Section title="Day Number" symbol="☾">
        <div className="space-y-6 text-[#e6d5b8]/90 leading-relaxed mb-8" style={{ fontFamily: "'Crimson Pro', serif" }}>
          <p className="text-lg sm:text-xl">
          THe Day Number is the card from the Major Arcana that corresponds to the day of your birth. If you are born on the 21st, your Day Number is the World card.
          If you are born on the 23rd you can reduce the double to its single digit (2+3=5), making your Day Number the Hierophant..
          </p>

        </div>
        <AnimatedCardSection cards={majorArcana} interval={REFRESH_INTERVAL} />
      </Section>

      {/* Decanate */}
      <Section title="Decanate" symbol="⚶">
        <div className="space-y-6 text-[#e6d5b8]/90 leading-relaxed mb-8" style={{ fontFamily: "'Crimson Pro', serif" }}>
          <p className="text-lg sm:text-xl">
            The Decanate divides each zodiac sign into three ten-degree segments, each ruled by
            a different planetary influence and connected to specific Minor Arcana cards. This card is very important as it represents a granular breakdown of your zodiac sign
           - pertaining to week of birth.
          </p>
        </div>
        <AnimatedCardSection cards={minorArcana} interval={REFRESH_INTERVAL} />
      </Section>

      {/* Conclusion */}
      <Section title="Your Chart" symbol="✧">
        <div className="space-y-6 text-[#e6d5b8]/90 leading-relaxed" style={{ fontFamily: "'Crimson Pro', serif" }}>
          <p className="text-lg sm:text-xl">
            Together, these cards form a symbolic profile unique to each individual. Crucially,
            the interpretation of Significators rests on number, element, and decanate - not on
            the literal imagery or names of the cards.
          </p>
          <p className="text-lg sm:text-xl">
            Apparent &ldquo;positive&rdquo; or &ldquo;negative&rdquo; imagery does not determine character or worth.
            When understood correctly, Significators transform Tarot from a generalized
            fortune-telling tool into a precise and deeply personal system of insight.
          </p>
        </div>
      </Section>

      {/* CTA to Significators Calculator */}
      <div className="text-center mt-12 mb-8">
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent mx-auto mb-8" />
        <p
          className="text-[#e6d5b8]/80 text-lg sm:text-xl mb-6 max-w-2xl mx-auto"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          Ready to discover your own Personal Significators?
        </p>
        <Link
          href="/significators"
          className="inline-flex items-center gap-3 px-8 py-4 rounded-lg
                    border border-[#d4af37]/40 bg-gradient-to-r from-[#d4af37]/10 to-transparent
                    hover:border-[#d4af37] hover:bg-[#d4af37]/20
                    transition-all duration-500"
        >
          <span
            className="text-sm text-[#d4af37] tracking-widest uppercase
                       hover:text-[#ffd700] transition-colors"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Calculate Your Significators
          </span>
          <span className="text-xl text-[#d4af37]">→</span>
        </Link>
      </div>

      {/* Footer decoration */}
      <div className="mt-12 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="text-[#d4af37]/40">✦</span>
          <span className="text-[#d4af37]/30">✦</span>
          <span className="text-[#d4af37]/40">☥</span>
          <span className="text-[#d4af37]/30">✦</span>
          <span className="text-[#d4af37]/40">✦</span>
        </div>
      </div>
    </div>
  );
};

export default TarotChart;
