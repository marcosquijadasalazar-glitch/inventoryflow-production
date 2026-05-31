export const APPROVAL_ACTIONS = [
  "stock_adjustment",
  "transfer_order",
  "product_deletion",
  "role_change",
  "large_import",
] as const;

export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number];

export const APPROVAL_ACTION_LABELS: Record<ApprovalAction, string> = {
  stock_adjustment: "Stock adjustment",
  transfer_order: "Transfer order",
  product_deletion: "Product deletion",
  role_change: "Role change",
  large_import: "Large inventory import",
};

export type ApprovalPolicy = {
  id?: string;
  organization_id?: string;
  action_type: ApprovalAction;
  enabled: boolean;
  threshold_qty: number | null;
  threshold_value: number | null;
  required_role: "manager" | "owner";
  block_completely: boolean;
};

export const DEFAULT_POLICIES: Record<ApprovalAction, ApprovalPolicy> = {
  stock_adjustment: { action_type: "stock_adjustment", enabled: false, threshold_qty: 100, threshold_value: 2000, required_role: "manager", block_completely: false },
  transfer_order:   { action_type: "transfer_order",   enabled: false, threshold_qty: 500, threshold_value: 5000, required_role: "manager", block_completely: false },
  product_deletion: { action_type: "product_deletion", enabled: false, threshold_qty: null, threshold_value: null, required_role: "manager", block_completely: false },
  role_change:      { action_type: "role_change",      enabled: false, threshold_qty: null, threshold_value: null, required_role: "owner",   block_completely: false },
  large_import:     { action_type: "large_import",     enabled: false, threshold_qty: 200, threshold_value: null, required_role: "manager", block_completely: false },
};

/** Decide whether an action triggers approval given a policy and the action's measurements. */
export function evaluatePolicy(
  policy: ApprovalPolicy | undefined,
  measurements: { quantity?: number; value?: number },
): { required: boolean; blocked: boolean; reasonHint?: string } {
  if (!policy || !policy.enabled) return { required: false, blocked: false };
  if (policy.block_completely) return { required: true, blocked: true };
  const q = measurements.quantity ?? 0;
  const v = measurements.value ?? 0;
  const overQty = policy.threshold_qty != null && q >= policy.threshold_qty;
  const overVal = policy.threshold_value != null && v >= policy.threshold_value;
  // If no thresholds are configured, every action of this type needs approval.
  const noThresholds = policy.threshold_qty == null && policy.threshold_value == null;
  const required = overQty || overVal || noThresholds;
  let reasonHint: string | undefined;
  if (overQty) reasonHint = `Quantity ${q} ≥ ${policy.threshold_qty}`;
  else if (overVal) reasonHint = `Value $${v.toFixed(2)} ≥ $${policy.threshold_value}`;
  else if (noThresholds) reasonHint = "Approval always required for this action";
  return { required, blocked: false, reasonHint };
}
