import type { TransferStatus } from "../../_constants/transfer-status";
import { getStatusColor } from "../_lib/status-display";

interface StatusBadgeProps {
  status: TransferStatus;
  size?: "sm" | "md";
}

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
};

const COLOR_CLASSES = {
  gray: "bg-gray-100 text-gray-700 border-gray-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-300",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-300",
  green: "bg-green-100 text-green-800 border-green-300",
  red: "bg-red-100 text-red-800 border-red-300",
} as const;

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const color = getStatusColor(status);
  return (
    <span
      className={`inline-flex items-center border rounded-full font-medium ${SIZE_CLASSES[size]} ${COLOR_CLASSES[color]}`}
    >
      {status}
    </span>
  );
}
