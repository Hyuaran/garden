~~~
🟡 main- No. 237
【a-main-020 から claude.ai chat（Garden UI 021）への dispatch】
発信日時: 2026-05-11(月) 11:37

# 件名
forest-html-15（tab-2 修正版）受領 + main 配置完了 + forest-html-16（tab-3 修正版）起草着手 GO

# 1. forest-html-15 受領 + 配置完了

| 項目 | 結果 |
|---|---|
| forest-html-15 受領 | ✅（2026-05-11 11:23 起草）|
| HTML 全文 構造 | ✅ tab-1 既稼働 topbar / sidebar-dual / activity-panel 完全踏襲、内側コンテンツ保持、Root ミラー HTML コメント追加 |
| main 配置 | ✅ `_chat_workspace/garden-forest/html_drafts/tab-2-financial-summary.html` 上書き完了（旧 forest-html-10 構造不整合版から forest-html-15 構造完全修正版へ）|
| ファイルサイズ | 39.9K（forest-html-10 とほぼ同等、構造のみ修正で内側コンテンツは保持された証拠） |

# 2. 起草着手 GO: forest-html-16（tab-3 修正版）

東海林さん明示「次（forest-html-16 起草）」相当の GO（2026-05-11 11:37 受領想定）。

claude.ai は forest-html-16 起草に着手:
- 配置先（上書き）: `_chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html`
- 構造方針: tab-2 修正版（forest-html-15）と同じ外側構造、内側 cashflow 4 セクション保持
- データ修正: パターン B（リンクサポート + たいよう cell 口座 2 削除、main- No. 231 §2 反映）
- Root ミラー HTML コメント追加（`<main>` 直前）

# 3. forest-html-16 必須遵守事項（再掲）

main- No. 226 + main- No. 231 + main- No. 236 統合:

| # | 項目 |
|---|---|
| 1 | tab-1 既稼働 topbar / sidebar-dual / activity-panel 完全踏襲（forest-html-15 と同じ） |
| 2 | cashflow 4 セクション保持（銀行残高一覧 / 月次 CF / 売掛買掛 / 入出金予定） |
| 3 | パターン B データ修正（リンクサポート + たいよう cell 口座 2 削除、ratio amount / 全法人合計 / 構成比 維持） |
| 4 | Root ミラー HTML コメント追加（`<main>` 直前） |
| 5 | 6 法人カラー厳守 / Forest 緑系 / bg-forest-light/dark / レスポンシブ / Chart.js 4.4.0 |
| 6 | ウサギ削除 |
| 7 | gf-cf-* プレフィックス（tab-3 固有） |
| 8 | nav-pages active=tab-3 |

# 4. main 側次タスク（forest-html-16 受領後）

1. tab-3 修正版 HTML を `_chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html` に上書き配置
2. ls 物理確認
3. main- No. 後続候補: a-review に tab-2 + tab-3 修正版実描画再評価依頼（review-13 訂正評価フロー）
4. tab-4〜tab-7 + tab-8 起草継続（共通構造確立後の Forest UI シフト次フェーズ）or 「準備中」6 モジュール起草へ展開

# 5. 緊急度

🟡 中（Forest UI シフト第 2 弾の本体実装、tab-4-7 起草移行 + 「準備中」ページ展開の前提）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] forest-html-15 受領 + 配置完了 明示
- [x] forest-html-16 起草着手 GO 明示
- [x] 必須遵守事項 8 件再掲
- [x] main 側次タスク明示
- [x] 番号 = main- No. 237（counter 継続）
~~~
