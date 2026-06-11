import { MODULES, MODULE_KEYS, type ModuleKey } from "@/components/shared/garden-view/_lib/modules";

type MobileModuleCopy = {
  descriptionLines: string[];
  href?: string;
};

const MOBILE_COPY: Partial<Record<ModuleKey, MobileModuleCopy>> = {
  soil: { descriptionLines: ["DB", "基盤"] },
  root: { descriptionLines: ["組織", "マスタ"] },
  tree: { descriptionLines: ["架電", "業務"] },
  leaf: { descriptionLines: ["個別アプリ", "トスアップ"] },
  bud: { descriptionLines: ["経理", "精算"], href: "/m/bud" },
  bloom: { descriptionLines: ["案件", "KPI"] },
  seed: { descriptionLines: ["新規", "事業"] },
  forest: { descriptionLines: ["法人", "決算"] },
  rill: { descriptionLines: ["Chatwork", "連携"] },
  fruit: { descriptionLines: ["法人実体", "番号管理"] },
  sprout: { descriptionLines: ["採用"] },
  calendar: { descriptionLines: ["時間軸", "予定"] },
};

export type MobileModule = {
  key: ModuleKey;
  label: string;
  descriptionLines: string[];
  href: string;
  color: string;
  ready: boolean;
};

export const MOBILE_MODULES: MobileModule[] = MODULE_KEYS.map((key) => {
  const base = MODULES[key];
  const copy = MOBILE_COPY[key];
  const href = copy?.href ?? `/m/search?module=${key}`;
  return {
    key,
    label: base.label,
    descriptionLines: copy?.descriptionLines ?? [base.description],
    href,
    color: base.color,
    ready: Boolean(copy?.href),
  };
});

export function findMobileModule(key: string | null) {
  return MOBILE_MODULES.find((module) => module.key === key) ?? null;
}
