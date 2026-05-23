import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getMyOrgUsage } from "@/lib/usage.functions";
import type { OrgUsage } from "@/lib/plan-limits";

export function useOrgUsage() {
  const { user } = useAuth();
  const fn = useServerFn(getMyOrgUsage);
  return useQuery<OrgUsage | null>({
    queryKey: ["org-usage", user?.id],
    queryFn: () => fn({}),
    enabled: !!user,
    staleTime: 15_000,
  });
}
