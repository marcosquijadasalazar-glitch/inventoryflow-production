import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getCompanySettings,
  updateCompanySettings,
  uploadLogo,
  type CompanySettings,
} from "@/lib/settings";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Building2, Upload, Trash2, Settings as Cog } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: getCompanySettings,
  });
  const [form, setForm] = useState<Partial<CompanySettings>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const set = (k: keyof CompanySettings, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!settings?.id) return;
    setSaving(true);
    try {
      await updateCompanySettings(settings.id, form);
      toast.success(t("settings.saved"));
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings?.id) return;
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      await updateCompanySettings(settings.id, { logo_url: url });
      set("logo_url", url);
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success(t("settings.saved"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!settings?.id) return;
    await updateCompanySettings(settings.id, { logo_url: null });
    set("logo_url", null);
    qc.invalidateQueries({ queryKey: ["company-settings"] });
  };

  return (
    <div className="space-y-6 max-w-3xl">
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
            <Building2 className="h-4 w-4" /> {t("settings.company")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("settings.companyName")}</Label>
              <Input
                value={form.company_name ?? ""}
                onChange={(e) => set("company_name", e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.phone")}</Label>
              <Input
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("settings.address")}</Label>
              <Input
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("common.email")}</Label>
              <Input
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("settings.footerNotes")}</Label>
              <Textarea
                rows={2}
                value={form.footer_notes ?? ""}
                onChange={(e) => set("footer_notes", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
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
                  No logo
                </div>
              )}
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" disabled={uploading}>
                  <label className="cursor-pointer">
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {uploading ? t("common.loading") : t("settings.uploadLogo")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onLogo}
                    />
                  </label>
                </Button>
                {form.logo_url && (
                  <Button variant="ghost" size="sm" onClick={removeLogo}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    {t("settings.removeLogo")}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

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
