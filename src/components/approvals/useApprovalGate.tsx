import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listApprovalPolicies } from "@/lib/approvals.functions";
import {
  type ApprovalAction,
  type ApprovalPolicy,
  DEFAULT_POLICIES,
  evaluatePolicy,
} from "@/lib/approvals";
import { ApprovalGate, type ApprovalGateProps } from "./ApprovalGate";

export function useApprovalPolicies() {
  const fetchPolicies = useServerFn(listApprovalPolicies);
  return useQuery({
    queryKey: ["approval-policies"],
    queryFn: () => fetchPolicies(),
    staleTime: 60_000,
  });
}

export function policyFor(
  policies: ApprovalPolicy[] | undefined,
  action: ApprovalAction,
): ApprovalPolicy {
  const found = (policies ?? []).find((p) => p.action_type === action);
  return found ?? DEFAULT_POLICIES[action];
}

type GuardArgs = {
  action: ApprovalAction;
  measurements?: { quantity?: number; value?: number };
  entityLabel?: string;
  payload?: Record<string, any>;
  onApproved: () => void | Promise<void>;
};

/**
 * useApprovalGate — returns:
 *   - guard(args): runs onApproved immediately if no approval required;
 *                  otherwise opens the supervisor override modal.
 *   - modal: <ApprovalGate /> element you must render once in your component.
 */
export function useApprovalGate() {
  const { data } = useApprovalPolicies();
  const [state, setState] = useState<Omit<ApprovalGateProps, "open" | "onOpenChange"> | null>(null);

  const guard = useCallback(
    (args: GuardArgs) => {
      const policy = policyFor(data?.policies as ApprovalPolicy[] | undefined, args.action);
      const evalResult = evaluatePolicy(policy, args.measurements ?? {});
      if (!evalResult.required) {
        void args.onApproved();
        return;
      }
      setState({
        action: args.action,
        policy,
        measurements: args.measurements ?? {},
        entityLabel: args.entityLabel,
        payload: args.payload ?? {},
        reasonHint: evalResult.reasonHint,
        blocked: evalResult.blocked,
        onApproved: args.onApproved,
      });
    },
    [data],
  );

  const modal = state ? (
    <ApprovalGate
      {...state}
      open
      onOpenChange={(o: boolean) => {
        if (!o) setState(null);
      }}
    />
  ) : null;

  return { guard, modal };
}
