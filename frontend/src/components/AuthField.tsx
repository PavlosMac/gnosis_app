"use client";

/** Control styling shared by every auth input and textarea */
export const AUTH_CONTROL_CLASS = `w-full px-4 py-3 rounded-lg bg-[#0a0015]/60 border border-[#d4af37]/20
  text-[#e6d5b8] placeholder-[#e6d5b8]/20 text-sm
  focus:outline-none focus:border-[#d4af37]/60 focus:ring-1 focus:ring-[#d4af37]/20
  transition-all duration-300`;

export const AUTH_CONTROL_STYLE = { fontFamily: "'Crimson Pro', serif" } as const;

interface AuthFieldFrameProps {
  /** Matches the control's `id` so the label focuses it */
  name: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

/** Label above, field error below — the wrapper around any auth control */
export const AuthFieldFrame = ({ name, label, error, children }: AuthFieldFrameProps) => (
  <div className="space-y-1.5">
    <label
      htmlFor={name}
      className="block text-xs text-[#d4af37]/60 tracking-widest uppercase"
      style={{ fontFamily: "'Cinzel', serif" }}
    >
      {label}
    </label>
    {children}
    {error && (
      <p className="text-xs text-red-400/80" style={AUTH_CONTROL_STYLE}>
        {error}
      </p>
    )}
  </div>
);

interface AuthFieldProps {
  name: string;
  type: string;
  label: string;
  placeholder: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  defaultValue?: string;
}

const AuthField = ({
  name,
  type,
  label,
  placeholder,
  error,
  required,
  autoComplete,
  maxLength,
  defaultValue,
}: AuthFieldProps) => (
  <AuthFieldFrame name={name} label={label} error={error}>
    <input
      id={name}
      name={name}
      type={type}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      maxLength={maxLength}
      defaultValue={defaultValue}
      className={AUTH_CONTROL_CLASS}
      style={AUTH_CONTROL_STYLE}
    />
  </AuthFieldFrame>
);

export default AuthField;
