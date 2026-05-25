import { supabase } from "@/integrations/supabase/client";

export type CompanySettings = {
  id: string;
  company_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  footer_notes: string | null;
  logo_url: string | null;
  updated_at: string;
  created_at: string;
};

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const { data, error } = await (supabase as any)
    .from("company_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CompanySettings | null;
}

export async function updateCompanySettings(
  id: string,
  values: Partial<CompanySettings>,
) {
  const { error } = await (supabase as any)
    .from("company_settings")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function uploadLogo(file: File, organizationId: string): Promise<string> {
  if (!organizationId) throw new Error("organizationId is required to upload a logo");
  const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  // RLS on storage.objects requires the first folder segment to equal the org id.
  const path = `${organizationId}/logo-${Date.now()}.${ext || "png"}`;
  const { error } = await supabase.storage
    .from("branding")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  return data.publicUrl;
}
