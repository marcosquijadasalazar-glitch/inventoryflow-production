import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getOnboardingState, getChecklistProgress } from "@/lib/onboarding.functions";

export function useOnboardingState() {
  const { user } = useAuth();
  const fn = useServerFn(getOnboardingState);
  return useQuery({
    queryKey: ["onboarding-state", user?.id],
    queryFn: () => fn({}),
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useChecklistProgress(enabled = true) {
  const { user } = useAuth();
  const fn = useServerFn(getChecklistProgress);
  return useQuery({
    queryKey: ["onboarding-checklist", user?.id],
    queryFn: () => fn({}),
    enabled: !!user && enabled,
    staleTime: 20_000,
  });
}
