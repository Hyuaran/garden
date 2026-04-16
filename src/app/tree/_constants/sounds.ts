/**
 * Garden-Tree 通知サウンド定義
 *
 * Web Audio API で合成される通知音のメタデータ。
 * 音源自体（合成ロジック）は _lib/sound-synth.ts に配置予定。
 */

/** サウンド種類（順番が playNotifSound の soundIndex に対応） */
export const SOUND_NAMES = [
  "小鳥のさえずり",
  "ギター",
  "風鈴",
  "木漏れ日",
  "小川のせせらぎ",
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

/**
 * 音量レベル → ゲイン変換
 * 0 = ミュート（再生しない）
 * 1〜5 = 段階的に大きく
 */
export const VOLUME_LEVELS: Record<number, number> = {
  1: 0.15,
  2: 0.3,
  3: 0.5,
  4: 0.7,
  5: 1.0,
};

export type VolumeLevel = 0 | 1 | 2 | 3 | 4 | 5;
