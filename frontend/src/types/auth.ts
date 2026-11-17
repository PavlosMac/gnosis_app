import type { ReadingDetail, TagSummary } from "@/types/reading";
import type { ContactSupportInput } from "@/lib/validation/support-schemas";
import type { UserConsents } from "@/lib/consent";

/** Where the account is in onboarding. `invited` is a superadmin invite not yet
    accepted (no password, names or consents). `payment_required` slots in later. */
export type UserStatus = "invited" | "pending_verification" | "active";

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  /** ISO "YYYY-MM-DD"; null for accounts created before it was required
      (legacy, seeded, invited-but-not-accepted). Feeds the profile's card of the day */
  birthDate: string | null;
  /** Accepted legal-document versions. `undefined` = the backend predates
      consent (the key is always present once it ships, `{}` for legacy users) */
  consents?: UserConsents;
  status: UserStatus;
  emailVerifiedAt: string | null;
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
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  consents?: UserConsents;
  /** Absent on a backend that predates email verification — treated as active */
  status?: UserStatus;
  email_verified_at?: string | null;
  credits: number;
  is_superadmin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthFormState<TValues = never> {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Submitted values echoed back on failure so the form re-renders with what
      was typed — React 19 resets uncontrolled inputs to their defaultValue after
      an action. Never echo secrets (passwords). */
  values?: TValues;
}

export interface LoginFormState extends AuthFormState {
  /** The account exists but its email is unconfirmed — the form links to
      /verify-email so the user can request a fresh link */
  emailNotVerified?: boolean;
}

/** What the register form echoes back on failure. Never the passwords. */
export interface RegisterEchoValues {
  firstName: string;
  lastName: string;
  birthDate: string;
  email: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export type RegisterFormState = AuthFormState<RegisterEchoValues>;

export interface VerifyEmailFormState extends AuthFormState {
  /** Set when the verification token itself was rejected (400/410) — the page
      renders the dead-link panel with the resend form */
  tokenProblem?: "invalid" | "expired";
}

export type ResendVerificationFormState = AuthFormState<{ email: string }>;

export interface ConsentFormState extends AuthFormState {
  /** Shown beside a successful save, e.g. when a box was left unticked */
  notice?: string;
}

export type DeleteAccountFormState = AuthFormState;

/** What the accept-invite form echoes back on failure. Never the passwords. */
export interface AcceptInviteEchoValues {
  firstName: string;
  lastName: string;
  birthDate: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export interface AcceptInviteFormState extends AuthFormState<AcceptInviteEchoValues> {
  /** Set when the invite token itself was rejected (400/410) */
  tokenProblem?: "invalid" | "expired";
}

/** `{"email": "..."}` from GET /auth/invite?token= */
export interface InviteLookupResponse {
  email: string;
}

// --- Superadmin actions ---

export type InviteUserFormState = AuthFormState<{ email: string }>;
export type EmailUserFormState = AuthFormState<{ subject: string; message: string }>;
export type DeleteUserFormState = AuthFormState;

/** `{"detail": "..."}` body returned by register / verify-email / resend */
export interface DetailResponse {
  detail: string;
}
export type ForgotPasswordFormState = AuthFormState;
export type ContactSupportFormState = AuthFormState<ContactSupportInput>;

export interface ResetPasswordFormState extends AuthFormState {
  /** Set when the reset token itself was rejected (400/410) — the page renders
      a dead-link panel with a /forgot-password link instead of field errors */
  tokenProblem?: "invalid" | "expired";
}

/** Generic `{"message": "..."}` body returned by forgot/reset-password */
export interface MessageResponse {
  message: string;
}

export interface AuthContextValue {
  user: User | null;
  clearUser: () => void;
  /** The server-only REGISTRATION_ENABLED flag, exposed once by the root layout */
  registrationEnabled: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  consents?: UserConsents;
  status?: UserStatus;
  email_verified_at?: string | null;
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
  firstName: me.first_name ?? null,
  lastName: me.last_name ?? null,
  birthDate: me.birth_date ?? null,
  consents: me.consents,
  status: me.status ?? "active",
  emailVerifiedAt: me.email_verified_at ?? null,
  credits: me.credits,
  isSuperadmin: me.is_superadmin,
  createdAt: me.created_at,
  updatedAt: me.updated_at,
});

// --- Card meanings: GET /api/v1/cards/major-arcana/{number} ---

/** The generated write-up for one major arcana card. `number` is the deck index
    (0 = The Fool .. 21 = The World), matching `TarotCardData.idx` */
export interface MajorArcanaMeaningResponse {
  number: number;
  name: string;
  upright: string;
  shadow: string;
}

/** The general meaning of one card of the full deck, shown when a card in a spread is
    clicked. `number` is the deck index (0 = The Fool .. 77 = King of Swords); `meaning`
    is plain prose, paragraphs separated by a blank line, the same for an upright and a
    reversed card */
export interface SpreadCardMeaningResponse {
  number: number;
  name: string;
  meaning: string;
}

// --- Profile dashboard: GET /api/v1/dashboard ---

/** The account slice the dashboard endpoint embeds (no credits/updated_at) */
export interface DashboardUserResponse {
  _id: string;
  email: string;
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
        isSuperadmin: d.user.is_superadmin,
        createdAt: d.user.created_at,
      }
    : { id: "", email: "", isSuperadmin: false, createdAt: "" },
  budgetUsd: d.budget_usd,
  remainingBudgetUsd: d.remaining_budget_usd,
  totalReadings: d.total_readings,
  lastReading: d.last_reading,
  // Tolerate a backend that omits the vocabulary rather than crash the page
  userTags: Array.isArray(d.user_tags) ? d.user_tags : [],
});

// --- Superadmin listing: GET /api/v1/users ---

/** One row of the admin listing. The id is serialised under the `_id` alias. */
export interface AdminUserResponse {
  _id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  status?: UserStatus;
  credits: number;
  is_superadmin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  isSuperadmin: boolean;
  createdAt: string;
}

export const mapAdminUserResponse = (u: AdminUserResponse): AdminUser => ({
  id: u._id,
  email: u.email,
  firstName: u.first_name ?? null,
  lastName: u.last_name ?? null,
  status: u.status ?? "active",
  isSuperadmin: u.is_superadmin,
  createdAt: u.created_at,
});

export const mapUserResponseToUser = (u: UserResponse): User => ({
  id: u.id,
  email: u.email,
  firstName: u.first_name ?? null,
  lastName: u.last_name ?? null,
  birthDate: u.birth_date ?? null,
  consents: u.consents,
  status: u.status ?? "active",
  emailVerifiedAt: u.email_verified_at ?? null,
  credits: u.credits,
  isSuperadmin: u.is_superadmin,
  createdAt: u.created_at,
  updatedAt: u.updated_at,
});
