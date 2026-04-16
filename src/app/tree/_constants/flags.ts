/**
 * Garden-Tree ビルドフラグ
 *
 * 本番環境で消したい「開発中にだけ出したい UI」をここでトグルする。
 * - 既定は production ビルドでのみ false
 * - 環境変数 NEXT_PUBLIC_SHOW_WIREFRAME_LABELS で明示的に上書き可能
 *
 * 追加フラグが増えたらこのファイルに集約する。
 */

const envFlag = process.env.NEXT_PUBLIC_SHOW_WIREFRAME_LABELS;

/**
 * 「画面1: ログイン」のような画面識別用ワイヤーフレームラベルを表示するか。
 *
 * - dev ビルド: 既定で true（開発中の画面特定を容易にするため）
 * - production ビルド: 既定で false（お客さんが見る画面には出さない）
 * - 環境変数で強制上書きしたい場合は "true" / "false" を設定
 */
export const SHOW_WIREFRAME_LABELS: boolean =
  envFlag === "true"
    ? true
    : envFlag === "false"
      ? false
      : process.env.NODE_ENV !== "production";
