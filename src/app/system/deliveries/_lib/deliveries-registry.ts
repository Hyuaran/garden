import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import type { SystemIcon } from "@/app/system/_components/ShachoShell/shacho-shell-config";

export type SystemDeliveryStatus = "active" | "upcoming";

export type SystemDeliveryDefinition = {
  slug: string;
  name: string;
  description: string;
  schedule: string;
  recipient: string;
  status: SystemDeliveryStatus;
  statusLabel: string;
  minRole: GardenRole;
  icon: SystemIcon;
  href: string;
};

export const SYSTEM_DELIVERIES: SystemDeliveryDefinition[] = [
  {
    slug: "call-report",
    name: "コール数配信",
    description: "その日のコール数と率（有効率・受注率・前確 OK 率）を集計表 PDF 付きで投稿します。",
    schedule: "平日 15〜21 時／土日祝 11〜21 時の毎時 05 分（0 件の時間は送らない）",
    recipient: "HR グループ【共有】",
    status: "active",
    statusLabel: "稼働中",
    minRole: "staff",
    icon: "message",
    href: "/system/call-metrics",
  },
];

export function getVisibleSystemDeliveries(role: GardenRole) {
  return SYSTEM_DELIVERIES.filter((delivery) => isRoleAtLeast(role, delivery.minRole));
}
