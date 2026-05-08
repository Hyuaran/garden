# main-8 dispatch - a-tree に Tree UI 全画面 + 権限マトリクス 資料化依頼 - 2026-05-02

> 起草: a-main-010
> 用途: Tree UI を Bloom 系方向性に統一する事前準備（資料化）
> 番号: main-8
> 起草時刻: 2026-05-02(土) 10:17

---

## 投下用短文（東海林さんが a-tree にコピペ）

~~~
⭐ main-8
【a-main-010 から a-tree への dispatch（Tree UI 全画面 + 権限マトリクス 資料化依頼）】
発信日時: 2026-05-02(土) 10:17

東海林さんから「Tree のアプリ自体の UI をまるっと変更したい、Bloom 系で確立した
方向性に統一」との指示。a-tree に事前資料化をお願いします。

【背景】

claude.ai が Bloom 系 6 画面のデザイン試作を完成させ（5/2 朝）、a-bloom-002 が
Next.js 化を着手中。同方向性で Tree UI もまるっと変更する方針。

そのため、まずは Tree の現状を a-tree が資料化 → claude.ai が新デザイン試作 →
a-tree が post-5/5 で実装、というフローで進めます。

【依頼内容: Tree 現状資料化】

a-tree が **5/5 まで** に以下を _chat_workspace\garden-tree\ design_prep\ に
資料化してください（HTML 書き換え禁止、ドキュメント化のみ）。

1. 画面リスト
   - 画面名 / URL path / 概要 / 現状スクショ（可能なら）
   - 全画面網羅（ログイン / ダッシュボード / 通話画面 / コール履歴 /
     顧客検索 / 顧客詳細 / リード一覧 / トスアップ / 統計 / 設定 等）

2. 権限マトリクス
   - 画面 × 権限（toss / closer / cs / staff / manager / admin / super_admin）
   - 各セルに「表示有無 / 機能制限 / 表示項目差分」を記載

3. 画面ごとの現状実装メモ
   - 主要 component / Supabase テーブル / 重要ロジック
   - 既存ファイルパス（src/app/tree/... 等）

4. Tree 固有 UI 要素（業務集中重視）
   - 架電中の集中を妨げない設計（背景画像 NG or 控えめ厳守）
   - 業務効率優先要素（電話番号表示 / トーク履歴 / トスアップ動線 等）
   - コール履歴の表示パターン
   - 顧客情報の表示パターン
   - その他 Tree 固有の重要 UI

【デザイン方向性（東海林さん指示 2026-05-02 10:17）】

A. Bloom 系で確立したデザイン要素を統一反映:
   - 通知ベル + バッジ
   - Help ボタン
   - Favorite ボタン + dropdown
   - User area dropdown（avatar + マイページ + 設定 + ログアウト）
   - ActivityPanel 折り畳みトグル
   - Theme pre-load script（chらつき防止）
   - User dropdown ログアウト動線

B. Tree 固有制約:
   - **背景画像は NG or 控えめ**（架電業務集中重視、Bloom の華やかな森背景は不可）
   - 業務効率優先（無駄な装飾は最小限）
   - 集中阻害しないアニメーション

C. Tree 固有要素は a-tree 資料を最優先（claude.ai が試作する際の参照根拠）

【🔴 重要制約】

注意 1: HTML / コード変更厳禁
  - 5/5 までは資料化のみ、Tree 既存実装に一切触らない
  - ban / 障害引金回避（Tree は最慎重展開モジュール、コールセンター業務影響大）

注意 2: 実装着手は post-5/5
  - 5/9 以降、a-tree が試作 + 既実装の diff 取り → 視覚判断 → 実装
  - 段階展開（1 人 → 2-3 人 → 半数 → 全員、CLAUDE.md §17 準拠）

注意 3: 資料化期限
  - 5/5 22:00 までに _chat_workspace\garden-tree\design_prep\ 配下に完成
  - 5/4-5/5 で a-main-010 が東海林さん確認 → claude.ai 試作起草へ

【資料化ファイル命名（推奨）】

_chat_workspace\garden-tree\design_prep\ 配下:
- chat-tree-screen-list-20260502.md（画面リスト）
- chat-tree-permission-matrix-20260502.md（権限マトリクス）
- chat-tree-current-impl-notes-20260502.md（現状実装メモ）
- chat-tree-ui-specifics-20260502.md（Tree 固有 UI 要素）
- スクショ等は同フォルダに配置

【次のフロー（参考、a-tree は資料化のみ）】

Step 1: a-tree 資料化（5/5 まで）← 今回依頼
Step 2: a-main-010 受領 + 東海林さん確認（5/4-5/5）
Step 3: claude.ai に Tree UI 試作起草依頼（5/4-5/5、main-9 で発行予定）
Step 4: claude.ai 試作起草（5/5-5/8、Bloom 方向性 + Tree 固有制約反映）
Step 5: 作業日報セッションが整理移送（5/8）
Step 6: a-tree が試作 + 既実装の diff 取り → 視覚判断材料準備（5/9-、post-5/5）
Step 7: 東海林さん視覚判断 → a-tree 実装（段階展開）

【完了報告期待】

資料化完了時に a-main-010 に報告（v3 ヘッダー形式 + 接頭辞 tree）。
画面リスト + 権限マトリクス + 現状実装メモ + Tree 固有 UI 要素の 4 ファイル
（または分割パターン）の path を共有してください。

【関連 memory】

- feedback_dispatch_header_format.md（v3 ヘッダー形式）
- feedback_shoji_visual_judgment_required.md（実物判断必須）
- project_post_5_5_tasks.md（Tree UI 一新は post-5/5 タスク）
- project_tree_toss_focus_principle.md（Tree トス役割は集中原則）
- project_tree_d2_release_strategy.md（Tree 段階展開戦略）

【dispatch counter】

a-main-010: 次 main-9（claude.ai 試作起草依頼予定）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | a-tree / Garden Tree セッションに貼り付け投下 |

## 改訂履歴

- 2026-05-02 初版（main-8、Tree UI 一新事前準備、a-tree 資料化依頼）
