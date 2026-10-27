"use server";

import { revalidatePath } from "next/cache";
import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import {
  deleteUserSchema,
  emailUserSchema,
  inviteUserSchema,
} from "@/lib/validation/admin-schemas";
import type {
  AdminUser,
  AdminUserResponse,
  DeleteUserFormState,
  DetailResponse,
  EmailUserFormState,
  InviteUserFormState,
  PaginatedResponse,
} from "@/types/auth";
import { mapAdminUserResponse } from "@/types/auth";

// Layouts do not protect server actions (see frontend/CLAUDE.md): every action
// here re-checks the role itself before touching the API.
const requireSuperadmin = async () => {
  const user = await getCurrentUser();
  return user?.isSuperadmin ? user : null;
};

const FORBIDDEN = "Forbidden";
const EMAIL_FAILED = "The email could not be sent. Try again in a moment.";
const USER_GONE = "That seeker no longer exists.";

export const getUsers = async (
  page = 1,
  pageSize = 20
): Promise<
  | { ok: true; users: AdminUser[]; total: number; page: number; pageSize: number }
  | { ok: false; error: string }
> => {
  if (!(await requireSuperadmin())) return { ok: false, error: FORBIDDEN };

  const result = await authenticatedFetch<PaginatedResponse<AdminUserResponse>>(
    `/api/v1/users?page=${page}&page_size=${pageSize}`,
    { method: "GET" }
  );

  if (!result.ok) {
    return { ok: false, error: result.message ?? "Failed to fetch users" };
  }

  return {
    ok: true,
    users: result.data.items.map(mapAdminUserResponse),
    total: result.data.total,
    page: result.data.page,
    pageSize: result.data.page_size,
  };
};

/** Invite an address, or resend the link to one already invited. */
export const inviteUser = async (
  _prevState: InviteUserFormState,
  formData: FormData
): Promise<InviteUserFormState> => {
  if (!(await requireSuperadmin())) return { success: false, error: FORBIDDEN };

  const values = { email: String(formData.get("email") ?? "") };
  const parsed = inviteUserSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors, values };
  }

  console.log("[ADMIN] Invite requested");
  const result = await authenticatedFetch<DetailResponse>("/api/v1/users/invite", {
    method: "POST",
    body: JSON.stringify({ email: parsed.data.email }),
  });

  if (!result.ok) {
    console.log("[ADMIN] Invite failed", { status: result.status });
    const error =
      result.status === 409
        ? "An account with this email already exists."
        : result.status === 502
          ? EMAIL_FAILED
          : result.message;
    return { success: false, error, values };
  }

  revalidatePath("/superadmin");
  return { success: true, values };
};

/** One-way note to one user; no reply-to. */
export const emailUser = async (
  _prevState: EmailUserFormState,
  formData: FormData
): Promise<EmailUserFormState> => {
  if (!(await requireSuperadmin())) return { success: false, error: FORBIDDEN };

  const values = {
    subject: String(formData.get("subject") ?? ""),
    message: String(formData.get("message") ?? ""),
  };
  const parsed = emailUserSchema.safeParse({
    userId: formData.get("userId"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors, values };
  }

  console.log("[ADMIN] Email requested", { userId: parsed.data.userId });
  const result = await authenticatedFetch<DetailResponse>(
    `/api/v1/users/${encodeURIComponent(parsed.data.userId)}/email`,
    {
      method: "POST",
      body: JSON.stringify({ subject: parsed.data.subject, message: parsed.data.message }),
    }
  );

  if (!result.ok) {
    console.log("[ADMIN] Email failed", { status: result.status });
    const error =
      result.status === 404 ? USER_GONE : result.status === 502 ? EMAIL_FAILED : result.message;
    return { success: false, error, values };
  }

  return { success: true };
};

/** Superadmin deletion: the same cascade as the user's own delete-account page. */
export const deleteUser = async (
  _prevState: DeleteUserFormState,
  formData: FormData
): Promise<DeleteUserFormState> => {
  const admin = await requireSuperadmin();
  if (!admin) return { success: false, error: FORBIDDEN };

  const parsed = deleteUserSchema.safeParse({
    userId: formData.get("userId"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  if (parsed.data.userId === admin.id) {
    return { success: false, error: "Use your own account page to delete your account." };
  }

  console.log("[ADMIN] Delete requested", { userId: parsed.data.userId });
  const result = await authenticatedFetch<void>(
    `/api/v1/users/${encodeURIComponent(parsed.data.userId)}`,
    { method: "DELETE" }
  );

  if (!result.ok) {
    console.log("[ADMIN] Delete failed", { status: result.status });
    return { success: false, error: result.status === 404 ? USER_GONE : result.message };
  }

  revalidatePath("/superadmin");
  return { success: true };
};
