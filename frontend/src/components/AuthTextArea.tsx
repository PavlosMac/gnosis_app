"use client";

import { AUTH_CONTROL_CLASS, AUTH_CONTROL_STYLE, AuthFieldFrame } from "@/components/AuthField";

interface AuthTextAreaProps {
  name: string;
  label: string;
  placeholder: string;
  error?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  defaultValue?: string;
}

const AuthTextArea = ({
  name,
  label,
  placeholder,
  error,
  required,
  rows = 6,
  maxLength,
  defaultValue,
}: AuthTextAreaProps) => (
  <AuthFieldFrame name={name} label={label} error={error}>
    <textarea
      id={name}
      name={name}
      placeholder={placeholder}
      required={required}
      rows={rows}
      maxLength={maxLength}
      defaultValue={defaultValue}
      className={`${AUTH_CONTROL_CLASS} resize-y`}
      style={AUTH_CONTROL_STYLE}
    />
  </AuthFieldFrame>
);

export default AuthTextArea;
