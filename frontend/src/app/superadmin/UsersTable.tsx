"use client";

import { useActionState, useCallback, useState } from "react";
import { inviteUser } from "./actions";
import EmailUserModal from "./EmailUserModal";
import DeleteUserModal from "./DeleteUserModal";
import type { AdminUser, InviteUserFormState, UserStatus } from "@/types/auth";

const HEADINGS = ["Email", "Name", "Status", "Joined", ""] as const;

const STATUS_LABEL: Record<UserStatus, string> = {
  invited: "Invited",
  pending_verification: "Pending verification",
  active: "Active",
};

const STATUS_CLASS: Record<UserStatus, string> = {
  invited: "text-[#d4af37]/70",
  pending_verification: "text-[#e6d5b8]/50",
  active: "text-[#e6d5b8]/80",
};

const BODY = { fontFamily: "'Crimson Pro', serif" } as const;
const ACTION_CLASS =
  "text-xs tracking-[0.1em] uppercase text-[#d4af37]/60 hover:text-[#d4af37] disabled:opacity-40 transition-colors";

interface UsersTableProps {
  users: AdminUser[];
  /** The signed-in superadmin: their own row has no Delete (the backend refuses it too) */
  currentUserId: string;
}

const inviteInitial: InviteUserFormState = { success: false };

/** The "Resend invite" cell: the same action as the invite form, with the row's email. */
const ResendInvite = ({ email }: { email: string }) => {
  const [state, formAction, pending] = useActionState(inviteUser, inviteInitial);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="email" value={email} />
      <button type="submit" disabled={pending || state.success} className={ACTION_CLASS}>
        {pending ? "Sending..." : state.success ? "Sent" : state.error ? "Failed, retry" : "Resend invite"}
      </button>
    </form>
  );
};

const UsersTable = ({ users, currentUserId }: UsersTableProps) => {
  const [emailing, setEmailing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const closeEmail = useCallback(() => setEmailing(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);

  return (
    <>
      <div className="rounded-2xl border border-[#d4af37]/20 bg-gradient-to-b from-[#1a0033]/80 to-[#0a0015]/80 backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#d4af37]/20">
                {HEADINGS.map((heading, i) => (
                  <th
                    key={i}
                    className="px-4 sm:px-6 py-4 text-[#d4af37]/80 text-xs tracking-[0.15em] uppercase whitespace-nowrap"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[#d4af37]/10 last:border-b-0 hover:bg-[#d4af37]/5 transition-colors"
                >
                  <td className="px-4 sm:px-6 py-3 text-[#e6d5b8] text-sm" style={BODY}>
                    {user.email}
                    {user.isSuperadmin && (
                      <span className="ml-2 text-[#d4af37]/50 text-xs">&#9878;</span>
                    )}
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-[#e6d5b8]/80 text-sm" style={BODY}>
                    {user.displayName || "—"}
                  </td>
                  <td
                    className={`px-4 sm:px-6 py-3 text-sm whitespace-nowrap ${STATUS_CLASS[user.status]}`}
                    style={BODY}
                  >
                    {STATUS_LABEL[user.status]}
                  </td>
                  <td
                    className="px-4 sm:px-6 py-3 text-[#e6d5b8]/60 text-sm whitespace-nowrap"
                    style={BODY}
                  >
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-4">
                      {user.status === "invited" && <ResendInvite email={user.email} />}
                      <button
                        type="button"
                        onClick={() => setEmailing(user)}
                        className={ACTION_CLASS}
                      >
                        Email
                      </button>
                      {user.id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => setDeleting(user)}
                          className="text-xs tracking-[0.1em] uppercase text-red-400/60 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {emailing && <EmailUserModal user={emailing} onClose={closeEmail} />}
      {deleting && <DeleteUserModal user={deleting} onClose={closeDelete} />}
    </>
  );
};

export default UsersTable;
