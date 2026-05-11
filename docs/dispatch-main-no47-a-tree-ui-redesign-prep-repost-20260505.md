# main- No. 47 dispatch - a-tree Tree UI 資料化依頼（main-8 リポスト + 状況アップデート） - 2026-05-05

> 起草: a-main-012
> 用途: 2026-05-02 起草 main-8（a-main-010 起草、未投下）を最新状況に合わせて再起草。Tree UI を Bloom 系世界観に統一するための事前資料化を a-tree に依頼
> 番号: main- No. 47
> 起草時刻: 2026-05-05(火) 18:22
> 緊急度: 🟡 5/8 後対応（5/8 デモ前の Tree 既存実装は触らない、資料化は時間あれば 5/8 まで、なくても 5/9 以降 OK）

---

## 改訂背景（main-8 → main- No. 47）

main-8（2026-05-02 起草）は a-main-010 が作成したが a-tree に未投下。a-main-012 が引き継ぎ後、東海林さん指示により再起草。

| 項目 | main-8（旧）| main- No. 47（新）|
|---|---|---|
| 番号 | main-8（旧形式）| main- No. 47（v4 形式）|
| 起草日時 | 2026-05-02(土) 10:17 | 2026-05-05(火) 18:22 |
| 期限 | 5/5 22:00（資料化）| **5/8 後 OK**（5/8 デモ前は Tree 既存に一切触らない）|
| Step 4 claude.ai 試作 | 「予定」 | **既に Bloom 世界観仕様書 発行済み**（report- No. 5 参照）|
| 参照仕様書 | なし | `_chat_workspace\chat-spec-garden-bloom-design-system-20260505.md` |

---

## 投下用短文（東海林さんが a-tree にコピペ）

~~~
🟡 main- No. 47
【a-main-012 から a-tree への dispatch（Tree UI 全画面 + 権限マトリクス 資料化依頼、Bloom 世界観統一準備）】
発信日時: 2026-05-05(火) 18:22

東海林さんから「Tree のアプリ自体の UI をまるっと変更したい、Bloom 系で確立した方向性に統一」との指示。a-tree に事前資料化をお願いします。

【背景・最新状況】

claude.ai 作業日報セッションが Bloom 世界観の試作版（v29 完成）+ Garden Bloom 世界観統一仕様書を発行済（5/5 18:04）:
- 仕様書 path: `_chat_workspace\chat-spec-garden-bloom-design-system-20260505.md`
- 内容: カラーパレット (accent-gold #d4a541)、フォント (EB Garamond / Cormorant Garamond / Shippori Mincho)、ceo-card クラス、文字下短点線見出し、ハッシュタグ風リンク、勤務形態 3 区分カラー等

→ Tree UI 統一の方向性は既に確定済み。a-tree は仕様書を参照しつつ、現状資料化を進める段取り。

【依頼内容: Tree 現状資料化】

a-tree が以下を `_chat_workspace\garden-tree\design_prep\` に資料化してください（HTML 書き換え禁止、ドキュメント化のみ）。

1. 画面リスト
   - 画面名 / URL path / 概要 / 現状スクショ（可能なら）
   - 全画面網羅（ログイン / ダッシュボード / 通話画面 / コール履歴 / 顧客検索 / 顧客詳細 / リード一覧 / トスアップ / 統計 / 設定 等）

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

【デザイン方向性（東海林さん指示 2026-05-02）】

A. Bloom 系で確立したデザイン要素を統一反映:
   - 通知ベル + バッジ
   - Help ボタン
   - Favorite ボタン + dropdown
   - User area dropdown（avatar + マイページ + 設定 + ログアウト）
   - ActivityPanel 折り畳みトグル
   - Theme pre-load script（ちらつき防止）
   - User dropdown ログアウト動線
   - **Bloom 世界観仕様書（chat-spec-garden-bloom-design-system-20260505.md）の §2-2 カラーパレット / §2-3 フォント / §3 UI コンポーネント仕様 全面参照**

B. Tree 固有制約:
   - **背景画像は NG or 控えめ**（架電業務集中重視、Bloom の華やかな森背景は不可）
   - 業務効率優先（無駄な装飾は最小限）
   - 集中阻害しないアニメーション

C. Tree 固有要素は a-tree 資料を最優先（claude.ai が試作する際の参照根拠）

【🔴 重要制約】

注意 1: HTML / コード変更厳禁
  - 5/8 デモ完了まで Tree 既存実装に一切触らない
  - ban / 障害引金回避（Tree は最慎重展開モジュール、コールセンター業務影響大）

注意 2: 実装着手は post-5/8
  - 5/9 以降、a-tree が試作 + 既実装の diff 取り → 視覚判断 → 実装
  - 段階展開（1 人 → 2-3 人 → 半数 → 全員、CLAUDE.md §17 準拠）

注意 3: 資料化期限
  - 5/8 後 OK（東海林さん指示変更）
  - ただし 5/8 デモ前に時間あれば先行着手可（Tree 既存実装に触らない範囲のみ）

【資料化ファイル命名（推奨）】

`_chat_workspace\garden-tree\design_prep\` 配下:
- chat-tree-screen-list-20260505.md（画面リスト）
- chat-tree-permission-matrix-20260505.md（権限マトリクス）
- chat-tree-current-impl-notes-20260505.md（現状実装メモ）
- chat-tree-ui-specifics-20260505.md（Tree 固有 UI 要素）
- スクショ等は同フォルダに配置

【次のフロー（参考、a-tree は資料化のみ）】

Step 1: a-tree 資料化（5/8 後 〜、本依頼）← 今回依頼
Step 2: a-main 受領 + 東海林さん確認
Step 3: claude.ai が Tree UI 試作起草（Bloom 世界観仕様書ベース）
Step 4: 作業日報セッションが整理移送
Step 5: a-tree が試作 + 既実装の diff 取り → 視覚判断材料準備
Step 6: 東海林さん視覚判断 → a-tree 実装（段階展開）

【完了報告期待】

資料化完了時に a-main（その時点の a-main-NNN）に報告（v4 ヘッダー形式 + 接頭辞 tree、例: tree-NN）。
画面リスト + 権限マトリクス + 現状実装メモ + Tree 固有 UI 要素の 4 ファイル（または分割パターン）の path を共有してください。

【関連 memory】

- feedback_dispatch_header_format.md（v4 ヘッダー形式）
- feedback_shoji_visual_judgment_required.md（実物判断必須）
- project_post_5_5_tasks.md（Tree UI 一新は post-5/5 タスク）
- project_tree_toss_focus_principle.md（Tree トス役割は集中原則）
- project_tree_d2_release_strategy.md（Tree 段階展開戦略）

【dispatch counter】

a-main-012: 次 main- No. 48
a-tree: 完了報告は tree-NN（a-tree 自身のカウンター）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-02 main-8 初版（a-main-010 起草、未投下のまま引き継ぎ）
- 2026-05-05 18:22 main- No. 47 として再起草（a-main-012、東海林さん B 案承認: 再採番 + 状況アップデート）
  - 番号 v4 形式（main- No. 47）
  - 期限 5/5 22:00 → 5/8 後 OK に変更
  - Bloom 世界観仕様書発行済み（chat-spec-garden-bloom-design-system-20260505.md）の参照を追加
  - Step 数を 6 ステップに整理
