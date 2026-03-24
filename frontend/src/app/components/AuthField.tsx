"use client";

interface AuthFieldProps {
  name: string;
  type: string;
  label: string;
  placeholder: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
}

const AuthField = ({
  name,
  type,
  label,
  placeholder,
  error,
  required,
  autoComplete,
}: AuthFieldProps) => (
  <div className="space-y-1.5">
    <label
      htmlFor={name}
      className="block text-xs text-[#d4af37]/60 tracking-widest uppercase"
      style={{ fontFamily: "'Cinzel', serif" }}
    >
      {label}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      className="w-full px-4 py-3 rounded-lg bg-[#0a0015]/60 border border-[#d4af37]/20
                 text-[#e6d5b8] placeholder-[#e6d5b8]/20 text-sm
                 focus:outline-none focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/20
                 transition-all duration-300"
      style={{ fontFamily: "'Crimson Pro', serif" }}
    />
    {error && (
      <p
        className="text-xs text-red-400/80"
        style={{ fontFamily: "'Crimson Pro', serif" }}
      >
        {error}
      </p>
    )}
  </div>
);

export default AuthField;
