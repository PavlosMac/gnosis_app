interface OrnateFrameProps {
  size?: 'sm' | 'md';
  corners?: 'all' | 'top';
}

export default function OrnateFrame({ size = 'md', corners = 'all' }: OrnateFrameProps) {
  const dim = size === 'sm' ? 'w-16 h-16' : 'w-24 h-24';
  return (
    <>
      <div className={`absolute top-0 left-0 ${dim} border-t-2 border-l-2 border-[#d4af37]/50 rounded-tl-xl pointer-events-none`} />
      <div className={`absolute top-0 right-0 ${dim} border-t-2 border-r-2 border-[#d4af37]/50 rounded-tr-xl pointer-events-none`} />
      {corners === 'all' && (
        <>
          <div className={`absolute bottom-0 left-0 ${dim} border-b-2 border-l-2 border-[#d4af37]/50 rounded-bl-xl pointer-events-none`} />
          <div className={`absolute bottom-0 right-0 ${dim} border-b-2 border-r-2 border-[#d4af37]/50 rounded-br-xl pointer-events-none`} />
        </>
      )}
    </>
  );
}
