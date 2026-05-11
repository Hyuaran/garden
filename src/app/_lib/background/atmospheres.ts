/**
 * atmospheres.ts — Garden v2.8a 背景定数
 *
 * 構成:
 *   - 5 ライト atmospheres (id 1-5) + 1 night atmosphere (id 6)
 *   - light モード時は 1-5 のみ循環、dark モード時は 6 (night) のみ表示
 *   - 既存の ATMOSPHERES_V2 (login で使用中) とは別系統、後方互換維持
 *
 * 画像: public/images/backgrounds/bg_0{1-6}_*.png (Step 2 で配置済み)
 */

export type AtmosphereV28 = {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly path: string;
};

export const ATMOSPHERES_V28: ReadonlyArray<AtmosphereV28> = [
  {
    id: 1,
    key: "morning",
    name: "朝の光",
    path: "/images/backgrounds/bg_01_morning.png",
  },
  {
    id: 2,
    key: "water",
    name: "水のテラリウム",
    path: "/images/backgrounds/bg_02_water.png",
  },
  {
    id: 3,
    key: "glassdisk",
    name: "ガラスディスク",
    path: "/images/backgrounds/bg_03_glassdisk.png",
  },
  {
    id: 4,
    key: "crystal",
    name: "結晶の輝き",
    path: "/images/backgrounds/bg_04_crystal.png",
  },
  {
    id: 5,
    key: "sunlight",
    name: "陽光降る庭",
    path: "/images/backgrounds/bg_05_sunlight.png",
  },
  {
    id: 6,
    key: "night",
    name: "夜の庭",
    path: "/images/backgrounds/bg_06_night.png",
  },
] as const;

/** 全 atmospheres 数 (light 5 + night 1 = 6) */
export const ATMOSPHERE_V28_COUNT = ATMOSPHERES_V28.length;

/** light モード用 (id 1-5) */
export const ATMOSPHERES_V28_LIGHT: ReadonlyArray<AtmosphereV28> =
  ATMOSPHERES_V28.filter((a) => a.key !== "night");

/** dark モード用 (id 6 = night) */
export const ATMOSPHERE_V28_NIGHT: AtmosphereV28 = ATMOSPHERES_V28[5];

/** key で検索 */
export function getAtmosphereByKey(
  key: string,
): AtmosphereV28 | undefined {
  return ATMOSPHERES_V28.find((a) => a.key === key);
}

/* ========================================================================
 * Bloom 専用 atmospheres (Bloom Top 等の Bloom 配下画面で使用)
 * 5/5 デモ向け Phase 1 では light/dark 1 種ずつ、carousel なし。
 * ======================================================================== */

export const ATMOSPHERE_BLOOM_LIGHT: AtmosphereV28 = {
  id: 100,
  key: "bloom-garden-light",
  name: "Bloom 花咲く庭",
  path: "/images/backgrounds/bg_bloom_garden_light.png",
};

export const ATMOSPHERE_BLOOM_DARK: AtmosphereV28 = {
  id: 101,
  key: "bloom-garden-dark",
  name: "Bloom 月夜の庭",
  path: "/images/backgrounds/bg_bloom_garden_dark.png",
};

/* ========================================================================
 * Forest 専用 atmospheres (Forest 配下画面で使用)
 * 5/14-16 後道さんデモ向け Garden Series 統一世界観の中核素材。
 * 元素材: ChatGPT 生成 (5/9 01:50, 1920x1080 PNG, _reference/garden-forest/ 永続保管)
 * WebP 変換: Pillow quality=90, light -85.9% / dark -84.7% 圧縮 (5/9 22:08)
 * 対応 dispatch: main- No. 161 (5/9 01:51) / No. 188 (5/9 22:00 並列実装 GO)
 * ======================================================================== */

export const ATMOSPHERE_FOREST_LIGHT: AtmosphereV28 = {
  id: 102,
  key: "forest-light",
  name: "Forest 朝の森",
  path: "/images/backgrounds/bg-forest-light.webp",
};

export const ATMOSPHERE_FOREST_DARK: AtmosphereV28 = {
  id: 103,
  key: "forest-dark",
  name: "Forest 月夜の森",
  path: "/images/backgrounds/bg-forest-dark.webp",
};

/**
 * Forest atmospheres オブジェクト (BackgroundLayer 用、Bloom precedent 踏襲)
 * 使用例 (Forest UI 統一実装後):
 *   const { theme } = useTheme();
 *   const targetBg = theme === "dark" ? ATMOSPHERES_FOREST.dark.path : ATMOSPHERES_FOREST.light.path;
 *   <BackgroundLayer layer1Src={targetBg} ... />
 */
export const ATMOSPHERES_FOREST = {
  light: ATMOSPHERE_FOREST_LIGHT,
  dark: ATMOSPHERE_FOREST_DARK,
} as const;
