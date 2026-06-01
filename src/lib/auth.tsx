import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { heartbeatPresence, logAuthSecurityEvent } from "@/lib/security.functions";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
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
  const logEvent = logAuthSecurityEvent;
  const heartbeat = heartbeatPresence;

  useEffect(() => {
    // Set up listener FIRST, then read existing session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setLoading(false);
      const fingerprint = getDeviceFingerprint();
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
      if (event === "SIGNED_IN" && newSession) {
        void logEvent({
          data: {
            action: "sign_in_success",
            status: "success",
            user_agent: ua,
            device_fingerprint: fingerprint,
          },
        }).catch(() => {});
        void heartbeat({
          data: {
            is_online: true,
            user_agent: ua,
            device_fingerprint: fingerprint,
          },
        }).catch(() => {});
      }
      if (event === "TOKEN_REFRESHED" && newSession) {
        void logEvent({
          data: {
            action: "session_refresh",
            status: "success",
            user_agent: ua,
            device_fingerprint: fingerprint,
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
          device_fingerprint: getDeviceFingerprint(),
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
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
        const fingerprint = getDeviceFingerprint();
        await logEvent({
          data: {
            action: "logout",
            status: "success",
            user_agent: ua,
            device_fingerprint: fingerprint,
          },
        });
        await heartbeat({
          data: {
            is_online: false,
            user_agent: ua,
            device_fingerprint: fingerprint,
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
