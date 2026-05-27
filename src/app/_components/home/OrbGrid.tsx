import type { ModuleKey } from "../../_lib/module-visibility";
import OrbitStage, { type OrbitModule } from "./OrbitStage";

const MODULES: OrbitModule[] = [
  {
    moduleKey: "Bloom",
    iconSrc: "/images/icons/bloom.png",
    name: "Bloom",
    jpName: "案件・KPI",
    description: "案件一覧、日報、KPI、経営ダッシュボードを扱う中核モジュール。",
    tone: "soft",
    href: "/bloom/workboard",
  },
  {
    moduleKey: "Fruit",
    iconSrc: "/images/icons/fruit.png",
    name: "Fruit",
    jpName: "法人実体情報",
    description: "法人番号、登記、許認可、商標など、法人格の実体情報を管理します。",
    tone: "strong",
    href: "/fruit",
  },
  {
    moduleKey: "Seed",
    iconSrc: "/images/icons/seed.png",
    name: "Seed",
    jpName: "新事業",
    description: "新規事業や未来の業務候補を育てるための構想モジュール。",
    tone: "mid",
    href: "/seed",
  },
  {
    moduleKey: "Forest",
    iconSrc: "/images/icons/forest.png",
    name: "Forest",
    jpName: "全法人決算",
    description: "グループ法人全体の決算資料と経営ダッシュボードを束ねます。",
    tone: "mid",
    href: "/forest",
  },
  {
    moduleKey: "Bud",
    iconSrc: "/images/icons/bud.png",
    name: "Bud",
    jpName: "経理・取引",
    description: "経費、振込、請求、給与など、経理と取引の流れを扱います。",
    tone: "soft",
    href: "/bud",
  },
  {
    moduleKey: "Leaf",
    iconSrc: "/images/icons/leaf.png",
    name: "Leaf",
    jpName: "個別アプリ",
    description: "事業ごとに独立した業務アプリをまとめるモジュール。",
    tone: "soft",
    href: "/leaf",
  },
  {
    moduleKey: "Tree",
    iconSrc: "/images/icons/tree.png",
    name: "Tree",
    jpName: "架電",
    description: "架電業務、コール履歴、KPI管理など、電話業務の中核を担います。",
    tone: "mid",
    href: "/tree",
  },
  {
    moduleKey: "Sprout",
    iconSrc: "/images/icons/sprout.png",
    name: "Sprout",
    jpName: "採用",
    description: "求人、面接、研修、スキル管理を通じて組織の未来を育てます。",
    tone: "soft",
    href: "/sprout",
  },
  {
    moduleKey: "Soil",
    iconSrc: "/images/icons/soil.png",
    name: "Soil",
    jpName: "DB基盤",
    description: "業務リストやコール履歴など、大規模データを支える基盤。",
    tone: "strong",
    href: "/soil",
  },
  {
    moduleKey: "Root",
    iconSrc: "/images/icons/root.png",
    name: "Root",
    jpName: "組織・マスタ",
    description: "すべての事業の土台となる組織、顧客、権限、設定を管理します。",
    tone: "strong",
    href: "/root",
  },
  {
    moduleKey: "Rill",
    iconSrc: "/images/icons/rill.png",
    name: "Rill",
    jpName: "メッセージ",
    description: "社内メッセージ、通知、各モジュールへの情報の流れを担います。",
    tone: "mid",
    href: "/rill",
  },
  {
    moduleKey: "Calendar",
    iconSrc: "/images/icons/calendar.png",
    name: "Calendar",
    jpName: "予定管理",
    description: "営業予定、シフト、スケジュールを整える暦のモジュール。",
    tone: "soft",
    href: "/calendar",
  },
];

type Props = {
  visibleModules?: readonly string[];
  onOrbHover?: (moduleKey: string) => void;
  onOrbClick?: (moduleKey: string) => void;
};

function isModuleKey(value: string): value is ModuleKey {
  return MODULES.some((module) => module.moduleKey === value);
}

export default function OrbGrid({
  visibleModules,
  onOrbHover,
  onOrbClick,
}: Props = {}) {
  const visibleSet = visibleModules
    ? new Set(visibleModules.filter(isModuleKey))
    : null;
  const filtered = visibleSet
    ? MODULES.filter((module) => visibleSet.has(module.moduleKey))
    : MODULES;

  return (
    <OrbitStage
      modules={filtered}
      onOrbHover={onOrbHover}
      onOrbClick={onOrbClick}
    />
  );
}
