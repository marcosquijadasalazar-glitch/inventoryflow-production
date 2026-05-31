import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listLocations } from "@/lib/locations";

import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, ArrowRight, ArrowLeft, Check, Boxes, Upload, Users, Database, Rocket, MessageCircle, Play, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import {
  updateOnboardingStep,
  completeOnboarding,
  installDemoData,
  inviteTeamDuringOnboarding,
} from "@/lib/onboarding.functions";
import { NeedHelpCTA } from "./NeedHelpCTA";
import { WhatsAppHelpButton } from "./WhatsAppHelpButton";
import { snoozeWizard } from "./wizard-snooze";
import { setLanguage } from "@/i18n";
import { whatsappUrl, WHATSAPP_ONBOARDING_MESSAGE, QUICK_DEMO_VIDEO_URL } from "@/lib/contact";
import { Link } from "@tanstack/react-router";

type OrgInfo = {
  id: string;
  company_name: string | null;
  business_type: string | null;
  onboarding_step: number | null;
  demo_data_installed: boolean | null;
};

export function WelcomeWizard({ org, onClose }: { org: OrgInfo; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<number>(org.onboarding_step ?? 0);
  const [success, setSuccess] = useState(false);

  // Step 1 form
  const [businessType, setBusinessType] = useState(org.business_type ?? "");
  const [productVolume, setProductVolume] = useState<string>("");
  const [businessSize, setBusinessSize] = useState<string>("");
  const [locationCount, setLocationCount] = useState<string>("");
  const [language, setLanguageLocal] = useState<"en" | "es">(
    (i18n.resolvedLanguage ?? "en").startsWith("es") ? "es" : "en",
  );

  // Step 2
  const [wantDemo, setWantDemo] = useState<boolean | null>(null);

  // Step 4
  const [invites, setInvites] = useState<{ email: string; role: "manager" | "employee" }[]>([
    { email: "", role: "employee" },
  ]);

  const updateFn = useServerFn(updateOnboardingStep);
  const completeFn = useServerFn(completeOnboarding);
  const demoFn = useServerFn(installDemoData);
  const inviteFn = useServerFn(inviteTeamDuringOnboarding);

  const updateStep = useMutation({ mutationFn: (input: any) => updateFn({ data: input }) });

  // "Skip" no longer marks onboarding complete — it snoozes the wizard locally so
  // owners can safely resume from the last saved step via the Continue Setup CTA.
  const snoozeAndClose = () => {
    snoozeWizard();
    setOpen(false);
    onClose();
  };
  const demoMut = useMutation({
    mutationFn: () => demoFn({}),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t("onboarding.demo.installed"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const inviteMut = useMutation({
    mutationFn: (rows: { email: string; role: "manager" | "employee" }[]) =>
      inviteFn({ data: { invites: rows } }),
    onSuccess: (res) => {
      const okCount = res.results.filter((r) => r.ok).length;
      const failCount = res.results.length - okCount;
      if (okCount > 0) toast.success(t("onboarding.invite.success", { count: okCount }));
      if (failCount > 0) toast.error(t("onboarding.invite.partial", { count: failCount }));
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const completeMut = useMutation({
    mutationFn: () => completeFn({}),
    onSuccess: () => {
      qc.invalidateQueries();
      setSuccess(true);
    },
  });

  const STEPS = 4;

  async function goNext() {
    if (step === 1) {
      await updateStep.mutateAsync({
        step: 2,
        business_type: businessType || null,
        business_size: businessSize || null,
        product_volume: productVolume || null,
        location_count: locationCount || null,
        preferred_language: language,
      });
      if (language !== ((i18n.resolvedLanguage ?? "en").startsWith("es") ? "es" : "en")) {
        setLanguage(language);
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (wantDemo === true) {
        await demoMut.mutateAsync();
      }
      await updateStep.mutateAsync({ step: 3 });
      setStep(3);
      return;
    }
    if (step === 3) {
      await updateStep.mutateAsync({ step: 4 });
      setStep(4);
      return;
    }
    if (step === 4) {
      const valid = invites.filter((i) => i.email.trim() && /.+@.+\..+/.test(i.email.trim()));
      if (valid.length > 0) {
        await inviteMut.mutateAsync(valid);
      }
      await completeMut.mutateAsync();
      return;
    }
    if (step === 0) {
      await updateStep.mutateAsync({ step: 1 });
      setStep(1);
    }
  }

  function goBack() {
    if (step > 0) setStep((s) => Math.max(0, s - 1));
  }

  if (success) {
    return (
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onClose(); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <SuccessScreen onClose={() => { setOpen(false); onClose(); }} />
        </DialogContent>
      </Dialog>
    );
  }

  const tipKeyByStep: Record<number, string> = {
    0: "onboarding.tips.welcome",
    1: "onboarding.tips.business",
    2: "onboarding.tips.demo",
    3: "onboarding.tips.import",
    4: "onboarding.tips.invite",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) snoozeAndClose(); else setOpen(o); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-background to-background px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] flex items-center justify-center shadow-soft">
              <Boxes className="h-5 w-5 text-primary-foreground" />
            </div>
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {step === 0 ? t("onboarding.welcome.title") : t("onboarding.wizard.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 0
              ? t("onboarding.welcome.subtitle")
              : t("onboarding.wizard.stepLabel", { step, total: STEPS })}
          </p>
          {step > 0 && (
            <div className="mt-3 flex gap-1.5">
              {Array.from({ length: STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i + 1 <= step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
          {step === 0 && <WelcomeIntro />}
          {step === 1 && (
            <StepBusiness
              businessType={businessType}
              setBusinessType={setBusinessType}
              businessSize={businessSize}
              setBusinessSize={setBusinessSize}
              productVolume={productVolume}
              setProductVolume={setProductVolume}
              locationCount={locationCount}
              setLocationCount={setLocationCount}
              language={language}
              setLanguageLocal={setLanguageLocal}
            />
          )}
          {step === 2 && (
            <StepDemo wantDemo={wantDemo} setWantDemo={setWantDemo} loading={demoMut.isPending} />
          )}
          {step === 3 && <StepImport onOpenImporter={() => { snoozeAndClose(); }} />}
          {step === 4 && <StepInvite invites={invites} setInvites={setInvites} />}

          {/* Calm, operational tip — refreshes per step */}
          <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5">
            <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(tipKeyByStep[step] ?? "onboarding.tips.welcome", {
                defaultValue: "Your progress saves automatically — you can close this and come back anytime.",
              })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {step === 0 ? (
              <Button variant="ghost" size="sm" onClick={snoozeAndClose}>
                {t("onboarding.actions.later", "I'll do this later")}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={goBack} disabled={step === 1 || updateStep.isPending}>
                <ArrowLeft className="h-4 w-4" /> {t("common.back")}
              </Button>
            )}
            <a
              href={whatsappUrl(WHATSAPP_ONBOARDING_MESSAGE)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[oklch(0.45_0.18_150)] hover:text-[oklch(0.4_0.18_150)] inline-flex items-center gap-1"
            >
              <MessageCircle className="h-3.5 w-3.5" /> {t("onboarding.help.needHelp")}
            </a>
          </div>
          <Button
            onClick={goNext}
            disabled={updateStep.isPending || demoMut.isPending || inviteMut.isPending || completeMut.isPending}
          >
            {step === 0
              ? t("onboarding.actions.start")
              : step === STEPS
                ? t("onboarding.actions.finish")
                : t("common.next")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function WelcomeIntro() {
  const { t } = useTranslation();
  const items = [
    { icon: Boxes, key: "feat1" },
    { icon: Database, key: "feat2" },
    { icon: Users, key: "feat3" },
    { icon: Rocket, key: "feat4" },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("onboarding.welcome.intro")}</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((it) => (
          <li key={it.key} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <it.icon className="h-4 w-4" />
            </div>
            <p className="text-sm">{t(`onboarding.welcome.${it.key}`)}</p>
          </li>
        ))}
      </ul>
      <WhatsAppHelpButton variant="card" topic="setup" />
      <NeedHelpCTA />
    </div>
  );
}

function StepBusiness(props: {
  businessType: string;
  setBusinessType: (v: string) => void;
  businessSize: string;
  setBusinessSize: (v: string) => void;
  productVolume: string;
  setProductVolume: (v: string) => void;
  locationCount: string;
  setLocationCount: (v: string) => void;
  language: "en" | "es";
  setLanguageLocal: (v: "en" | "es") => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{t("onboarding.business.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("onboarding.business.subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>{t("onboarding.business.businessType")}</Label>
          <Select value={props.businessType} onValueChange={props.setBusinessType}>
            <SelectTrigger><SelectValue placeholder={t("onboarding.business.selectPlaceholder")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="retail">{t("onboarding.business.types.retail")}</SelectItem>
              <SelectItem value="wholesale">{t("onboarding.business.types.wholesale")}</SelectItem>
              <SelectItem value="ecommerce">{t("onboarding.business.types.ecommerce")}</SelectItem>
              <SelectItem value="warehouse">{t("onboarding.business.types.warehouse")}</SelectItem>
              <SelectItem value="manufacturing">{t("onboarding.business.types.manufacturing")}</SelectItem>
              <SelectItem value="food_beverage">{t("onboarding.business.types.food_beverage")}</SelectItem>
              <SelectItem value="services">{t("onboarding.business.types.services")}</SelectItem>
              <SelectItem value="other">{t("onboarding.business.types.other")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("onboarding.business.productVolume")}</Label>
          <Select value={props.productVolume} onValueChange={props.setProductVolume}>
            <SelectTrigger><SelectValue placeholder={t("onboarding.business.selectPlaceholder")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="<50">{t("onboarding.business.vol.lt50")}</SelectItem>
              <SelectItem value="50-500">{t("onboarding.business.vol.50_500")}</SelectItem>
              <SelectItem value="500-5000">{t("onboarding.business.vol.500_5000")}</SelectItem>
              <SelectItem value=">5000">{t("onboarding.business.vol.gt5000")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("onboarding.business.employees")}</Label>
          <Select value={props.businessSize} onValueChange={props.setBusinessSize}>
            <SelectTrigger><SelectValue placeholder={t("onboarding.business.selectPlaceholder")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t("onboarding.business.size.solo")}</SelectItem>
              <SelectItem value="2-5">{t("onboarding.business.size.s2_5")}</SelectItem>
              <SelectItem value="6-25">{t("onboarding.business.size.s6_25")}</SelectItem>
              <SelectItem value="26-100">{t("onboarding.business.size.s26_100")}</SelectItem>
              <SelectItem value="100+">{t("onboarding.business.size.s100p")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("onboarding.business.locations")}</Label>
          <Select value={props.locationCount} onValueChange={props.setLocationCount}>
            <SelectTrigger><SelectValue placeholder={t("onboarding.business.selectPlaceholder")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2-3">2-3</SelectItem>
              <SelectItem value="4-10">4-10</SelectItem>
              <SelectItem value="10+">10+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("onboarding.business.language")}</Label>
          <Select value={props.language} onValueChange={(v) => props.setLanguageLocal(v as "en" | "es")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function StepDemo({ wantDemo, setWantDemo, loading }: { wantDemo: boolean | null; setWantDemo: (v: boolean) => void; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{t("onboarding.demo.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("onboarding.demo.subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setWantDemo(true)}
          disabled={loading}
          className={`text-left rounded-lg border p-4 transition-all ${
            wantDemo === true ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
          }`}
        >
          <Database className="h-5 w-5 text-primary mb-2" />
          <p className="font-medium">{t("onboarding.demo.yes")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("onboarding.demo.yesDesc")}</p>
        </button>
        <button
          type="button"
          onClick={() => setWantDemo(false)}
          disabled={loading}
          className={`text-left rounded-lg border p-4 transition-all ${
            wantDemo === false ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
          }`}
        >
          <Boxes className="h-5 w-5 text-muted-foreground mb-2" />
          <p className="font-medium">{t("onboarding.demo.no")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("onboarding.demo.noDesc")}</p>
        </button>
      </div>
    </div>
  );
}

function StepImport({ onOpenImporter }: { onOpenImporter: () => void }) {
  const { t } = useTranslation();
  const locQ = useQuery({
    queryKey: ["org-locations-active"],
    queryFn: () => listLocations({ includeInactive: false }),
  });
  const hasLocation = (locQ.data?.length ?? 0) > 0;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{t("onboarding.import.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("onboarding.import.subtitle")}</p>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-surface p-5 text-center">
        <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
        {hasLocation ? (
          <>
            <p className="text-sm font-medium">{t("onboarding.import.helperTitle")}</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">{t("onboarding.import.helperBody")}</p>
            <Button asChild variant="outline" size="sm">
              <Link to="/products" search={{ import: 1 } as any} onClick={onOpenImporter}>
                {t("onboarding.import.openImporter")}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">
              {t("importer.needLocation.title", "Create a location first")}
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              {t(
                "importer.needLocation.body",
                "Products need a location before they can be imported.",
              )}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/locations" onClick={onOpenImporter}>
                {t("importer.needLocation.cta", "Create Location")}
              </Link>
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("onboarding.import.skipHint")}</p>
    </div>
  );
}


function StepInvite({
  invites,
  setInvites,
}: {
  invites: { email: string; role: "manager" | "employee" }[];
  setInvites: (v: { email: string; role: "manager" | "employee" }[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{t("onboarding.invite.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("onboarding.invite.subtitle")}</p>
      </div>
      <div className="space-y-2">
        {invites.map((row, idx) => (
          <div key={idx} className="flex gap-2">
            <Input
              type="email"
              placeholder="name@company.com"
              value={row.email}
              onChange={(e) => {
                const next = [...invites];
                next[idx] = { ...next[idx], email: e.target.value };
                setInvites(next);
              }}
              className="flex-1"
            />
            <Select
              value={row.role}
              onValueChange={(v) => {
                const next = [...invites];
                next[idx] = { ...next[idx], role: v as "manager" | "employee" };
                setInvites(next);
              }}
            >
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">{t("onboarding.invite.roles.employee")}</SelectItem>
                <SelectItem value="manager">{t("onboarding.invite.roles.manager")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setInvites([...invites, { email: "", role: "employee" }])}
        >
          + {t("onboarding.invite.addRow")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("onboarding.invite.skipHint")}</p>
    </div>
  );
}

function SuccessScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="p-6 text-center space-y-5">
      <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary to-[oklch(0.45_0.22_270)] flex items-center justify-center shadow-soft">
        <Check className="h-8 w-8 text-primary-foreground" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t("onboarding.success.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("onboarding.success.subtitle")}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Button onClick={onClose}>
          <Rocket className="h-4 w-4" /> {t("onboarding.success.goDashboard")}
        </Button>
        <Button variant="outline" asChild>
          <a href={QUICK_DEMO_VIDEO_URL} target="_blank" rel="noopener noreferrer">
            <Play className="h-4 w-4" /> {t("onboarding.success.watchDemo")}
          </a>
        </Button>
        <Button
          variant="outline"
          asChild
          className="border-[oklch(0.65_0.18_150)]/30 text-[oklch(0.5_0.18_150)]"
        >
          <a href={whatsappUrl(WHATSAPP_ONBOARDING_MESSAGE)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" /> {t("onboarding.success.whatsapp")}
          </a>
        </Button>
      </div>
    </div>
  );
}
