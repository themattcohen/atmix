import { Badge } from "@/components/ui/Badge";

const STATUS_VARIANT_MAP: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  // Filing statuses
  ACCEPTED: "success",
  REJECTED: "error",
  SUBMITTED: "info",
  SUBMITTING: "info",
  PAID: "warning",
  SIGNED: "warning",
  IN_PROGRESS: "default",
  REVIEWED: "default",
  NOT_STARTED: "default",
  // Payment statuses
  COMPLETED: "success",
  FAILED: "error",
  PENDING: "warning",
  REFUNDED: "info",
};

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT_MAP[status] || "default";
  return (
    <Badge
      variant={variant}
      className={status === "NOT_STARTED" ? "opacity-60" : undefined}
    >
      {formatStatus(status)}
    </Badge>
  );
}
