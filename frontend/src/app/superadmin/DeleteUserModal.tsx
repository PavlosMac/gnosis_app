"use client";

import { useActionState, useEffect } from "react";
import SanctumModal from "@/components/SanctumModal";
import AuthField from "@/components/AuthField";
import { AuthErrorBanner } from "@/components/AuthPageShell";
import { deleteUser } from "./actions";
import type { AdminUser, DeleteUserFormState } from "@/types/auth";

interface DeleteUserModalProps {
  user: AdminUser;
  onClose: () => void;
}

const initialState: DeleteUserFormState = { success: false };
const BODY = { fontFamily: "'Crimson Pro', serif" } as const;

/** Type-to-confirm, like the user's own delete-account page. Closes itself once
    the row is gone (the action revalidates the listing). */
const DeleteUserModal = ({ user, onClose }: DeleteUserModalProps) => {
  const [state, formAction, pending] = useActionState(deleteUser, initialState);

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  return (
    <SanctumModal title="Banish Seeker" subtitle={user.email} onClose={onClose}>
      <div
        className="rounded-lg border border-red-400/30 bg-red-400/5 px-4 py-3 mb-6 text-sm text-[#e6d5b8]/80"
        style={BODY}
      >
        <p>
          <strong className="text-red-400/90">This cannot be undone.</strong> Deleting
          this account immediately and permanently removes their sign-in, every
          saved reading and interpretation, their tags, usage and agreement
          records.
        </p>
      </div>

      <AuthErrorBanner message={state.error} className="mb-6" />

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="userId" value={user.id} />
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
          className="w-full py-3 rounded-lg border border-red-400/60 bg-red-400/10 text-red-400 tracking-widest uppercase text-sm hover:border-red-400 hover:bg-red-400/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {pending ? "Deleting..." : "Delete This Account"}
        </button>
      </form>
    </SanctumModal>
  );
};

export default DeleteUserModal;
