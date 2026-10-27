"use client";

import { useActionState } from "react";
import SanctumModal from "@/components/SanctumModal";
import AuthField from "@/components/AuthField";
import AuthTextArea from "@/components/AuthTextArea";
import { AuthErrorBanner, AuthSubmitButton } from "@/components/AuthPageShell";
import { ADMIN_MESSAGE_MAX, ADMIN_SUBJECT_MAX } from "@/lib/validation/admin-schemas";
import { emailUser } from "./actions";
import type { AdminUser, EmailUserFormState } from "@/types/auth";

interface EmailUserModalProps {
  user: AdminUser;
  onClose: () => void;
}

const initialState: EmailUserFormState = { success: false };

/** A one-way note to one seeker, sent from the noreply address. */
const EmailUserModal = ({ user, onClose }: EmailUserModalProps) => {
  const [state, formAction, pending] = useActionState(emailUser, initialState);

  return (
    <SanctumModal title="Send Word" subtitle={user.email} onClose={onClose}>
      {state.success ? (
        <p
          className="text-center text-[#e6d5b8]/60 text-sm py-4"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          Your message has been sent. Replies are not received at the sending
          address.
        </p>
      ) : (
        <>
          <AuthErrorBanner message={state.error} className="mb-6" />

          <form action={formAction} className="space-y-6">
            <input type="hidden" name="userId" value={user.id} />
            <AuthField
              name="subject"
              type="text"
              label="Subject"
              placeholder="Subject"
              error={state.fieldErrors?.subject?.[0]}
              maxLength={ADMIN_SUBJECT_MAX}
              defaultValue={state.values?.subject}
              required
            />
            <AuthTextArea
              name="message"
              label="Message"
              placeholder="Plain text. Blank lines separate paragraphs."
              error={state.fieldErrors?.message?.[0]}
              rows={8}
              maxLength={ADMIN_MESSAGE_MAX}
              defaultValue={state.values?.message}
              required
            />

            <AuthSubmitButton pending={pending} pendingLabel="Sending...">
              Send
            </AuthSubmitButton>
          </form>
        </>
      )}
    </SanctumModal>
  );
};

export default EmailUserModal;
