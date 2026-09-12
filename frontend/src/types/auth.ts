import type { ReadingDetail, TagSummary } from "@/types/reading";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  credits: number;
  isSuperadmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_token_expires_at: number;   // unix timestamp (seconds)
  refresh_token_expires_at: number;  // unix timestamp (seconds)
}

export interface MeResponse {
  _id: string;
  email: string;
  display_name: string | null;
  credits: number;
  is_superadmin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthFormState {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export interface LoginFormState extends AuthFormState {}
export interface RegisterFormState extends AuthFormState {}

export interface AuthContextValue {
  user: User | null;
  clearUser: () => void;
}

export interface UserResponse {
  id: string;
  email: string;
  display_name: string | null;
  credits: number;
  is_superadmin: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export const mapMeResponseToUser = (me: MeResponse): User => ({
  id: me._id,
  email: me.email,
  displayName: me.display_name,
  credits: me.credits,
  isSuperadmin: me.is_superadmin,
  createdAt: me.created_at,
  updatedAt: me.updated_at,
});

// --- Profile dashboard: GET /api/v1/dashboard ---

/** The account slice the dashboard endpoint embeds (no credits/updated_at) */
export interface DashboardUserResponse {
  _id: string;
  email: string;
  display_name: string | null;
  is_superadmin: boolean;
  created_at: string;
}

export interface DashboardResponse {
  user: DashboardUserResponse;
  /** The user's spend cap (per-user override or the server default) */
  budget_usd: number;
  remaining_budget_usd: number;
  total_readings: number;
  /** Same shape as GET /readings/{id}, interpretation embedded; null before the first reading */
  last_reading: ReadingDetail | null;
  /** The user's tag vocabulary, most-used first — same as the readings list payload */
  user_tags: TagSummary[];
}

export interface DashboardUser {
  id: string;
  email: string;
  displayName: string | null;
  isSuperadmin: boolean;
  createdAt: string;
}

export interface Dashboard {
  user: DashboardUser;
  budgetUsd: number;
  remainingBudgetUsd: number;
  totalReadings: number;
  lastReading: ReadingDetail | null;
  userTags: TagSummary[];
}

export const mapDashboardResponse = (d: DashboardResponse): Dashboard => ({
  // Tolerate a backend that omits/nulls the user rather than crash the page —
  // this mapped field isn't currently read (callers use getCurrentUser() instead)
  user: d.user
    ? {
        id: d.user._id,
        email: d.user.email,
        displayName: d.user.display_name,
        isSuperadmin: d.user.is_superadmin,
        createdAt: d.user.created_at,
      }
    : { id: "", email: "", displayName: null, isSuperadmin: false, createdAt: "" },
  budgetUsd: d.budget_usd,
  remainingBudgetUsd: d.remaining_budget_usd,
  totalReadings: d.total_readings,
  lastReading: d.last_reading,
  // Tolerate a backend that omits the vocabulary rather than crash the page
  userTags: Array.isArray(d.user_tags) ? d.user_tags : [],
});

export const mapUserResponseToUser = (u: UserResponse): User => ({
  id: u.id,
  email: u.email,
  displayName: u.display_name,
  credits: u.credits,
  isSuperadmin: u.is_superadmin,
  createdAt: u.created_at,
  updatedAt: u.updated_at,
});
