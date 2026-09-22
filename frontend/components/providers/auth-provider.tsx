"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, clearTokens } from "@/services/api";
import type { ConversationSummary, MaleRequest, MeResponse, User } from "@/types";
type Ctx = {
  user: User | null;
  activeRequest: MaleRequest | null;
  conversation: ConversationSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<Ctx>({
  user: null,
  activeRequest: null,
  conversation: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeRequest, setActiveRequest] = useState<MaleRequest | null>(null);
  const [conversation, setConversation] =
    useState<ConversationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const path = usePathname();
  const applySession = useCallback((value: MeResponse) => {
    setUser(value.user || value);
    setActiveRequest(value.active_request ?? null);
    setConversation(value.conversation ?? null);
  }, []);
  const clearSession = useCallback(() => {
    setUser(null);
    setActiveRequest(null);
    setConversation(null);
  }, []);
  const refresh = useCallback(async () => {
    try {
      applySession(await api.me());
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [applySession, clearSession]);
  useEffect(() => {
    let active = true;
    api.me().then(
      (value) => { if (active) { applySession(value); setLoading(false); } },
      () => { if (active) { clearSession(); setLoading(false); } },
    );
    return () => { active = false; };
  }, [path, applySession, clearSession]);
  const signOut = async () => {
    const destination =
      user?.role === "SUPER_ADMIN" || user?.role === "MATCHMAKER"
        ? "/auth/staff-login"
        : "/auth/login";
    try {
      await api.logout();
    } catch {
      clearTokens();
    }
    clearSession();
    router.replace(destination);
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        activeRequest,
        conversation,
        loading,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
