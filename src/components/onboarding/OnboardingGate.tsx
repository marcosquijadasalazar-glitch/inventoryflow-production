import { useOnboardingState } from "@/lib/use-onboarding";
import { WelcomeWizard } from "./WelcomeWizard";
import { useWizardSnoozed } from "./wizard-snooze";

/**
 * Renders the Welcome Wizard on top of the app for first-time owners.
 * Returns null if onboarding is complete, snoozed locally, or the user
 * isn't an owner. The wizard is resumable from the last saved step via
 * the ContinueSetupButton.
 */
export function OnboardingGate() {
  const state = useOnboardingState();
  const snoozed = useWizardSnoozed();
  if (!state.data?.hasOrg) return null;
  if (state.data.org?.onboarding_completed) return null;
  // Only owners (and super admin) see the wizard; employees/managers should not be blocked.
  if (state.data.role !== "owner" && state.data.role !== "super_admin") return null;
  if (snoozed) return null; // User closed it — show Continue Setup CTA instead.
  return (
    <WelcomeWizard
      org={state.data.org as any}
      onClose={() => {
        /* react-query refetch will hide it once completed */
      }}
    />
  );
}
