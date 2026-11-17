// import { TarotCardData } from "@/types/models";
// import Image from "next/image";
// import React from "react";

// interface TarotCardProps {
//   card: TarotCardData;
//   showMeaning?: boolean;
//   small?: boolean;
// }


// export default function TarotCard({ card, showMeaning = true, small = false }: TarotCardProps) {
//   return (
//     <div className={`tarot-card flex flex-col items-center ${small ? '' : ''}`}>
//       <div className={`relative ${small ? 'w-24 h-40 min-w-[96px] min-h-[160px]' : 'w-12 h-20 min-w-[48px] min-h-[80px]'} transition-transform ${card.reversed ? 'rotate-180' : ''}`}>
//         <Image
//           src={card.imageUrl}
//           alt={card.name}
//           fill
//           className="rounded-lg shadow-md object-cover"
//           sizes={small ? '96px' : '48px'}
//         />
//       </div>
//       <h3 className={`text-center ${small ? 'text-[10px] font-semibold mt-0.5' : 'text-xs sm:text-sm font-semibold mt-1'}`}>{card.name}</h3>
//       {!small && showMeaning && (
//         <p className="text-center text-[10px] sm:text-xs mt-0.5 text-gray-600">
//           {card.reversed && card.reversedMeaning ? card.reversedMeaning : card.meaning}
//         </p>
//       )}
//     </div>
//   );
// }

import { TarotCardData } from "@/types/models";
import type { SpreadCardSelectHandler } from "@/types/reading";
import Image from "next/image";
import React from "react";

interface TarotCardProps {
  card: TarotCardData;
  showMeaning?: boolean;
  small?: boolean;
  /** The card's position in its spread; reported back to `onSelect` */
  position?: string;
  /** When given, the whole card is a button that reports the card, its orientation and
      `position` to this handler. Pass one stable handler to every card so memo holds */
  onSelect?: SpreadCardSelectHandler;
}

const TarotCard: React.FC<TarotCardProps> = React.memo(({ card, showMeaning = true, small = false, position, onSelect }) => {
  // A button may only hold phrasing content, so the clickable face is built from spans
  const Box = onSelect ? 'span' : 'div';
  const Title = onSelect ? 'span' : 'h3';
  const Text = onSelect ? 'span' : 'p';
  const handleClick = () => onSelect?.({ card, reversed: card.reversed ?? false, position });

  const face = (
    <Box className={`tarot-card-container ${small ? 'scale-90' : ''} flex flex-col items-center`}>
      <Box className="relative group flex flex-col items-center">
        {/* Card glow effect on hover */}
        <Box className="absolute -inset-1 bg-gradient-to-r from-[#d4af37] to-[#8a2be2] rounded-lg opacity-0 
                        group-hover:opacity-50 blur transition-opacity duration-500" />
        
        {/* Card itself */}
        <Box className={`relative block ${small ? 'w-20 h-32 sm:w-28 sm:h-44' : 'w-40 h-64'} transition-transform duration-500
                        ${card.reversed ? 'rotate-180' : ''}`}
             style={{
               transformStyle: 'preserve-3d',
               perspective: '1000px'
             }}>

          {/* Ornate border frame */}
          <Box className="absolute inset-0 rounded-lg border-2 border-[#d4af37] shadow-2xl overflow-hidden"
               style={{
                 background: 'linear-gradient(135deg, rgba(26,0,51,0.3), rgba(45,27,78,0.3))'
               }}>

            {/* Inner decorative border */}
            <Box className="absolute inset-2 border border-[#d4af37]/40 rounded-md" />

            {/* Card image */}
            <Box className="relative block w-full h-full p-3">
              <Image
                src={card.imageUrl}
                alt={card.name}
                fill
                className="rounded object-cover p-2"
                sizes={small ? '(min-width: 640px) 112px, 80px' : '160px'}
              />
            </Box>
          </Box>
        </Box>

        {/* Card name */}
        <Title className={`block text-center text-[#e6d5b8] tracking-wide ${small ? 'mt-1.5 sm:mt-3 text-[10px] sm:text-xs' : 'mt-3 text-sm sm:text-base'} font-semibold`}
            style={{ fontFamily: "'Cinzel', serif", textShadow: '0 0 10px rgba(212,175,55,0.3)' }}>
          {card.name}
        </Title>
        {!small && card.reversed && (
          <Text className="block text-center text-[#d4af37]/80 text-xs"
             style={{ fontFamily: "'Cinzel', serif" }}>
            (Reversed)
          </Text>
        )}

        {/* Meaning */}
        {!small && showMeaning && (
          <Text className="block text-center text-xs sm:text-sm mt-2 text-[#e6d5b8]/80 w-40 italic"
             style={{ fontFamily: "'Crimson Pro', serif" }}>
            {card.reversed && card.reversedMeaning ? card.reversedMeaning : card.meaning}
          </Text>
        )}
      </Box>
    </Box>
  );

  if (!onSelect) return face;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-haspopup="dialog"
      aria-label={`About ${card.name}${card.reversed ? ' (reversed)' : ''}`}
      className="cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]/60"
    >
      {face}
    </button>
  );
});

TarotCard.displayName = 'TarotCard';

export default TarotCard;
