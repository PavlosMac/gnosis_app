"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { User, AuthContextValue } from "@/types/auth";

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  initialUser: User | null;
  /** REGISTRATION_ENABLED is a server-only env var; the root layout reads it
      once and every client component gets it from `useAuth()` */
  registrationEnabled?: boolean;
  children: React.ReactNode;
}

export const AuthProvider = ({
  initialUser,
  registrationEnabled = false,
  children,
}: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(initialUser);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const clearUser = useCallback(() => setUser(null), []);

  return (
    <AuthContext.Provider value={{ user, clearUser, registrationEnabled }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
