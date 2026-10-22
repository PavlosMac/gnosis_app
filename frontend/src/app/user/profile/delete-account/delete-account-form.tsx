"use client";

import { useActionState } from "react";
import AuthPageShell, {
  AuthErrorBanner,
  AuthFootnote,
  AuthLink,
} from "@/components/AuthPageShell";
import AuthField from "@/components/AuthField";
import { deleteAccount } from "./actions";
import type { DeleteAccountFormState } from "@/types/auth";

const initialState: DeleteAccountFormState = { success: false };
const BODY = { fontFamily: "'Crimson Pro', serif" } as const;

const DeleteAccountForm = () => {
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);

  return (
    <AuthPageShell
      glyph={<>&#9760;</>}
      title="Delete Account"
      backButtonHref="/user/profile/settings"
      backButtonLabel="Settings"
    >
      <div
        className="rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3 mb-6 text-sm text-[#e6d5b8]/80"
        style={BODY}
      >
        <p>
          <strong className="text-red-400/90">This cannot be undone.</strong> Deleting
          your account immediately and permanently removes:
        </p>
        <ul style={{ listStyleType: "disc", paddingLeft: "1.25rem", marginTop: "0.5rem" }}>
          <li>your account details and sign-in</li>
          <li>every saved reading, its interpretation and your tags</li>
          <li>your usage record and your agreement records</li>
        </ul>
      </div>

      <AuthErrorBanner message={state.error} className="mb-6" />

      <form action={formAction} className="space-y-6">
        <AuthField
          name="password"
          type="password"
          label="Password"
          placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
          error={state.fieldErrors?.password?.[0]}
          autoComplete="current-password"
          required
        />
        <AuthField
          name="confirm"
          type="text"
          label="Type DELETE to confirm"
          placeholder="DELETE"
          error={state.fieldErrors?.confirm?.[0]}
          autoComplete="off"
          required
        />

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 rounded-lg border border-red-400/60 bg-red-400/10
                     text-red-400 tracking-widest uppercase text-sm
                     hover:border-red-400 hover:bg-red-400/20
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-300"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {pending ? "Deleting..." : "Delete My Account"}
        </button>
      </form>

      <AuthFootnote>
        <AuthLink href="/user/profile">Keep my account</AuthLink>
      </AuthFootnote>
    </AuthPageShell>
  );
};

export default DeleteAccountForm;
