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
  /** Muted guidance under the input, e.g. the password rules */
  hint?: string;
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
  hint,
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
      aria-describedby={hint ? `${name}-hint` : undefined}
      className={AUTH_CONTROL_CLASS}
      style={AUTH_CONTROL_STYLE}
    />
    {hint && (
      <p id={`${name}-hint`} className="text-xs text-[#e6d5b8]/40" style={AUTH_CONTROL_STYLE}>
        {hint}
      </p>
    )}
  </AuthFieldFrame>
);

interface AuthCheckboxProps {
  name: string;
  /** Rendered beside the box. Callers put the `<label htmlFor={name}>` text and
      any link/button inside, so a button in the label never toggles the box. */
  children: React.ReactNode;
  error?: string;
  defaultChecked?: boolean;
}

/** A consent-style checkbox row with the same error line as the text fields */
export const AuthCheckbox = ({ name, children, error, defaultChecked }: AuthCheckboxProps) => (
  <div className="space-y-1.5">
    <div className="flex items-start" style={{ gap: "0.75rem" }}>
      <input
        id={name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        aria-invalid={error ? true : undefined}
        className="shrink-0 rounded border border-[#d4af37]/40 bg-[#0a0015]/60 accent-[#d4af37]
                   focus:outline-none focus:ring-1 focus:ring-[#d4af37]/40"
        style={{ width: "1.125rem", height: "1.125rem", marginTop: "0.2rem" }}
      />
      <div className="text-sm text-[#e6d5b8]/80" style={{ ...AUTH_CONTROL_STYLE, minWidth: 0 }}>
        {children}
      </div>
    </div>
    {error && (
      <p className="text-xs text-red-400/80" style={AUTH_CONTROL_STYLE}>
        {error}
      </p>
    )}
  </div>
);

export default AuthField;
