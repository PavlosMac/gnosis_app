"use server";

import { authenticatedFetch } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/session";
import type { PaginatedResponse, UserResponse, User } from "@/types/auth";
import { mapUserResponseToUser } from "@/types/auth";

export const getUsers = async (
  page = 1,
  pageSize = 20
): Promise<
  | { ok: true; users: User[]; total: number; page: number; pageSize: number }
  | { ok: false; error: string }
> => {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) {
    return { ok: false, error: "Forbidden" };
  }

  const result = await authenticatedFetch<PaginatedResponse<UserResponse>>(
    `/api/v1/users?page=${page}&page_size=${pageSize}`,
    { method: "GET" }
  );

  if (!result.ok) {
    return { ok: false, error: result.message ?? "Failed to fetch users" };
  }

  return {
    ok: true,
    users: result.data.items.map(mapUserResponseToUser),
    total: result.data.total,
    page: result.data.page,
    pageSize: result.data.page_size,
  };
};
