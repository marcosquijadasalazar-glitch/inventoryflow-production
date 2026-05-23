import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectSeparator,
} from "@/components/ui/select";
import { listLocations, type Location } from "@/lib/locations";
import { LocationFormDialog } from "./LocationFormDialog";

const CREATE_VALUE = "__create__";

export function LocationSelect({
  value,
  onChange,
  placeholder,
  excludeId,
}: {
  value: string | null;
  onChange: (id: string | null, location?: Location) => void;
  placeholder?: string;
  excludeId?: string | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(),
  });

  const options = (locations.data ?? []).filter(
    (l) => !excludeId || l.id !== excludeId,
  );

  return (
    <>
      <Select
        value={value ?? ""}
        onValueChange={(v) => {
          if (v === CREATE_VALUE) {
            setCreateOpen(true);
            return;
          }
          const found = options.find((l) => l.id === v);
          onChange(v || null, found);
        }}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={placeholder ?? t("loc.select", "Select location")}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                {t("loc.empty_short", "No locations yet")}
              </div>
            )}
            {options.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
                <span className="text-muted-foreground text-xs ml-2">
                  · {t(`loc.types.${l.type}`, l.type)}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value={CREATE_VALUE}>
            <span className="flex items-center gap-2 text-primary font-medium">
              <Plus className="h-3.5 w-3.5" />
              {t("loc.create_new", "Create new location")}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <LocationFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (loc) => {
          await qc.invalidateQueries({ queryKey: ["locations"] });
          onChange(loc.id, loc);
        }}
      />
    </>
  );
}
