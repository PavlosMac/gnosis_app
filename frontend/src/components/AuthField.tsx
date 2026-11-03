"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

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
  /** Bounds for a `type="date"` control. Keep `max` static (or absent): a
      render-time "today" differs between server and client */
  min?: string;
  max?: string;
  /** Muted guidance under the input, e.g. the password rules */
  hint?: string;
}

// A date control's picker icon is drawn by the browser in the page's colour
// scheme; on the dark panels it is invisible without this
const DATE_CONTROL_STYLE = { ...AUTH_CONTROL_STYLE, colorScheme: "dark" } as const;

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
  min,
  max,
  hint,
}: AuthFieldProps) => (
  <AuthFieldFrame name={name} label={label} error={error}>
    {type === "password" ? (
      <PasswordInput
        name={name}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${name}-hint` : undefined}
      />
    ) : (
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        defaultValue={defaultValue}
        min={min}
        max={max}
        aria-describedby={hint ? `${name}-hint` : undefined}
        className={AUTH_CONTROL_CLASS}
        style={type === "date" ? DATE_CONTROL_STYLE : AUTH_CONTROL_STYLE}
      />
    )}
    {hint && (
      <p id={`${name}-hint`} className="text-xs text-[#e6d5b8]/40" style={AUTH_CONTROL_STYLE}>
        {hint}
      </p>
    )}
  </AuthFieldFrame>
);

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "type" | "className" | "style"
> & { name: string };

interface PasswordControlProps extends PasswordInputProps {
  revealed: boolean;
  onToggle: () => void;
  /** Lets the stateful wrapper find the enclosing form */
  wrapperRef?: React.Ref<HTMLDivElement>;
}

/** A password box with an eye button at its right edge that reveals the text.
    Presentational: `revealed` is owned by the caller so both states render
    without a DOM. The input's `name`/`id` never change, so the submitted
    field is the same whether or not the text is showing. */
export const PasswordControl = ({
  name,
  revealed,
  onToggle,
  wrapperRef,
  ...rest
}: PasswordControlProps) => (
  <div ref={wrapperRef} className="relative">
    <input
      {...rest}
      id={name}
      name={name}
      type={revealed ? "text" : "password"}
      // A revealed password is a text field: keep the keyboard and browser
      // from capitalising, correcting or spell-checking (and sending) it
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      className={`${AUTH_CONTROL_CLASS} pr-12`}
      style={AUTH_CONTROL_STYLE}
    />
    <button
      type="button"
      onClick={onToggle}
      // Keep focus and the caret in the input when the eye is clicked
      onMouseDown={(e) => e.preventDefault()}
      title={revealed ? "Hide password" : "Show password"}
      aria-label={revealed ? "Hide password" : "Show password"}
      aria-pressed={revealed}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-[#d4af37]/50
                 hover:text-[#d4af37] focus:outline-none focus-visible:text-[#d4af37]
                 focus-visible:ring-1 focus-visible:ring-[#d4af37]/40 transition-colors duration-300"
    >
      {revealed ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
    </button>
  </div>
);

/** Starts hidden on every mount; the eye toggles it. Submitting the form hides
    it again: a server-action form stays mounted after an error, and the retry
    should not be typed in the clear. */
const PasswordInput = (props: PasswordInputProps) => {
  const [revealed, setRevealed] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = wrapperRef.current?.closest("form");
    if (!form) return;
    const hide = () => setRevealed(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  return (
    <PasswordControl
      {...props}
      wrapperRef={wrapperRef}
      revealed={revealed}
      onToggle={() => setRevealed((r) => !r)}
    />
  );
};

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
