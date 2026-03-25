export interface User {
  id: string;
  email: string;
  displayName: string | null;
  credits: number;
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

export const mapMeResponseToUser = (me: MeResponse): User => ({
  id: me._id,
  email: me.email,
  displayName: me.display_name,
  credits: me.credits,
  createdAt: me.created_at,
  updatedAt: me.updated_at,
});
