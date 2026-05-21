import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getSetupStatus, claimSuperAdmin } from "@/lib/setup.functions";

export const Route = createFileRoute("/_authenticated/setup")({
  component: SetupPage,
});

function SetupPage() {
  const statusFn = useServerFn(getSetupStatus);
  const claimFn = useServerFn(claimSuperAdmin);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => statusFn(),
  });

  const claim = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: () => {
      toast.success("You are now a super admin.");
      qc.invalidateQueries();
      setTimeout(() => navigate({ to: "/admin" }), 600);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container max-w-xl py-10">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle>Initial Super Admin Setup</CardTitle>
          </div>
          <CardDescription>
            One-time setup. Becomes unavailable once a super admin exists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking setup status…</p>
          ) : data?.isSuperAdmin ? (
            <div className="flex items-start gap-2 rounded-md border p-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">You are already a super admin.</p>
                <Button asChild className="mt-3" size="sm">
                  <Link to="/admin">Go to Admin</Link>
                </Button>
              </div>
            </div>
          ) : data?.superAdminExists ? (
            <div className="flex items-start gap-2 rounded-md border p-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium">Setup is already complete.</p>
                <p className="text-sm text-muted-foreground">
                  A super admin already exists. Contact them for access.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                No super admin exists yet. You can promote your current account
                ({data?.email}) to super admin. This action can only be performed once.
              </p>
              <Button
                onClick={() => claim.mutate()}
                disabled={claim.isPending}
                className="w-full"
              >
                {claim.isPending ? "Promoting…" : "Promote me to Super Admin"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
