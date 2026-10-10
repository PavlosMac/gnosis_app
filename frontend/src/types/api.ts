export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  status: number;
  message: string;
  // The session is gone (no token, or refresh failed) — a retry cannot succeed
  unauthenticated?: boolean;
  /** Machine-readable discriminator from the backend's error body, when it
      sends one (e.g. "email_not_verified" on a 403 from /auth/login) */
  code?: string;
  /** The backend's own message. Present only alongside a `code`; show it to a
      user only for codes whose detail is written for them ("weak_password") —
      everything else uses the safe `message` */
  detail?: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;
