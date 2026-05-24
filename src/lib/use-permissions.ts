import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPermissions } from "@/lib/permissions.functions";
import { ALL_PERMISSIONS, type AppPermission } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";

export function usePermissions() {
  const { session } = useAuth();
  const profile = useProfile();
  const fetchPerms = useServerFn(getMyPermissions);
  const q = useQuery({
    queryKey: ["my-permissions", session?.user?.id],
    queryFn: () => fetchPerms({}),
    enabled: !!session,
    staleTime: 60_000,
  });

  const isSuper = profile.data?.role === "super_admin";
  const isOwner = profile.data?.role === "owner";

  const map = q.data ?? null;

  const can = (perm: AppPermission): boolean => {
    if (isSuper || isOwner) return true;
    if (!map) return false; // deny while loading
    return !!map[perm];
  };

  const canAny = (perms: AppPermission[]) => perms.some(can);

  return {
    isLoading: q.isLoading && !q.data,
    isSuper,
    isOwner,
    can,
    canAny,
    permissions: map ?? (Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, false])) as Record<AppPermission, boolean>),
  };
}
