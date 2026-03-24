export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  status: number;
  message: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;
