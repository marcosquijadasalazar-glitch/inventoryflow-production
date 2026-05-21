import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  listProductCategories,
  createProductCategory,
  renameProductCategory,
  setCategoryActive,
  type ProductCategoryRow,
} from "@/lib/categories";
import { Tag, Plus, Archive, RotateCcw, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export function CategoryManagerCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["product-categories-admin"],
    queryFn: listProductCategories,
  });
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["product-categories-admin"] });
    qc.invalidateQueries({ queryKey: ["product-categories"] });
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error(t("categories.nameRequired"));
      return;
    }
    if (
      categories.some(
        (c) => c.is_active && c.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      toast.error(t("categories.duplicate"));
      return;
    }
    setCreating(true);
    try {
      await createProductCategory(name);
      setNewName("");
      refresh();
      toast.success(t("categories.created"));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (c: ProductCategoryRow) => {
    setEditingId(c.id);
    setEditingValue(c.name);
  };

  const saveEdit = async (c: ProductCategoryRow) => {
    const name = editingValue.trim();
    if (!name) {
      toast.error(t("categories.nameRequired"));
      return;
    }
    try {
      await renameProductCategory(c.id, name);
      setEditingId(null);
      refresh();
      toast.success(t("categories.updated"));
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const toggle = async (c: ProductCategoryRow) => {
    try {
      await setCategoryActive(c.id, !c.is_active);
      refresh();
      toast.success(
        c.is_active
          ? t("categories.archivedToast")
          : t("categories.restoredToast"),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="h-4 w-4" /> {t("categories.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          {t("categories.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("categories.namePlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button onClick={add} disabled={creating}>
            <Plus className="h-4 w-4 mr-1.5" />
            {creating ? t("common.loading") : t("categories.addNew")}
          </Button>
        </div>

        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : categories.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              {t("categories.empty")}
            </div>
          ) : (
            categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 px-3 py-2.5 bg-surface"
              >
                {editingId === c.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      className="flex-1 h-8"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveEdit(c);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => saveEdit(c)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{c.name}</span>
                    <Badge
                      variant={c.is_active ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {c.is_active
                        ? t("categories.active")
                        : t("categories.archived")}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(c)}
                      title={t("categories.rename")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle(c)}
                      title={
                        c.is_active
                          ? t("categories.archive")
                          : t("categories.restore")
                      }
                    >
                      {c.is_active ? (
                        <Archive className="h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
