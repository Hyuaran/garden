# main- No. 10 dispatch - claude.ai に「Garden 共通 login + Tree UI」一括試作起草依頼 - 2026-05-02

> 起草: a-main-010
> 用途: claude.ai に共通 login と Tree UI 試作起草を一括依頼
> 番号: main- No. 10（v4 新フォーマット適用第 1 弾）
> 起草時刻: 2026-05-02(土) 11:09

---

## 投下用短文（東海林さんが claude.ai にコピペ）

~~~
⭐ main- No. 10
【a-main-010 から claude.ai への dispatch（Garden 共通 login + Tree UI 試作起草 一括依頼）】
発信日時: 2026-05-02(土) 11:09

claude.ai に試作起草を 2 件まとめて依頼します。両方とも HTML/CSS デザイン試作で、
Next.js 化は post-5/5 で a-bloom-002 / a-tree が担当します。

【依頼 1: Garden 共通 login 画面 試作起草】

東海林さん明示要望（2026-05-02 10:46）:
「ログイン画面は Garden シリーズすべて共通にしたい」

要件:
- 全モジュール（Bloom / Tree / Bud / Forest / Root / Sprout / Calendar / Soil / Rill / Fruit / Seed）
  共通の入口ログイン画面
- 1 つの login で全モジュールにアクセス可能
- ログイン後、ユーザーが目的のモジュールに遷移できる動線
- Bloom 系 6 画面で確立したデザイン要素を継承（通知ベル / Help / Favorite / User dropdown 等の前提）

デザイン方向性:
- Bloom 系 6 画面と同じトーン（華やか + 親しみ）
- 後道さん採用ゲートを通る品質
- 遊び心 ver home 画面のデザインを将来継承する想定（Step 1 完成後に統合 OK）

保存先: _chat_workspace\garden-common-login\
ファイル命名: chat-ui-garden-login-<画面名>-20260502.<ext>
  例: chat-ui-garden-login-main-20260502.html (.css / .js)
  例: chat-ui-garden-login-module-selection-20260502.html (login 後のモジュール選択画面)

【依頼 2: Tree UI 全画面 試作起草】

a-tree が資料化完了（4 ファイル、1,296 行）:
配置: _chat_workspace\garden-tree\design_prep\
- chat-tree-screen-list-20260502.md (231 行、26 画面網羅)
- chat-tree-permission-matrix-20260502.md (303 行、26 × 7 garden_role)
- chat-tree-current-impl-notes-20260502.md (318 行、component / Server Action / Hook)
- chat-tree-ui-specifics-20260502.md (444 行、業務集中重視 + 試作優先順位)

a-tree からの重要メッセージ 7 件（最優先反映）:
1. 背景画像 NG or 極控えめ厳守（白 or 極淡グラデーション推奨、Bloom の華やか森背景は不可）
2. 業務集中重視 = 装飾より機能（季節演出 / 時間帯変化 / パーティクル全 NG）
3. toss UI から closer 状況非表示（memory project_tree_toss_focus_principle.md、絶対原則）
4. 既存ショートカット F1-F10 + Ctrl+* 不変（FM 互換、現場手癖維持）
5. 既存ボタン色（緑/赤/金/グレー 4 色基準）不変
6. Bloom 統一要素（通知ベル / Help / Favorite / User dropdown / ActivityPanel / Theme pre-load）採用 OK
7. 試作優先順位: calling/sprout > calling/branch > dashboard > call > KPIHeader/SidebarNav

権限差分（permission-matrix 参照）:
- 7 段階（toss / closer / cs / staff / manager / admin / super_admin）
- 各画面で表示有無 / 機能制限 / 表示項目差分
- UI グレーアウトパターン明記

保存先: _chat_workspace\garden-tree\
ファイル命名: chat-ui-tree-<画面名>-20260502.<ext>
  例: chat-ui-tree-calling-sprout-20260502.html (.css / .js)
  例: chat-ui-tree-dashboard-20260502.html
  例: chat-ui-tree-call-20260502.html

【着手順序】

優先順位:
1. Garden 共通 login（Tree も使うため先行起草）
2. Tree UI 試作優先順 1: calling/sprout
3. Tree UI 試作優先順 2: calling/branch
4. Tree UI 試作優先順 3: dashboard
5. Tree UI 試作優先順 4: call
6. Tree UI 試作優先順 5: KPIHeader/SidebarNav
7. その他 Tree 画面（順次、優先度低い順）

【スコープ・期限】

- 5/5 デモ前: 共通 login 1-2 画面 + Tree 優先順 1-2 まで（最低限）
- post-5/5: 残り Tree 画面を順次起草
- 全画面起草完了目標: 5/8 頃

【保存ルール（重要）】

- 全ファイルは _chat_workspace\ 配下に create_file（既存場所への書き込み禁止）
- 上書き禁止（変更時は別名 _vN.<ext> 等）
- 保存前に東海林さん確認推奨（「これを <パス> に保存していいか」）

【関連 memory（参考）】

- project_post_5_5_tasks.md（共通 login と Tree UI 一新は post-5/5 タスク）
- project_tree_toss_focus_principle.md（Tree トス役割は集中原則）
- feedback_shoji_visual_judgment_required.md（実物判断必須、試作起草が東海林さん視覚判断材料に）
- feedback_dispatch_header_format.md v4（ヘッダー形式 main- No. NNN）

【完了報告期待】

各試作起草完了時に a-main-010 に完了報告（v4 ヘッダー形式 + 接頭辞 daily-report 経由 or
claude.ai 自身として claude-chat-NNN）。
保存先 path + ファイル名一覧を共有してください。

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | claude.ai (Claude Chat) に貼り付け投下 |

→ claude.ai が試作起草開始 → _chat_workspace\ に保存 → 作業日報セッションが整理移送。

## 改訂履歴

- 2026-05-02 初版（main- No. 10、共通 login + Tree UI 一括依頼、v4 新フォーマット第 1 弾）
