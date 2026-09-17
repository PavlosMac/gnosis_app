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
import Image from "next/image";
import React from "react";

interface TarotCardProps {
  card: TarotCardData;
  showMeaning?: boolean;
  small?: boolean;
}

const TarotCard: React.FC<TarotCardProps> = React.memo(({ card, showMeaning = true, small = false }) => {
  return (
    <div className={`tarot-card-container ${small ? 'scale-90' : ''} flex flex-col items-center`}>
      <div className="relative group flex flex-col items-center">
        {/* Card glow effect on hover */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[#d4af37] to-[#8a2be2] rounded-lg opacity-0 
                        group-hover:opacity-50 blur transition-opacity duration-500" />
        
        {/* Card itself */}
        <div className={`relative ${small ? 'w-20 h-32 sm:w-28 sm:h-44' : 'w-40 h-64'} transition-all duration-500 
                        ${card.reversed ? 'rotate-180' : ''}`}
             style={{
               transformStyle: 'preserve-3d',
               perspective: '1000px'
             }}>
          
          {/* Ornate border frame */}
          <div className="absolute inset-0 rounded-lg border-2 border-[#d4af37] shadow-2xl overflow-hidden"
               style={{
                 background: 'linear-gradient(135deg, rgba(26,0,51,0.3), rgba(45,27,78,0.3))'
               }}>
            
            {/* Inner decorative border */}
            <div className="absolute inset-2 border border-[#d4af37]/40 rounded-md" />
            
            {/* Card image */}
            <div className="relative w-full h-full p-3">
              <Image
                src={card.imageUrl}
                alt={card.name}
                fill
                className="rounded object-cover p-2"
                sizes={small ? '(min-width: 640px) 112px, 80px' : '160px'}
              />
            </div>
          </div>
        </div>
        
        {/* Card name */}
        <h3 className={`text-center text-[#e6d5b8] tracking-wide ${small ? 'mt-1.5 sm:mt-3 text-[10px] sm:text-xs' : 'mt-3 text-sm sm:text-base'} font-semibold`}
            style={{ fontFamily: "'Cinzel', serif", textShadow: '0 0 10px rgba(212,175,55,0.3)' }}>
          {card.name}
        </h3>
        {!small && card.reversed && (
          <p className={`text-center text-[#d4af37]/80 ${small ? 'text-[9px] sm:text-xs' : 'text-xs'}`}
             style={{ fontFamily: "'Cinzel', serif" }}>
            (Reversed)
          </p>
        )}
        
        {/* Meaning */}
        {!small && showMeaning && (
          <p className="text-center text-xs sm:text-sm mt-2 text-[#e6d5b8]/80 w-40 italic"
             style={{ fontFamily: "'Crimson Pro', serif" }}>
            {card.reversed && card.reversedMeaning ? card.reversedMeaning : card.meaning}
          </p>
        )}
      </div>
    </div>
  );
});

TarotCard.displayName = 'TarotCard';

export default TarotCard;
