import { useOnboardingState } from "@/lib/use-onboarding";
import { WelcomeWizard } from "./WelcomeWizard";

/**
 * Renders the Welcome Wizard on top of the app for first-time owners.
 * Returns null otherwise.
 */
export function OnboardingGate() {
  const state = useOnboardingState();
  if (!state.data?.hasOrg) return null;
  if (state.data.org?.onboarding_completed) return null;
  // Only owners (and super admin) see the wizard; employees/managers should not be blocked.
  if (state.data.role !== "owner" && state.data.role !== "super_admin") return null;
  return (
    <WelcomeWizard
      org={state.data.org as any}
      onClose={() => {
        /* react-query refetch will hide it once completed */
      }}
    />
  );
}
