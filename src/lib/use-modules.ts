import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getMyEnabledModules } from "@/lib/modules.functions";
import { ALL_ENABLED, type ModuleKey, type ModuleMap } from "@/lib/modules";

export function useEnabledModules(): {
  modules: ModuleMap;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const fetchModules = useServerFn(getMyEnabledModules);
  const q = useQuery({
    queryKey: ["enabled-modules", user?.id],
    queryFn: () => fetchModules({}),
    enabled: !!user,
    staleTime: 60_000,
  });
  return { modules: q.data ?? ALL_ENABLED, isLoading: q.isLoading };
}

export function useIsModuleEnabled(key: ModuleKey): boolean {
  const { modules } = useEnabledModules();
  return modules[key];
}
