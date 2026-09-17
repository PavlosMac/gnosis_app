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
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;
