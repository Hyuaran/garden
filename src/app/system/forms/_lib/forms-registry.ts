import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import type { SystemIcon } from "@/app/system/_components/ShachoShell/shacho-shell-config";

export type SystemFormDefinition = {
  slug: string;
  name: string;
  description: string;
  roleLabel: string;
  minRole: GardenRole;
  icon: SystemIcon;
  href: string;
};

export const SYSTEM_FORMS: SystemFormDefinition[] = [
  {
    slug: "payroll-notice",
    name: "給与計算連絡",
    description: "月に一度、給与計算に必要な連絡（交通費・研修・紹介）を Chatwork へ送ります。",
    roleLabel: "社員以上",
    minRole: "staff",
    icon: "document",
    href: "/system/forms/payroll-notice",
  },
  {
    slug: "shukkin",
    name: "出勤表・シフト連絡",
    description: "KING OF TIME の日別データから、出勤表と翌日のシフト連絡の文面を作ります。",
    roleLabel: "社員以上",
    minRole: "staff",
    icon: "shift",
    href: "/system/forms/shukkin",
  },
];

export function getVisibleSystemForms(role: GardenRole) {
  return SYSTEM_FORMS.filter((form) => isRoleAtLeast(role, form.minRole));
}
