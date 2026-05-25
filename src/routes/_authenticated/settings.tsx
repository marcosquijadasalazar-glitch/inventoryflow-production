import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadLogo } from "@/lib/settings";
import { getCompanyProfile, updateCompanyProfile } from "@/lib/company-profile.functions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CategoryManagerCard } from "@/components/CategoryManagerCard";
import { UsageSummaryCard } from "@/components/PlanLimitBanner";
import { useOrgUsage } from "@/lib/use-org-usage";
import { BillingPanel } from "@/components/billing/BillingPanel";
import { Building2, Upload, Trash2, Settings as Cog, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type ProfileForm = {
  company_name: string;
  logo_url: string | null;
  business_type: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
  currency: string;
  tax_id: string;
  website: string;
  footer_notes: string;
};

const EMPTY: ProfileForm = {
  company_name: "",
  logo_url: null,
  business_type: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  country: "",
  timezone: "",
  currency: "",
  tax_id: "",
  website: "",
  footer_notes: "",
};

function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getCompanyProfile);
  const saveProfile = useServerFn(updateCompanyProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => fetchProfile({ data: {} }),
  });
  const usageQ = useOrgUsage();
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canEdit = !!data?.canEdit;
  const canEditRestricted = !!(data as any)?.canEditRestricted;

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile as any;
      setForm({
        company_name: p.company_name ?? "",
        logo_url: p.logo_url ?? null,
        business_type: p.business_type ?? "",
        phone: p.phone ?? "",
        email: p.email ?? "",
        address: p.address ?? "",
        city: p.city ?? "",
        country: p.country ?? "",
        timezone: p.timezone ?? "",
        currency: p.currency ?? "",
        tax_id: p.tax_id ?? "",
        website: p.website ?? "",
        footer_notes: p.footer_notes ?? "",
      });
    }
  }, [data]);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await saveProfile({ data: { values: form as any } });
      toast.success(t("settings.saved"));
      qc.invalidateQueries({ queryKey: ["company-profile"] });
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;
    setUploading(true);
    try {
      const orgId = (data?.profile as any)?.organization_id as string | undefined;
      if (!orgId) throw new Error("Missing organization");
      const url = await uploadLogo(file, orgId);
      set("logo_url", url);
      await saveProfile({ data: { values: { ...form, logo_url: url } as any } });
      qc.invalidateQueries({ queryKey: ["company-profile"] });
      toast.success(t("settings.saved"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!canEdit) return;
    set("logo_url", null);
    try {
      await saveProfile({ data: { values: { ...form, logo_url: null } as any } });
      qc.invalidateQueries({ queryKey: ["company-profile"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const disabled = !canEdit || isLoading;

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Cog className="h-6 w-6 text-primary" />
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings.subtitle")}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> {t("settings.companyProfile")}
            {!canEdit && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Lock className="h-3 w-3" /> {t("settings.readOnly")}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.logo")}</Label>
            <div className="flex items-center gap-4">
              {form.logo_url ? (
                <img
                  src={form.logo_url}
                  alt="logo"
                  className="h-16 w-16 object-contain rounded border border-border bg-white p-1"
                />
              ) : (
                <div className="h-16 w-16 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                  —
                </div>
              )}
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" disabled={disabled || uploading}>
                  <label className={canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-60"}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {uploading ? t("common.loading") : t("settings.uploadLogo")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onLogo}
                      disabled={disabled}
                    />
                  </label>
                </Button>
                {form.logo_url && canEdit && (
                  <Button variant="ghost" size="sm" onClick={removeLogo}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    {t("settings.removeLogo")}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("settings.companyName")} locked={!canEditRestricted}>
              <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} disabled={disabled || !canEditRestricted} />
            </Field>
            <Field label={t("settings.businessType")} locked={!canEditRestricted}>
              <Input value={form.business_type} onChange={(e) => set("business_type", e.target.value)} disabled={disabled || !canEditRestricted} />
            </Field>
            <Field label={t("settings.phone")}>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={disabled} />
            </Field>
            <Field label={t("common.email")}>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={disabled} />
            </Field>
            <Field label={t("settings.website")}>
              <Input value={form.website} onChange={(e) => set("website", e.target.value)} disabled={disabled} placeholder="https://" />
            </Field>
            <Field label={t("settings.taxId")} locked={!canEditRestricted}>
              <Input value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} disabled={disabled || !canEditRestricted} />
            </Field>
            <Field label={t("settings.address")} className="sm:col-span-2">
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} disabled={disabled} />
            </Field>
            <Field label={t("settings.city")}>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} disabled={disabled} />
            </Field>
            <Field label={t("settings.country")}>
              <Input value={form.country} onChange={(e) => set("country", e.target.value)} disabled={disabled} />
            </Field>
            <Field label={t("settings.timezone")} locked={!canEditRestricted}>
              <Input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} disabled={disabled || !canEditRestricted} placeholder="America/New_York" />
            </Field>
            <Field label={t("settings.currency")} locked={!canEditRestricted}>
              <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} disabled={disabled || !canEditRestricted} placeholder="USD" maxLength={10} />
            </Field>
            <Field label={t("settings.footerNotes")} className="sm:col-span-2">
              <Textarea rows={2} value={form.footer_notes} onChange={(e) => set("footer_notes", e.target.value)} disabled={disabled} />
            </Field>
          </div>

          {canEdit && !canEditRestricted && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              {t("settings.ownerLockedHint")}
            </p>
          )}

          {canEdit && (
            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={saving || isLoading}>
                {saving ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <BillingPanel />
      <UsageSummaryCard usage={usageQ.data ?? undefined} />
      <CategoryManagerCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <LanguageSwitcher />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, className, locked, children }: { label: string; className?: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="flex items-center gap-1.5">
        {label}
        {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
      </Label>
      {children}
    </div>
  );
}
