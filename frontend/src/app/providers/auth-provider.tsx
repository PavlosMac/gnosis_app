"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { User, AuthContextValue } from "@/types/auth";

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  initialUser: User | null;
  children: React.ReactNode;
}

export const AuthProvider = ({ initialUser, children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(initialUser);

  const clearUser = useCallback(() => setUser(null), []);

  return (
    <AuthContext.Provider value={{ user, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
