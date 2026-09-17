"use client";

import { useActionState } from "react";
import SanctumModal from "@/components/SanctumModal";
import AuthField from "@/components/AuthField";
import AuthTextArea from "@/components/AuthTextArea";
import { AuthErrorBanner, AuthSubmitButton } from "@/components/AuthPageShell";
import { contactSupport } from "./actions";
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SUBJECT_MAX,
} from "@/lib/validation/support-schemas";
import type { ContactSupportFormState } from "@/types/auth";

interface ContactSupportModalProps {
  onClose: () => void;
}

const initialState: ContactSupportFormState = { success: false };

const ContactSupportModal = ({ onClose }: ContactSupportModalProps) => {
  const [state, formAction, pending] = useActionState(contactSupport, initialState);

  return (
    <SanctumModal title="Seek Counsel" onClose={onClose}>
      {state.success ? (
        <p
          className="text-center text-[#e6d5b8]/60 text-sm py-4"
          style={{ fontFamily: "'Crimson Pro', serif" }}
        >
          Your message has been sent. The keeper of the sanctum will reply
          to your email.
        </p>
      ) : (
        <>
          <AuthErrorBanner message={state.error} className="mb-6" />

          <form action={formAction} className="space-y-6">
            <AuthField
              name="subject"
              type="text"
              label="Subject"
              placeholder="How can we help?"
              error={state.fieldErrors?.subject?.[0]}
              maxLength={SUPPORT_SUBJECT_MAX}
              defaultValue={state.values?.subject}
              required
            />
            <AuthTextArea
              name="message"
              label="Message"
              placeholder="Describe your question or issue..."
              error={state.fieldErrors?.message?.[0]}
              rows={6}
              maxLength={SUPPORT_MESSAGE_MAX}
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

export default ContactSupportModal;
