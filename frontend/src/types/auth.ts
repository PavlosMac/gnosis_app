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

export const mapUserResponseToUser = (u: UserResponse): User => ({
  id: u.id,
  email: u.email,
  displayName: u.display_name,
  credits: u.credits,
  isSuperadmin: u.is_superadmin,
  createdAt: u.created_at,
  updatedAt: u.updated_at,
});
