const SNOOZE_KEY = "iflow:onboarding-wizard-snoozed";

export function isWizardSnoozed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SNOOZE_KEY) === "1";
  } catch {
    return false;
  }
}

export function snoozeWizard() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNOOZE_KEY, "1");
    window.dispatchEvent(new Event("iflow:onboarding-snooze-change"));
  } catch {
    /* ignore */
  }
}

export function resumeWizard() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SNOOZE_KEY);
    window.dispatchEvent(new Event("iflow:onboarding-snooze-change"));
  } catch {
    /* ignore */
  }
}

import { useEffect, useState } from "react";

export function useWizardSnoozed(): boolean {
  const [snoozed, setSnoozed] = useState<boolean>(() => isWizardSnoozed());
  useEffect(() => {
    const sync = () => setSnoozed(isWizardSnoozed());
    window.addEventListener("iflow:onboarding-snooze-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("iflow:onboarding-snooze-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return snoozed;
}
