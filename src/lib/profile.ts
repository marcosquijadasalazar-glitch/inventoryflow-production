import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type AppRole = Profile["role"];

export async function getMyProfile(): Promise<Profile | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) {
    console.error("[profile] fetch error", error);
    return null;
  }
  return data;
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: getMyProfile,
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function isSuperAdmin(role: AppRole | null | undefined) {
  return role === "super_admin";
}

export function canManageOrg(role: AppRole | null | undefined) {
  return role === "super_admin" || role === "owner" || role === "manager";
}
