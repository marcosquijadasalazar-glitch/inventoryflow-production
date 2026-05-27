import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, ArrowRightLeft, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationNodeDialog } from "@/components/LocationNodeDialog";
import {
  archiveNode,
  canMoveTo,
  deleteNode,
  getNodeUsage,
  moveNode,
  PARENT_LEVEL,
  type LocationNode,
} from "@/lib/location-tree";

export function LocationNodeActions({
  node,
  allNodes,
  trigger,
  align = "end",
}: {
  node: LocationNode;
  allNodes: LocationNode[];
  trigger?: React.ReactNode;
  align?: "start" | "end" | "center";
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [move, setMove] = useState(false);
  const [archive, setArchive] = useState(false);
  const [del, setDel] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["location-nodes-all"] });
    qc.invalidateQueries({ queryKey: ["locations"] });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => e.stopPropagation()}
              aria-label="Node actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className="w-44"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem onClick={() => setEdit(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            {t("common.edit", "Edit")}
          </DropdownMenuItem>
          {PARENT_LEVEL[node.node_level] !== null && (
            <DropdownMenuItem onClick={() => setMove(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              {t("common.move", "Move")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setArchive(true)}>
            <Archive className="h-4 w-4 mr-2" />
            {t("common.archive", "Archive")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDel(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("common.delete", "Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LocationNodeDialog
        open={edit}
        level={node.node_level}
        parentId={node.parent_id}
        editNode={node}
        onClose={() => setEdit(false)}
      />

      <MoveNodeDialog
        open={move}
        node={node}
        allNodes={allNodes}
        onClose={() => setMove(false)}
        onDone={invalidate}
      />

      <ArchiveConfirmDialog
        open={archive}
        node={node}
        allNodes={allNodes}
        onClose={() => setArchive(false)}
        onDone={invalidate}
      />

      <DeleteConfirmDialog
        open={del}
        node={node}
        allNodes={allNodes}
        onClose={() => setDel(false)}
        onDone={invalidate}
      />
    </>
  );
}

// ── Move ─────────────────────────────────────────────────────────────────

function MoveNodeDialog({
  open,
  node,
  allNodes,
  onClose,
  onDone,
}: {
  open: boolean;
  node: LocationNode;
  allNodes: LocationNode[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const parentLevel = PARENT_LEVEL[node.node_level];
  const candidates = useMemo(() => {
    if (!parentLevel) return [];
    return allNodes.filter(
      (n) => n.node_level === parentLevel && n.is_active && canMoveTo(allNodes, node.id, n.id).ok,
    );
  }, [allNodes, node.id, parentLevel]);

  if (!open || !parentLevel) return null;

  const submit = async () => {
    if (!target) {
      toast.error(t("ln.pick_parent", "Pick a new parent"));
      return;
    }
    setSaving(true);
    try {
      await moveNode(allNodes, node.id, target);
      toast.success(t("ln.moved", "Moved"));
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("ln.move_x", { defaultValue: "Move {{name}}", name: node.name })}
          </DialogTitle>
          <DialogDescription>
            {t("ln.move_hint", "Pick a new parent. Stock and history stay attached.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue placeholder={t("ln.pick_parent", "Pick a new parent")} />
            </SelectTrigger>
            <SelectContent>
              {candidates.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {t("ln.no_targets", "No valid parents available")}
                </div>
              ) : (
                candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.code ? ` (${c.code})` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={saving || !target}>
            {saving ? t("common.saving", "Saving…") : t("common.move", "Move")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Archive ──────────────────────────────────────────────────────────────

function ArchiveConfirmDialog({
  open,
  node,
  allNodes,
  onClose,
  onDone,
}: {
  open: boolean;
  node: LocationNode;
  allNodes: LocationNode[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const usageQ = useQuery({
    queryKey: ["node-usage", node.id, "archive"],
    queryFn: () => getNodeUsage(allNodes, node.id),
    enabled: open,
  });

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await archiveNode(node.id);
      toast.success(t("ln.archived", "Archived"));
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const u = usageQ.data;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("ln.archive_x", { defaultValue: "Archive {{name}}", name: node.name })}
          </DialogTitle>
          <DialogDescription>
            {t(
              "ln.archive_hint",
              "Archived nodes are hidden from active operations but kept in history.",
            )}
          </DialogDescription>
        </DialogHeader>
        {u && (u.stockUnits > 0 || u.productsAtBins > 0) && (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs space-y-1">
            <p className="font-medium">{t("ln.heads_up", "Heads up")}</p>
            {u.stockUnits > 0 && (
              <p>
                {t("ln.contains_stock", "{{n}} units of stock will be hidden from active views.", {
                  n: u.stockUnits,
                })}
              </p>
            )}
            {u.children > 0 && (
              <p>
                {t("ln.contains_children", "{{n}} child nodes will also be hidden.", {
                  n: u.children,
                })}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? t("common.saving", "Saving…") : t("common.archive", "Archive")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete ───────────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  node,
  allNodes,
  onClose,
  onDone,
}: {
  open: boolean;
  node: LocationNode;
  allNodes: LocationNode[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const usageQ = useQuery({
    queryKey: ["node-usage", node.id, "delete"],
    queryFn: () => getNodeUsage(allNodes, node.id),
    enabled: open,
  });

  if (!open) return null;
  const u = usageQ.data;

  const submit = async () => {
    setSaving(true);
    try {
      await deleteNode(node.id);
      toast.success(t("ln.deleted", "Deleted"));
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const friendlyReason = (r: string): string => {
    if (r === "has_children")
      return t("ln.r_children", "Move or remove the child nodes first.");
    if (r === "has_stock")
      return t(
        "ln.r_stock",
        "This bin still contains inventory. Move or remove stock before deleting.",
      );
    if (r === "has_products")
      return t(
        "ln.r_products",
        "Products are still assigned here. Move them before deleting.",
      );
    return r;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-surface max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("ln.delete_x", { defaultValue: "Delete {{name}}", name: node.name })}
          </DialogTitle>
          <DialogDescription>
            {t(
              "ln.delete_hint",
              "Permanent deletion cannot be undone. Archive is usually safer.",
            )}
          </DialogDescription>
        </DialogHeader>
        {usageQ.isLoading && (
          <p className="text-xs text-muted-foreground">
            {t("common.loading", "Loading…")}
          </p>
        )}
        {u && !u.canDelete && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1">
            <p className="font-medium text-destructive">
              {t("ln.cannot_delete", "Can't delete this node yet")}
            </p>
            <ul className="list-disc pl-4 space-y-1 text-foreground">
              {u.reasons.map((r) => (
                <li key={r}>{friendlyReason(r)}</li>
              ))}
            </ul>
          </div>
        )}
        {u && u.canDelete && (
          <p className="text-xs text-muted-foreground">
            {t("ln.delete_safe", "This node has no children or stock. Safe to delete.")}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={saving || !u?.canDelete}
          >
            {saving ? t("common.saving", "Saving…") : t("common.delete", "Delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
