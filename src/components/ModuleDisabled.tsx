import { Lock } from "lucide-react";

export function ModuleDisabled({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="max-w-md text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          {label ?? "Module unavailable"}
        </h2>
        <p className="text-sm text-muted-foreground">
          This module is not enabled for your company.
        </p>
      </div>
    </div>
  );
}
