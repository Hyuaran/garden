/**
 * Garden 共通キーボードショートカット「正本」
 *
 * ここが唯一の定義。モーダル表示（ShortcutsModal）はこの定義を読むだけにし、
 * 各画面のキー実装はこの割り当てに合わせる（ズレたら正本に寄せる）。
 *
 * 確定割り当て（2026-06-15 東海林さん確定）:
 *   - 検索ボックスへジャンプ        = Ctrl+Shift+G
 *   - レコード 前へ / 次へ          = Ctrl+↑ / Ctrl+↓
 *   - 検索モード 入 / 解除          = Ctrl+G / Esc
 *   - 検索実行                      = Enter
 *   - OR条件シート追加              = Ctrl+Enter（検索モード中）
 *   - 検索条件クリア                = Ctrl+/
 *   - 選択行を編集で開く            = Ctrl+Enter（一覧・マスタ）
 *
 * ※ Ctrl+Enter は文脈で意味が変わる（検索モード中＝OR追加 / 一覧＝編集を開く）。
 *   両方が同時に存在する画面は無いため衝突しない。
 */

export interface Shortcut {
  /** 表示するキー（順に並べて + で連結表示） */
  keys: string[];
  /** 操作の説明 */
  label: string;
  /** 補足（文脈など。任意） */
  note?: string;
}

export interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

export const GARDEN_SHORTCUTS: ShortcutGroup[] = [
  {
    title: "共通",
    items: [
      { keys: ["Ctrl", "Shift", "G"], label: "検索ボックスへジャンプ" },
    ],
  },
  {
    title: "レコード操作",
    items: [
      { keys: ["Ctrl", "↑"], label: "前のレコードへ" },
      { keys: ["Ctrl", "↓"], label: "次のレコードへ" },
      { keys: ["Ctrl", "Enter"], label: "選択行を編集で開く", note: "一覧・マスタ画面" },
    ],
  },
  {
    title: "検索モード（FileMaker風の絞り込み）",
    items: [
      { keys: ["Ctrl", "G"], label: "検索モードに入る／解除" },
      { keys: ["Esc"], label: "検索モードを解除" },
      { keys: ["Enter"], label: "検索を実行" },
      { keys: ["Ctrl", "Enter"], label: "OR条件シートを追加", note: "FileMaker の Ctrl+N に相当" },
      { keys: ["Ctrl", "/"], label: "検索条件をクリア" },
    ],
  },
];
