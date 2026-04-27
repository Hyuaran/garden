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
