import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadLogo } from "@/lib/settings";
import { getCompanyProfile, updateCompanyProfile } from "@/lib/company-profile.functions";
import {
  getOrganizationPreferences,
  updateOrganizationPreferences,
} from "@/lib/org-preferences.functions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CategoryManagerCard } from "@/components/CategoryManagerCard";
import { UsageSummaryCard } from "@/components/PlanLimitBanner";
import { useOrgUsage } from "@/lib/use-org-usage";
import { BillingPanel } from "@/components/billing/BillingPanel";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  Upload,
  Trash2,
  Lock,
  User as UserIcon,
  Bell,
  ShieldCheck,
  CreditCard,
  SlidersHorizontal,
  Loader2,
  Globe,
  ScanLine,
  KeyRound,
  Activity,
  ClipboardList,
  ChevronRight,
  Users as UsersIcon,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { UsersPage } from "./users";
import { PermissionsMatrix } from "@/components/PermissionsMatrix";
import { ApprovalsTab } from "@/components/approvals/ApprovalsTab";
import { AuditLogsPage } from "./audit-logs";
import { SecurityActivityPage } from "./security-activity";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsHub,
});

const TABS = ["account", "organization", "team", "permissions", "approvals", "security", "audit", "notifications", "billing", "preferences"] as const;
type TabKey = (typeof TABS)[number];

function SettingsHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tab = useRouterState({
    select: (s) => {
      const v = (s.location.search as any)?.tab as string | undefined;
      return (TABS as readonly string[]).includes(v ?? "") ? (v as TabKey) : "account";
    },
  });
  const setTab = (v: string) =>
    navigate({ to: "/settings", search: (prev: any) => ({ ...prev, tab: v }) });

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title", "Settings")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, organization, and application preferences.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="account" className="gap-1.5"><UserIcon className="h-3.5 w-3.5" /> My Account</TabsTrigger>
          <TabsTrigger value="organization" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Organization</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><UsersIcon className="h-3.5 w-3.5" /> Team & Users</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Permissions</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Approval Policies</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Security</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Audit Logs</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-3.5 w-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Billing</TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-6"><AccountTab /></TabsContent>
        <TabsContent value="organization" className="mt-6"><OrganizationTab /></TabsContent>
        <TabsContent value="team" className="mt-6"><UsersPage embedded /></TabsContent>
        <TabsContent value="permissions" className="mt-6"><PermissionsTab /></TabsContent>
        <TabsContent value="approvals" className="mt-6"><ApprovalsTab /></TabsContent>
        <TabsContent value="security" className="mt-6"><SecurityTab /></TabsContent>
        <TabsContent value="audit" className="mt-6"><AuditLogsPage /></TabsContent>
        <TabsContent value="notifications" className="mt-6"><NotificationsTab /></TabsContent>
        <TabsContent value="billing" className="mt-6"><BillingTab /></TabsContent>
        <TabsContent value="preferences" className="mt-6"><PreferencesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function PermissionsTab() {
  const profile = useProfile();
  const role = profile.data?.role;
  const canAccess = role === "owner" || role === "manager" || role === "super_admin";
  if (!canAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Not available
          </CardTitle>
          <CardDescription>Ask your organization owner for access to roles & permissions.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Roles & Permissions</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage roles and permissions for your organization.</p>
      </div>
      <PermissionsMatrix />
    </div>
  );
}

/* ---------- My Account ---------- */
function AccountTab() {
  const { user } = useAuth();
  const profile = useProfile();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="h-4 w-4" /> Profile information
          </CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Input value={profile.data?.role ?? "—"} disabled />
          </div>
          <p className="text-xs text-muted-foreground">
            Email and role changes are managed by your organization owner.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Password
          </CardTitle>
          <CardDescription>Update your password regularly to keep your account safe.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/change-password">Change password</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Organization ---------- */
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
const EMPTY_PROFILE: ProfileForm = {
  company_name: "", logo_url: null, business_type: "", phone: "", email: "",
  address: "", city: "", country: "", timezone: "", currency: "", tax_id: "",
  website: "", footer_notes: "",
};

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Sao_Paulo", "America/Mexico_City", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Europe/Madrid", "Europe/Rome", "Africa/Johannesburg", "Asia/Dubai", "Asia/Kolkata",
  "Asia/Singapore", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney",
];
const CURRENCIES = ["USD", "EUR", "GBP", "BRL", "MXN", "CAD", "AUD", "JPY", "INR", "AED", "SGD", "ZAR"];

// TODO: persist when organization_preferences columns exist
type LocalOrgPrefs = {
  showProductImages: boolean;
  compactListView: boolean;
  requireNotesOnAdjustments: boolean;
};
const DEFAULT_LOCAL_ORG_PREFS: LocalOrgPrefs = {
  showProductImages: true,
  compactListView: false,
  requireNotesOnAdjustments: false,
};

function ReadOnlyBadge() {
  return (
    <span className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
      <Lock className="h-3 w-3" /> Read-only
    </span>
  );
}

function OrganizationTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getCompanyProfile);
  const saveProfile = useServerFn(updateCompanyProfile);
  const savePrefs = useServerFn(updateOrganizationPreferences);
  const { data, isLoading } = useQuery({
    queryKey: ["company-profile"],
    queryFn: () => fetchProfile({ data: {} }),
  });
  const { data: prefsData, isLoading: prefsLoading, error: prefsError } = useOrgPrefs();
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE);
  const [regional, setRegional] = useState({ timezone: "", currency: "" });
  const [localPrefs, setLocalPrefs] = useState<LocalOrgPrefs>(DEFAULT_LOCAL_ORG_PREFS);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRegional, setSavingRegional] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canEditProfile = !!data?.canEdit;
  const canEditRestricted = !!(data as any)?.canEditRestricted;
  const canEditRegional = !!prefsData?.canEdit;
  const regionalReadOnly = !canEditRegional || prefsLoading;

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile as any;
      setForm({
        company_name: p.company_name ?? "", logo_url: p.logo_url ?? null,
        business_type: p.business_type ?? "", phone: p.phone ?? "",
        email: p.email ?? "", address: p.address ?? "", city: p.city ?? "",
        country: p.country ?? "", timezone: p.timezone ?? "",
        currency: p.currency ?? "", tax_id: p.tax_id ?? "",
        website: p.website ?? "", footer_notes: p.footer_notes ?? "",
      });
    }
  }, [data]);

  useEffect(() => {
    if (prefsData?.preferences) {
      const p = prefsData.preferences as OrgPrefs;
      setRegional({
        timezone: p.timezone ?? "",
        currency: p.currency ?? "",
      });
    } else if (data?.profile) {
      const p = data.profile as any;
      setRegional({
        timezone: p.timezone ?? "",
        currency: p.currency ?? "",
      });
    }
  }, [prefsData, data]);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const saveProfileChanges = async () => {
    if (!canEditProfile) return;
    setSavingProfile(true);
    try {
      await saveProfile({ data: { values: form as any } });
      toast.success(t("settings.saved", "Saved"));
      qc.invalidateQueries({ queryKey: ["company-profile"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingProfile(false); }
  };

  const saveRegionalChanges = async () => {
    if (!canEditRegional) return;
    setSavingRegional(true);
    try {
      await savePrefs({
        data: {
          values: {
            timezone: regional.timezone || null,
            currency: regional.currency || null,
          },
        },
      });
      toast.success(t("settings.saved", "Saved"));
      qc.invalidateQueries({ queryKey: ["org-preferences"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingRegional(false); }
  };

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEditProfile) return;
    setUploading(true);
    try {
      const orgId = (data?.profile as any)?.organization_id as string | undefined;
      if (!orgId) throw new Error("Missing organization");
      const url = await uploadLogo(file, orgId);
      set("logo_url", url);
      await saveProfile({ data: { values: { ...form, logo_url: url } as any } });
      qc.invalidateQueries({ queryKey: ["company-profile"] });
      toast.success(t("settings.saved", "Saved"));
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const removeLogo = async () => {
    if (!canEditProfile) return;
    set("logo_url", null);
    try {
      await saveProfile({ data: { values: { ...form, logo_url: null } as any } });
      qc.invalidateQueries({ queryKey: ["company-profile"] });
    } catch (err: any) { toast.error(err.message); }
  };

  const profileDisabled = !canEditProfile || isLoading;

  if (isLoading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      {/* Organization Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Organization profile
            {!canEditProfile && <ReadOnlyBadge />}
          </CardTitle>
          <CardDescription>Your organization name and logo appear across reports, PDFs, and the app header.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-start">
            <div className="space-y-2">
              <Label>{t("settings.logo", "Logo")}</Label>
              <div
                className={`relative h-24 w-24 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden ${
                  form.logo_url ? "border-border bg-white" : "border-muted-foreground/30 bg-muted/30"
                }`}
              >
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Organization logo" className="h-full w-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground px-2 text-center">
                    <Building2 className="h-6 w-6 opacity-50" />
                    <span className="text-[10px] leading-tight">No logo uploaded</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Button asChild variant="outline" size="sm" disabled={profileDisabled || uploading} className="w-full">
                  <label className={canEditProfile ? "cursor-pointer" : "cursor-not-allowed opacity-60"}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {uploading ? "Uploading…" : t("settings.uploadLogo", "Upload logo")}
                    <input type="file" accept="image/*" className="hidden" onChange={onLogo} disabled={profileDisabled} />
                  </label>
                </Button>
                {form.logo_url && canEditProfile && (
                  <Button variant="ghost" size="sm" onClick={removeLogo} className="w-full">
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {t("settings.removeLogo", "Remove logo")}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Field label={t("settings.companyName", "Organization name")} locked={!canEditRestricted}>
                <Input
                  value={form.company_name}
                  onChange={(e) => set("company_name", e.target.value)}
                  disabled={profileDisabled || !canEditRestricted}
                  placeholder="Your organization name"
                />
              </Field>
              <Field label={t("settings.businessType", "Business type")} locked={!canEditRestricted}>
                <Input
                  value={form.business_type}
                  onChange={(e) => set("business_type", e.target.value)}
                  disabled={profileDisabled || !canEditRestricted}
                  placeholder="e.g. Retail, Wholesale, Manufacturing"
                />
              </Field>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Contact &amp; billing details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("settings.phone", "Phone")}>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={profileDisabled} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={profileDisabled} />
              </Field>
              <Field label={t("settings.website", "Website")}>
                <Input value={form.website} onChange={(e) => set("website", e.target.value)} disabled={profileDisabled} placeholder="https://" />
              </Field>
              <Field label={t("settings.taxId", "Tax ID")} locked={!canEditRestricted}>
                <Input value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} disabled={profileDisabled || !canEditRestricted} />
              </Field>
              <Field label={t("settings.address", "Address")} className="sm:col-span-2">
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} disabled={profileDisabled} />
              </Field>
              <Field label={t("settings.city", "City")}>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} disabled={profileDisabled} />
              </Field>
              <Field label={t("settings.country", "Country")}>
                <Input value={form.country} onChange={(e) => set("country", e.target.value)} disabled={profileDisabled} />
              </Field>
              <Field label={t("settings.footerNotes", "PDF footer notes")} className="sm:col-span-2">
                <Textarea rows={2} value={form.footer_notes} onChange={(e) => set("footer_notes", e.target.value)} disabled={profileDisabled} />
              </Field>
            </div>
          </div>

          {canEditProfile && !canEditRestricted && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> {t("settings.ownerLockedHint", "Some fields can only be changed by an administrator.")}
            </p>
          )}

          {canEditProfile && (
            <div className="flex justify-end pt-2">
              <Button onClick={saveProfileChanges} disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regional Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" /> Regional settings
            {regionalReadOnly && <ReadOnlyBadge />}
          </CardTitle>
          <CardDescription>Timezone and currency used for reports, timestamps, and monetary values.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefsError && (
            <p className="text-xs text-muted-foreground">
              Showing saved regional values. Only owners and managers can change these settings.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div className="space-y-1.5">
              <Label>{t("settings.timezone", "Timezone")}</Label>
              <Select
                value={regional.timezone}
                onValueChange={(v) => setRegional((r) => ({ ...r, timezone: v }))}
                disabled={regionalReadOnly}
              >
                <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
                <SelectContent>{TIMEZONES.map((tz) => (<SelectItem key={tz} value={tz}>{tz}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.currency", "Currency")}</Label>
              <Select
                value={regional.currency}
                onValueChange={(v) => setRegional((r) => ({ ...r, currency: v }))}
                disabled={regionalReadOnly}
              >
                <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          {canEditRegional && (
            <div className="flex justify-end pt-2">
              <Button onClick={saveRegionalChanges} disabled={savingRegional || prefsLoading}>
                {savingRegional ? "Saving…" : "Save regional settings"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferences (placeholders) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" /> Preferences
            {!canEditProfile && <ReadOnlyBadge />}
          </CardTitle>
          <CardDescription>Organization-wide defaults and display options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* TODO: persist show_product_images when organization_preferences column exists */}
          <ToggleRow
            label="Show product images in lists"
            hint="Display thumbnail previews in inventory and product tables."
            checked={localPrefs.showProductImages}
            onChange={(v) => setLocalPrefs((p) => ({ ...p, showProductImages: v }))}
            disabled={!canEditProfile}
          />
          {/* TODO: persist compact_list_view when organization_preferences column exists */}
          <ToggleRow
            label="Compact list view"
            hint="Use denser rows to fit more items on screen."
            checked={localPrefs.compactListView}
            onChange={(v) => setLocalPrefs((p) => ({ ...p, compactListView: v }))}
            disabled={!canEditProfile}
          />
          {/* TODO: persist require_notes_on_adjustments when organization_preferences column exists */}
          <ToggleRow
            label="Require notes on stock adjustments"
            hint="Team members must enter a reason when adjusting inventory."
            checked={localPrefs.requireNotesOnAdjustments}
            onChange={(v) => setLocalPrefs((p) => ({ ...p, requireNotesOnAdjustments: v }))}
            disabled={!canEditProfile}
          />
          {canEditProfile && (
            <p className="text-xs text-muted-foreground pt-1">
              These preferences are preview-only and will be saved once backend support is added.
            </p>
          )}
        </CardContent>
      </Card>

      <CategoryManagerCard />
    </div>
  );
}

/* ---------- Org preferences shared hook ---------- */
type OrgPrefs = {
  timezone: string | null; currency: string | null; language: string | null;
  default_location_id: string | null; default_low_stock_threshold: number;
  scanner_auto_commit: boolean; scanner_sound: boolean; scanner_haptics: boolean;
  notify_low_stock: boolean; notify_transfers: boolean;
  notify_security: boolean; notify_billing: boolean;
  manager_can_edit_org_settings: boolean;
  contact_phone: string | null; contact_email: string | null; contact_address: string | null;
};

function useOrgPrefs() {
  const fetchPrefs = useServerFn(getOrganizationPreferences);
  return useQuery({
    queryKey: ["org-preferences"],
    queryFn: () => fetchPrefs(),
    retry: false,
  });
}

function NoOrgAccessCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4" /> Not available
        </CardTitle>
        <CardDescription>Ask your organization owner for access to these settings.</CardDescription>
      </CardHeader>
    </Card>
  );
}

/* ---------- Notifications ---------- */
function NotificationsTab() {
  const qc = useQueryClient();
  const savePrefs = useServerFn(updateOrganizationPreferences);
  const { data, isLoading, error } = useOrgPrefs();
  const [form, setForm] = useState<OrgPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data?.preferences) setForm({ ...(data.preferences as any) }); }, [data]);
  if (error) return <NoOrgAccessCard />;
  if (isLoading || !form) return <LoadingBlock />;
  const canEdit = !!data?.canEdit;
  const disabled = !canEdit || saving;
  const set = <K extends keyof OrgPrefs>(k: K, v: OrgPrefs[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));
  const save = async () => {
    if (!form || !canEdit) return;
    setSaving(true);
    try {
      await savePrefs({ data: { values: {
        notify_low_stock: form.notify_low_stock, notify_transfers: form.notify_transfers,
        notify_security: form.notify_security, notify_billing: form.notify_billing,
      } } });
      toast.success("Preferences saved");
      qc.invalidateQueries({ queryKey: ["org-preferences"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle>
        <CardDescription>Choose which updates your organization should receive.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ToggleRow label="Low stock alerts" hint="Notify the team when a product runs low." checked={form.notify_low_stock} onChange={(v) => set("notify_low_stock", v)} disabled={disabled} />
        <ToggleRow label="Transfer updates" hint="When transfers are created, received or completed." checked={form.notify_transfers} onChange={(v) => set("notify_transfers", v)} disabled={disabled} />
        <ToggleRow label="Security activity" hint="Suspicious sign-ins or unusual permission changes." checked={form.notify_security} onChange={(v) => set("notify_security", v)} disabled={disabled} />
        <ToggleRow label="Billing & trial" hint="Trial reminders and payment issues." checked={form.notify_billing} onChange={(v) => set("notify_billing", v)} disabled={disabled} />
        {canEdit && (
          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Security ---------- */
function SecurityTab() {
  const profile = useProfile();
  const role = profile.data?.role;
  const showOrgLinks = role === "owner" || role === "manager" || role === "super_admin";
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Account security</CardTitle>
          <CardDescription>Manage your password and session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <LinkRow to="/change-password" icon={<KeyRound className="h-4 w-4" />} label="Change password" hint="Update your password regularly." />
        </CardContent>
      </Card>

      {showOrgLinks && <SecurityActivityPage />}
    </div>
  );
}

function LinkRow({ to, icon, label, hint }: { to: string; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-muted transition">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

/* ---------- Billing ---------- */
function BillingTab() {
  const usageQ = useOrgUsage();
  return (
    <div className="space-y-6">
      <BillingPanel />
      <UsageSummaryCard usage={usageQ.data ?? undefined} />
    </div>
  );
}

/* ---------- Preferences ---------- */
const LANGUAGES = [
  { code: "en", label: "English" }, { code: "es", label: "Español" },
  { code: "pt", label: "Português" }, { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
];

function PreferencesTab() {
  const qc = useQueryClient();
  const savePrefs = useServerFn(updateOrganizationPreferences);
  const { data, isLoading, error } = useOrgPrefs();
  const [form, setForm] = useState<OrgPrefs | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data?.preferences) setForm({ ...(data.preferences as any) }); }, [data]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: locs } = await supabase.from("locations").select("id, name").eq("is_active", true).order("name");
      if (!cancelled) setLocations(locs ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  // Personal language is always editable
  const personalLang = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Display language</CardTitle>
        <CardDescription>Personal language for your interface.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-xs"><LanguageSwitcher /></div>
      </CardContent>
    </Card>
  );

  if (error) return <div className="space-y-6">{personalLang}<NoOrgAccessCard /></div>;
  if (isLoading || !form) return <div className="space-y-6">{personalLang}<LoadingBlock /></div>;

  const canEdit = !!data?.canEdit;
  const disabled = !canEdit || saving;
  const set = <K extends keyof OrgPrefs>(k: K, v: OrgPrefs[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form || !canEdit) return;
    setSaving(true);
    try {
      await savePrefs({ data: { values: {
        timezone: form.timezone, currency: form.currency, language: form.language,
        default_location_id: form.default_location_id,
        default_low_stock_threshold: form.default_low_stock_threshold,
        scanner_auto_commit: form.scanner_auto_commit,
        scanner_sound: form.scanner_sound, scanner_haptics: form.scanner_haptics,
      } } });
      toast.success("Preferences saved");
      qc.invalidateQueries({ queryKey: ["org-preferences"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      {personalLang}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Organization localization</CardTitle>
          <CardDescription>Timezone, currency and default language for your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select value={form.timezone ?? ""} onValueChange={(v) => set("timezone", v || null)} disabled={disabled}>
              <SelectTrigger><SelectValue placeholder="Select timezone" /></SelectTrigger>
              <SelectContent>{TIMEZONES.map((tz) => (<SelectItem key={tz} value={tz}>{tz}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Select value={form.currency ?? ""} onValueChange={(v) => set("currency", v || null)} disabled={disabled}>
              <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Default language</Label>
            <Select value={form.language ?? ""} onValueChange={(v) => set("language", v || null)} disabled={disabled}>
              <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
              <SelectContent>{LANGUAGES.map((l) => (<SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>))}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ScanLine className="h-4 w-4" /> Operational defaults</CardTitle>
          <CardDescription>Defaults that help your team move faster.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Default warehouse</Label>
              <Select value={form.default_location_id ?? ""} onValueChange={(v) => set("default_location_id", v || null)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder="Choose a warehouse" /></SelectTrigger>
                <SelectContent>{locations.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default low-stock threshold</Label>
              <Input type="number" min={0} value={form.default_low_stock_threshold}
                onChange={(e) => set("default_low_stock_threshold", Math.max(0, parseInt(e.target.value || "0", 10)))}
                disabled={disabled} />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <div className="text-sm font-medium">Scanner behavior</div>
            <ToggleRow label="Auto-commit scans" hint="Save each scanned change immediately." checked={form.scanner_auto_commit} onChange={(v) => set("scanner_auto_commit", v)} disabled={disabled} />
            <ToggleRow label="Sound on scan" hint="Play a soft beep when a barcode is recognized." checked={form.scanner_sound} onChange={(v) => set("scanner_sound", v)} disabled={disabled} />
            <ToggleRow label="Vibration on scan" hint="Mobile devices vibrate briefly on each scan." checked={form.scanner_haptics} onChange={(v) => set("scanner_haptics", v)} disabled={disabled} />
          </div>
          {canEdit && (
            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- helpers ---------- */
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

function ToggleRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
    </div>
  );
}
