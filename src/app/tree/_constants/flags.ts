/**
 * Garden-Tree ビルドフラグ
 *
 * 本番環境で消したい「開発中・デモ用にだけ出したい UI」をここでトグルする。
 * - 既定は production ビルドでのみ false
 * - 環境変数 NEXT_PUBLIC_SHOW_*** で個別に上書き可能
 *
 * 追加フラグが増えたらこのファイルに集約する。
 */

/** 環境変数 → boolean の共通変換 (未指定なら dev=true / prod=false) */
function devOnly(envKey: string): boolean {
  const v = process.env[envKey];
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * 「画面1: ログイン」のような画面識別用ワイヤーフレームラベルを表示するか。
 *
 * - dev ビルド: 既定で true（開発中の画面特定を容易にするため）
 * - production ビルド: 既定で false（お客さんが見る画面には出さない）
 */
export const SHOW_WIREFRAME_LABELS: boolean = devOnly(
  "NEXT_PUBLIC_SHOW_WIREFRAME_LABELS",
);

/**
 * サイドバーの🔄権限切替ボタンなど、デモ用の操作UIを表示するか。
 *
 * - dev ビルド: 既定で true（権限ごとの画面表示確認に使う）
 * - production ビルド: 既定で false（本番では権限はログイン認証で確定する）
 */
export const SHOW_DEMO_CONTROLS: boolean = devOnly(
  "NEXT_PUBLIC_SHOW_DEMO_CONTROLS",
);
