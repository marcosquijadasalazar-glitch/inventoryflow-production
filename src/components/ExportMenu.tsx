import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Download, FileText, FileSpreadsheet, Printer, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getCompanySettings } from "@/lib/settings";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/lib/use-permissions";
import {
  exportRowsCsv,
  exportRowsXlsx,
  exportRowsPdf,
  printRows,
  type ExportColumn,
} from "@/lib/exporters";

export type ExportMenuProps<T> = {
  title: string;
  filename: string;
  rows: T[];
  /** Optional currently selected rows. When non-empty, the menu offers "Export selected". */
  selectedRows?: T[];
  columns: ExportColumn<T>[];
  orientation?: "portrait" | "landscape";
  sheetName?: string;
  /** Show Print option (default true). */
  showPrint?: boolean;
  /** Compact icon-only trigger (mobile). */
  iconOnly?: boolean;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
  /** Extra metadata lines to render in PDF header (e.g. active filters). */
  meta?: { label: string; value: string }[];
};

export function ExportMenu<T>(props: ExportMenuProps<T>) {
  const {
    title,
    filename,
    rows,
    selectedRows,
    columns,
    orientation,
    sheetName,
    showPrint = true,
    iconOnly,
    size = "sm",
    variant = "outline",
    className,
    meta,
  } = props;
  const { t } = useTranslation();
  const perms = usePermissions();
  const settings = useQuery({
    queryKey: ["company_settings"],
    queryFn: getCompanySettings,
    staleTime: 5 * 60 * 1000,
  });

  if (!perms.isLoading && !perms.can("export_data")) {
    return null;
  }

  const hasSel = !!selectedRows && selectedRows.length > 0;
  const disabled = rows.length === 0 && !hasSel;

  async function getUserEmail() {
    try {
      const { data } = await supabase.auth.getUser();
      return data.user?.email ?? null;
    } catch {
      return null;
    }
  }

  async function run(kind: "csv" | "xlsx" | "pdf" | "print", useSelected: boolean) {
    const data = useSelected ? selectedRows ?? [] : rows;
    if (data.length === 0) {
      toast.error(t("common.noResults", "No results"));
      return;
    }
    try {
      const userEmail = await getUserEmail();
      const s = settings.data ?? null;
      if (kind === "csv") exportRowsCsv(filename, columns, data);
      else if (kind === "xlsx")
        exportRowsXlsx(filename, sheetName ?? title, columns, data);
      else if (kind === "pdf")
        await exportRowsPdf({
          filename,
          title,
          columns,
          rows: data,
          settings: s,
          userEmail,
          orientation,
          meta,
        });
      else {
        const tid = toast.loading(t("common.preparingPrint", "Preparing print…"));
        try {
          await printRows({
            title,
            columns,
            rows: data,
            settings: s,
            userEmail,
            meta,
            orientation,
          });
        } finally {
          toast.dismiss(tid);
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled}
          className={className}
          aria-label={t("common.export", "Export")}
        >
          <Download className="h-3.5 w-3.5" />
          {!iconOnly && (
            <>
              <span className="ml-1">{t("common.export", "Export")}</span>
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">
          {t("export.all_rows", "All filtered ({{n}})", { n: rows.length })}
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => run("csv", false)}>
          <FileText className="h-3.5 w-3.5" />
          {t("common.exportCsv", "Export CSV")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("xlsx", false)}>
          <FileSpreadsheet className="h-3.5 w-3.5" />
          {t("common.exportXlsx", "Export Excel")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("pdf", false)}>
          <FileText className="h-3.5 w-3.5" />
          {t("common.exportPdf", "Export PDF")}
        </DropdownMenuItem>
        {showPrint && (
          <DropdownMenuItem onClick={() => run("print", false)}>
            <Printer className="h-3.5 w-3.5" />
            {t("common.print", "Print")}
          </DropdownMenuItem>
        )}
        {hasSel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">
              {t("export.selected", "Selected ({{n}})", {
                n: selectedRows!.length,
              })}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => run("csv", true)}>
              <FileText className="h-3.5 w-3.5" />
              {t("common.exportCsv", "Export CSV")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("xlsx", true)}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {t("common.exportXlsx", "Export Excel")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run("pdf", true)}>
              <FileText className="h-3.5 w-3.5" />
              {t("common.exportPdf", "Export PDF")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
