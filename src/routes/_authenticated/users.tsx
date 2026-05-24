import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Users, UserPlus, MoreHorizontal, KeyRound, ShieldOff, ShieldCheck, Trash2, Pencil, Mail } from "lucide-react";
import { useProfile } from "@/lib/profile";
import {
  orgListUsers,
  orgInviteUser,
  orgUpdateUser,
  orgSetUserStatus,
  orgDeleteUser,
  orgResetUserPassword,
} from "@/lib/org-users.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

type AssignableRole = "manager" | "employee" | "custom";

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function UsersPage() {
  const { t } = useTranslation();
  const profile = useProfile();
  const qc = useQueryClient();
  const fetchList = useServerFn(orgListUsers);

  const role = profile.data?.role;
  const canAccess = role === "owner" || role === "manager" || role === "super_admin";

  const list = useQuery({
    queryKey: ["org-users", profile.data?.organization_id],
    queryFn: () => fetchList({}),
    enabled: canAccess,
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  if (!canAccess) return <Navigate to="/dashboard" replace />;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["org-users"] });

  const users = (list.data?.users ?? []) as UserRow[];
  const active = users.filter((u) => u.is_active && !u.suspended_at && !u.archived_at);
  const pending = active.filter((u) => !u.last_sign_in_at);
  const suspended = users.filter((u) => u.suspended_at && !u.archived_at);
  const archived = users.filter((u) => u.archived_at);

  const cap = list.data?.cap ?? null;
  const used = list.data?.used ?? 0;
  const limitReached = cap != null && used >= cap;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t("orgUsers.title", "Users & Roles")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("orgUsers.subtitle", "Invite teammates and manage their access.")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {cap != null && (
            <Badge variant={limitReached ? "destructive" : "secondary"}>
              {t("orgUsers.seatUsage", "{{used}} / {{cap}} seats", { used, cap })}
            </Badge>
          )}
          <Button onClick={() => setInviteOpen(true)} disabled={limitReached}>
            <UserPlus className="h-4 w-4 mr-2" />
            {t("orgUsers.invite", "Invite user")}
          </Button>
        </div>
      </header>

      {list.isLoading ? (
        <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : list.error ? (
        <div className="text-sm text-destructive">{(list.error as Error).message}</div>
      ) : (
        <>
          <SectionTable
            title={t("orgUsers.active", "Active users")}
            users={active}
            onEdit={setEditing}
            onDelete={setDeleting}
            onChanged={invalidate}
          />
          {pending.length > 0 && (
            <SectionTable
              title={t("orgUsers.pending", "Pending invitations")}
              users={pending}
              onEdit={setEditing}
              onDelete={setDeleting}
              onChanged={invalidate}
              hint={t("orgUsers.pendingHint", "Users who have not signed in yet.")}
            />
          )}
          {suspended.length > 0 && (
            <SectionTable
              title={t("orgUsers.suspended", "Suspended users")}
              users={suspended}
              onEdit={setEditing}
              onDelete={setDeleting}
              onChanged={invalidate}
            />
          )}
          {archived.length > 0 && (
            <SectionTable
              title={t("orgUsers.archived", "Archived users")}
              users={archived}
              onEdit={setEditing}
              onDelete={setDeleting}
              onChanged={invalidate}
            />
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {t("orgUsers.permissionsHint", "Fine-grained per-user permissions are managed on the")}{" "}
        <Link to="/permissions" className="underline">
          {t("permissions.navLabel")}
        </Link>{" "}
        {t("orgUsers.permissionsHintTail", "page.")}
      </p>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={() => {
          setInviteOpen(false);
          invalidate();
        }}
      />
      <EditDialog user={editing} onOpenChange={(o) => !o && setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />
      <DeleteConfirmDialog
        open={!!deleting}
        title={t("orgUsers.deleteTitle", "Delete user")}
        description={t("orgUsers.deleteDesc", "This will permanently archive {{name}} and revoke their access. This cannot be undone.", { name: deleting?.full_name ?? deleting?.email ?? "" })}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            const fn = (await import("@/lib/org-users.functions")).orgDeleteUser;
            await fn({ data: { user_id: deleting.user_id } });
            toast.success(t("orgUsers.deleted", "User deleted"));
            setDeleting(null);
            invalidate();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

type UserRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: AssignableRole | "owner" | "super_admin";
  account_status: string;
  is_active: boolean;
  suspended_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
};

function SectionTable({
  title,
  users,
  onEdit,
  onDelete,
  onChanged,
  hint,
}: {
  title: string;
  users: UserRow[];
  onEdit: (u: UserRow) => void;
  onDelete: (u: UserRow) => void;
  onChanged: () => void;
  hint?: string;
}) {
  const { t } = useTranslation();
  const profile = useProfile();
  const setStatus = useServerFn(orgSetUserStatus);
  const resetPwd = useServerFn(orgResetUserPassword);

  const callStatus = async (u: UserRow, status: "active" | "suspended") => {
    try {
      await setStatus({ data: { user_id: u.user_id, status } });
      toast.success(t("orgUsers.updated", "User updated"));
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const sendReset = async (u: UserRow) => {
    try {
      await resetPwd({ data: { user_id: u.user_id } });
      toast.success(t("orgUsers.resetSent", "Password reset email sent"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-2 pr-4 font-medium">{t("orgUsers.col.name", "Name")}</th>
              <th className="py-2 pr-4 font-medium">{t("orgUsers.col.email", "Email")}</th>
              <th className="py-2 pr-4 font-medium">{t("orgUsers.col.role", "Role")}</th>
              <th className="py-2 pr-4 font-medium">{t("orgUsers.col.status", "Status")}</th>
              <th className="py-2 pr-4 font-medium">{t("orgUsers.col.lastLogin", "Last login")}</th>
              <th className="py-2 pr-4 font-medium w-12" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.user_id === profile.data?.user_id;
              const isOwner = u.role === "owner";
              const statusBadge = u.archived_at ? "archived" : u.suspended_at ? "suspended" : u.is_active ? "active" : "inactive";
              return (
                <tr key={u.user_id} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <div className="font-medium">{u.full_name ?? "—"}</div>
                    {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                  </td>
                  <td className="py-2 pr-4">{u.email ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <Badge variant="outline">{t(`permissions.role.${u.role}`, u.role)}</Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={statusBadge === "active" ? "default" : statusBadge === "suspended" ? "destructive" : "secondary"}>
                      {t(`orgUsers.status.${statusBadge}`, statusBadge)}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{formatDate(u.last_sign_in_at)}</td>
                  <td className="py-2 pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isOwner && !isSelf ? false : isOwner}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(u)} disabled={isOwner}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {t("orgUsers.edit", "Edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => sendReset(u)}>
                          <KeyRound className="h-4 w-4 mr-2" />
                          {t("orgUsers.resetPassword", "Send password reset")}
                        </DropdownMenuItem>
                        {!u.last_sign_in_at && (
                          <DropdownMenuItem onClick={() => sendReset(u)}>
                            <Mail className="h-4 w-4 mr-2" />
                            {t("orgUsers.resendInvite", "Resend invitation")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {u.suspended_at ? (
                          <DropdownMenuItem onClick={() => callStatus(u, "active")} disabled={isOwner || isSelf}>
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            {t("orgUsers.reactivate", "Reactivate")}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => callStatus(u, "suspended")} disabled={isOwner || isSelf}>
                            <ShieldOff className="h-4 w-4 mr-2" />
                            {t("orgUsers.suspend", "Suspend")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => onDelete(u)}
                          disabled={isOwner || isSelf}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t("orgUsers.delete", "Delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  {t("orgUsers.empty", "No users in this section.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInvited: () => void;
}) {
  const { t } = useTranslation();
  const invite = useServerFn(orgInviteUser);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AssignableRole>("employee");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setRole("employee");
  };

  const submit = async () => {
    if (!fullName.trim() || !email.trim()) {
      toast.error(t("orgUsers.invalidForm", "Name and email are required"));
      return;
    }
    setBusy(true);
    try {
      await invite({
        data: {
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role,
        },
      });
      toast.success(t("orgUsers.invited", "Invitation sent"));
      reset();
      onInvited();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.startsWith("PLAN_LIMIT_USERS")) {
        toast.error(t("orgUsers.planLimit", "Seat limit reached for your plan"));
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("orgUsers.invite", "Invite user")}</DialogTitle>
          <DialogDescription>
            {t("orgUsers.inviteDesc", "The user will receive an email to set their password.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("orgUsers.fullName", "Full name")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>{t("orgUsers.email", "Email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </div>
          <div>
            <Label>{t("orgUsers.phone", "Phone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
          </div>
          <div>
            <Label>{t("orgUsers.role", "Role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">{t("permissions.role.manager")}</SelectItem>
                <SelectItem value="employee">{t("permissions.role.employee")}</SelectItem>
                <SelectItem value="custom">{t("permissions.role.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? t("common.saving", "Saving…") : t("orgUsers.sendInvite", "Send invitation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  user,
  onOpenChange,
  onSaved,
}: {
  user: UserRow | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const update = useServerFn(orgUpdateUser);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AssignableRole>("employee");
  const [busy, setBusy] = useState(false);

  useMemo(() => {
    if (user) {
      setFullName(user.full_name ?? "");
      setPhone(user.phone ?? "");
      setRole((["manager", "employee", "custom"].includes(user.role) ? user.role : "employee") as AssignableRole);
    }
  }, [user]);

  if (!user) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await update({
        data: {
          user_id: user.user_id,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          role,
        },
      });
      toast.success(t("orgUsers.updated", "User updated"));
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("orgUsers.editUser", "Edit user")}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>{t("orgUsers.fullName")}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>{t("orgUsers.phone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
          </div>
          <div>
            <Label>{t("orgUsers.role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">{t("permissions.role.manager")}</SelectItem>
                <SelectItem value="employee">{t("permissions.role.employee")}</SelectItem>
                <SelectItem value="custom">{t("permissions.role.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? t("common.saving") : t("common.save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
