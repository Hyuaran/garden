/**
 * Garden 6 法人マスタ定義
 *
 * 起票: 2026-05-09 a-bloom-005（dispatch main- No. 157、東海林さん新マッピング採用）
 * シンボル: アネモネ + ガラス玉円輪フレーム + 黒紫花芯 + 細裂葉（A 案、12 モジュール未使用花）
 * カラー: 東海林さん 2026-05-09 01:17 新マッピング採用（旧 暫定値からの差替え）
 *
 * 関連 spec: docs/specs/2026-05-08-bloom-corporate-icons-chatgpt-prompt.md
 * 関連 dispatch: main- No. 157
 *
 * 利用先（想定）:
 * - Bloom v9 unified ホーム / Forest dashboard / 各法人参照 UI
 * - 日報配信 PDF / 給与明細書ヘッダー
 * - Forest mock の旧 2 法人定義 を本マスタ参照に統一（spec 2026-05-09-forest-corporations-mock-migration.md 経由）
 */

export interface GardenCorporation {
  /** 法人 ID（kebab-case、英小文字、Forest mock corporation_id 互換）*/
  id: string;
  /** 正式法人名 */
  name: string;
  /** 略称（英）*/
  shortName: string;
  /** WebP アイコンパス（public 配下）*/
  icon: string;
  /** カラー HEX（東海林さん 2026-05-09 マッピング）*/
  color: string;
  /** カラー名（日本語、UI 表示用）*/
  colorName: string;
  /** 業態 / 役割 */
  role: string;
}

export const GARDEN_CORPORATIONS: readonly GardenCorporation[] = [
  {
    id: "hyuaran",
    name: "株式会社ヒュアラン",
    shortName: "Hyuaran",
    icon: "/themes/corporate-icons/hyuaran.webp",
    color: "#F4A6BD",
    colorName: "ピンク（薄桃〜淡桜）",
    role: "グループ HD・人材",
  },
  {
    id: "centerrise",
    name: "株式会社センターライズ",
    shortName: "Centerrise",
    icon: "/themes/corporate-icons/centerrise.webp",
    color: "#8E7CC3",
    colorName: "紫（藤色〜菫色）",
    role: "コールセンター運営",
  },
  {
    id: "linksupport",
    name: "株式会社リンクサポート",
    shortName: "LinkSupport",
    icon: "/themes/corporate-icons/linksupport.webp",
    color: "#4A6FA5",
    colorName: "青（群青〜空色）",
    role: "業務支援・連携",
  },
  {
    id: "arata",
    name: "株式会社 ARATA",
    shortName: "ARATA",
    icon: "/themes/corporate-icons/arata.webp",
    color: "#E8743C",
    colorName: "橙（朱橙〜山吹）",
    role: "新規事業",
  },
  {
    id: "taiyou",
    name: "株式会社たいよう",
    shortName: "Taiyou",
    icon: "/themes/corporate-icons/taiyou.webp",
    color: "#F9C846",
    colorName: "黄（山吹〜蜂蜜色）",
    role: "エネルギー・関電業務委託",
  },
  {
    id: "ichi",
    name: "株式会社壱",
    shortName: "Ichi",
    icon: "/themes/corporate-icons/ichi.webp",
    color: "#C0392B",
    colorName: "赤（朱赤〜緋色）",
    role: "第一・基幹",
  },
] as const;

/** 法人 ID 型 */
export type CorporationId = (typeof GARDEN_CORPORATIONS)[number]["id"];

/** 法人 ID で検索 */
export function getCorporationById(
  id: CorporationId | string,
): GardenCorporation | undefined {
  return GARDEN_CORPORATIONS.find((c) => c.id === id);
}

/** 法人名（部分一致）で検索 */
export function findCorporationByName(
  name: string,
): GardenCorporation | undefined {
  return GARDEN_CORPORATIONS.find(
    (c) => c.name === name || c.shortName === name,
  );
}

/** 全 6 法人の id 配列 */
export const ALL_CORPORATION_IDS: readonly CorporationId[] =
  GARDEN_CORPORATIONS.map((c) => c.id) as readonly CorporationId[];

/** Forest mock corporation_id 互換 mapping（旧 mock-corp-1 / mock-corp-2 → 新 ID）
 *
 * Phase A-2.1 fetcher 移行時に使用。旧 mock-corp-1 = ヒュアラン本体、
 * 旧 mock-corp-2 = ヒュアラングループ HD だったが、グループ HD は本マスタには含めず、
 * 「ヒュアラン本体」が HD 役割を兼ねる前提（Forest 連携 spec で確定）。
 */
export const LEGACY_FOREST_MOCK_ID_MAP: Readonly<Record<string, CorporationId>> = {
  "mock-corp-1": "hyuaran",
  "mock-corp-2": "hyuaran", // HD は本体に統合、別行表示時は別途分岐
};
