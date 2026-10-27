"use client";

import { useActionState } from "react";
import { AUTH_CONTROL_CLASS, AUTH_CONTROL_STYLE } from "@/components/AuthField";
import { inviteUser } from "./actions";
import type { InviteUserFormState } from "@/types/auth";

const initialState: InviteUserFormState = { success: false };

/** The "Invite a seeker" row above the table: one email field and a button. */
const InviteUserForm = () => {
  const [state, formAction, pending] = useActionState(inviteUser, initialState);
  const fieldError = state.fieldErrors?.email?.[0];

  return (
    <form
      action={formAction}
      className="mb-8 rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm p-5 sm:p-6"
    >
      <label
        htmlFor="invite-email"
        className="block text-xs text-[#d4af37]/60 tracking-widest uppercase mb-2"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        Invite a seeker
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="invite-email"
          name="email"
          type="email"
          placeholder="their@email.com"
          autoComplete="off"
          required
          // Cleared after a successful send, kept after a failure
          key={state.success ? "sent" : "editing"}
          defaultValue={state.success ? "" : state.values?.email}
          className={AUTH_CONTROL_CLASS}
          style={AUTH_CONTROL_STYLE}
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 px-6 py-3 rounded-lg border border-[#d4af37]/60 bg-gradient-to-r from-[#d4af37]/20 via-[#d4af37]/15 to-[#d4af37]/20 text-[#d4af37] tracking-widest uppercase text-sm hover:border-[#d4af37] hover:bg-[#d4af37]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {pending ? "Sending..." : "Send Invitation"}
        </button>
      </div>
      {(fieldError || state.error) && (
        <p className="mt-2 text-xs text-red-400/80" style={AUTH_CONTROL_STYLE}>
          {fieldError ?? state.error}
        </p>
      )}
      {state.success && (
        <p className="mt-2 text-xs text-[#d4af37]/70" style={AUTH_CONTROL_STYLE}>
          Invitation sent to {state.values?.email}.
        </p>
      )}
    </form>
  );
};

export default InviteUserForm;
