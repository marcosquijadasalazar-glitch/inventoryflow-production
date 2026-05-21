import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { recoverSuperAdminAccess } from "@/lib/admin-recovery.functions";

export const Route = createFileRoute("/_authenticated/admin-recovery")({
  component: AdminRecoveryPage,
});

const CONFIRMATION_PHRASE = "MAKE ME SUPER ADMIN";

function AdminRecoveryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recover = useServerFn(recoverSuperAdminAccess);
  const [confirmation, setConfirmation] = useState("");

  const recovery = useMutation({
    mutationFn: () => recover({ data: { confirmation } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Super admin access restored.");
      navigate({ to: "/admin", replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isConfirmed = confirmation === CONFIRMATION_PHRASE;

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <CardTitle>Temporary Admin Recovery</CardTitle>
          </div>
          <CardDescription>
            Use this temporary recovery action only for initial access repair, then remove this route.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <div className="font-medium">Current authenticated user</div>
            <dl className="mt-3 space-y-2">
              <div className="grid gap-1 sm:grid-cols-[120px_1fr]">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all font-mono text-xs">{user?.email ?? "Unknown"}</dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[120px_1fr]">
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="break-all font-mono text-xs">{user?.id}</dd>
              </div>
            </dl>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">This will promote your current account to super_admin.</p>
              <p className="mt-1 text-muted-foreground">
                The action is validated on the server and logged in transaction history for audit purposes.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recovery-confirmation">
              Type <span className="font-mono text-xs">{CONFIRMATION_PHRASE}</span> to continue
            </Label>
            <Input
              id="recovery-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </div>

          <Button
            className="w-full"
            variant="destructive"
            disabled={!isConfirmed || recovery.isPending}
            onClick={() => recovery.mutate()}
          >
            {recovery.isPending ? "Promoting…" : "Promote current user to Super Admin"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
