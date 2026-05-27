import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { heartbeatPresence, logAuthSecurityEvent } from "@/lib/security.functions";
import "@/i18n";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const logEvent = useServerFn(logAuthSecurityEvent);
  const heartbeat = useServerFn(heartbeatPresence);

  useEffect(() => {
    // Set up listener FIRST, then read existing session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setLoading(false);
      if (event === "SIGNED_IN" && newSession) {
        void logEvent({
          data: {
            action: "sign_in_success",
            status: "success",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        }).catch(() => {});
        void heartbeat({
          data: {
            is_online: true,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        }).catch(() => {});
      }
      if (event === "TOKEN_REFRESHED" && newSession) {
        void logEvent({
          data: {
            action: "session_refresh",
            status: "success",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        }).catch(() => {});
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const tick = () =>
      heartbeat({
        data: {
          is_online: true,
          current_page: typeof window !== "undefined" ? window.location.pathname : null,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        },
      }).catch(() => {});
    tick();
    const id = setInterval(tick, 45000);
    const onVis = () => tick();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
  }, [session, heartbeat]);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signOut: async () => {
      try {
        await logEvent({
          data: {
            action: "logout",
            status: "success",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        });
        await heartbeat({
          data: {
            is_online: false,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          },
        });
      } catch {
        // best effort
      }
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
