import React from "react";

export interface SignificatorSectionProps {
  title: string;
  symbol: string;
  description: string;
  children: React.ReactNode;
}

const SignificatorSection: React.FC<SignificatorSectionProps> = ({
  title,
  symbol,
  description,
  children,
}) => {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="text-[#d4af37]/60 text-xl">{symbol}</span>
        <h3
          className="text-xl sm:text-2xl text-[#d4af37] tracking-wide"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {title}
        </h3>
      </div>
      <p
        className="text-[#e6d5b8]/70 text-sm sm:text-base mb-4 max-w-md mx-auto text-center"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        {description}
      </p>
      {children}
    </div>
  );
};

export default SignificatorSection;
