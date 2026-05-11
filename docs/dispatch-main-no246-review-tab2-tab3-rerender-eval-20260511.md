~~~
🟡 main- No. 246
【a-main-021 から a-review への dispatch】
発信日時: 2026-05-11(月) 12:21

# 件名
forest-html-16 受領（tab-3 構造完全修正版）+ 配置完了 → tab-2（forest-html-15）+ tab-3（forest-html-16） **実描画再評価** 依頼（review-14、違反 10 再発防止策準拠の実描画スクショ必須）

# A. 経緯（review-13 自己 critique 後の正式 review-14 依頼）

- review-11（5/11 朝）: tab-2 forest-html-10 採用判定 → 後に実描画未確認 + 共通 CSS 不整合見落としで違反 10 発生
- review-13（5/11 11:15）: 自己 critique + 改善宣言 + 「修正版受領後の review-14 で実描画再評価」コミット
- forest-html-15: tab-2 構造完全修正版完成・配置済（5/11 朝）
- forest-html-16: tab-3 構造完全修正版受領（5/11 11:42）+ 配置完了（5/11 12:20、commit 投入予定）
- → 本 dispatch で正式 review-14 依頼

# B. 評価対象（2 ファイル）

| # | tab | ファイル | 構造起源 | 重要修正 |
|---|---|---|---|---|
| 1 | tab-2 財務サマリー | `G:/マイドライブ/.../_chat_workspace/garden-forest/html_drafts/tab-2-financial-summary.html`（forest-html-15）| tab-1 既稼働構造完全踏襲 | review-11 採用判定の訂正・正式 review |
| 2 | tab-3 キャッシュフロー | `G:/マイドライブ/.../_chat_workspace/garden-forest/html_drafts/chat-ui-forest-tab-3-cashflow-v1-20260511.html`（forest-html-16）| tab-1 既稼働構造完全踏襲 | パターン B 修正反映（リンクサポート/たいよう cell 口座 2 削除）+ Root ミラー HTML コメント |

参考対象（既稼働 baseline）:
- tab-1 ダッシュボード: `tab-1-dashboard.html`（65.1K）

# C. 評価観点（共通 6 + tab-3 独自 3 = 9 観点）

## C-1. 共通観点（tab-2 + tab-3 共通）

| # | 観点 | 評価方法 |
|---|---|---|
| 1 | topbar 構造踏襲 | tab-1 line 845-889 と class 命名 + 構造一致確認 |
| 2 | sidebar-dual nav-apps 構造踏襲 | nav-apps 12 アプリ順序（bloom/fruit/seed/forest/bud/leaf/tree/sprout/soil/root/rill/calendar）+ data-status 属性 + nav-app-item 内 span 構造一致 |
| 3 | sidebar-dual nav-pages 構造踏襲 | nav-pages-header + nav-pages-divider + nav-page-item 内 span 構造一致、active tab 正しい |
| 4 | nav-pages-toggle 配置 | sidebar 直後外側配置確認 |
| 5 | activity-panel 構造踏襲 | activity-header + activity-list + notify-btn 構造一致 |
| 6 | 共通 CSS パス整合性 | `<link rel="stylesheet" href="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/css/style.css">` の解決確認 |

## C-2. tab-3 独自観点

| # | 観点 | 評価方法 |
|---|---|---|
| 7 | パターン B データ修正 | リンクサポート + たいよう cell に口座 2 行が削除されているか確認、ratio amount / 合計 ¥437,930,000 / 構成比 6 法人分維持 |
| 8 | Root → Forest ミラー HTML コメント | `<main>` 直前の HTML コメントブロック存在確認、データ保管元 / 表示先記述の正確性 |
| 9 | 4 セクション保持 | 銀行残高 / 月次CF / 売掛買掛 / 入出金予定 の 4 セクション完全保持確認 |

# D. 実描画必須事項（違反 10 再発防止策準拠）

memory `feedback_self_visual_check_with_chrome_mcp` § 6.5（提案 1 採用後）+ `feedback_my_weak_areas` # 10（review 過信、提案 3 採用後）準拠:

| # | 必須事項 | 詳細 |
|---|---|---|
| 1 | Chrome MCP 起動 + 実描画スクショ | tab-2 + tab-3 を Chrome MCP で開き、実描画スクリーンショット取得 |
| 2 | tab-1 ダッシュボードと並べて比較 | topbar / sidebar / activity-panel の見た目が tab-1 と完全一致しているか目視確認 |
| 3 | スクショ添付 | review-14 報告内に tab-2 / tab-3 / tab-1（参考） 3 枚のスクショ参照 添付 |
| 4 | 構造比較で完結したら明示 | 「実描画確認実施」or「構造比較で完結」を明示、後者の場合 main は再度実描画依頼 |
| 5 | 共通 CSS 不整合検知 | grep `gf-cf-` / `gf-`プレフィックス vs `forest-common.css` 内 class 定義の差分検出（提案 2 採用後の v3 トリガー 4 準拠）|

# E. 評価結果フォーマット

review-13 自己改善宣言準拠、以下構造で起草:

| セクション | 内容 |
|---|---|
| C-1 共通 6 観点 | tab-2 / tab-3 各々 ✅ / ❌ / 要修正 を 6 行で表化 |
| C-2 tab-3 独自 3 観点 | ✅ / ❌ / 要修正 を 3 行で表化 |
| D 実描画必須事項 | 1-5 各々の実施状況を明示 |
| 検出問題 | 構造不整合 / データ不整合 / 共通 CSS 不整合 等を列挙 |
| 採用判定 | 「採用」「軽微修正後採用」「再修正要」のいずれか |
| スクショ参照 | 3 枚（tab-1 / tab-2 / tab-3）の Chrome MCP スクショ |

# F. 採用判定後の連動

| 判定 | a-main-021 連動 |
|---|---|
| ✅ 採用 | tab-4-7 + tab-8 起草 + 「準備中」6 モジュール（Fruit/Seed/Sprout/Calendar/Rill/Leaf）の HTML 起草を claude.ai に依頼（main- No. 後続候補）|
| 🟡 軽微修正後採用 | 修正点を claude.ai に dispatch → forest-html-17 起草依頼 |
| ❌ 再修正要 | 修正点詳細を claude.ai に dispatch → 構造完全修正版 v2 起草依頼 |

# G. 緊急度・期限

🟡 中（Forest UI 完成は 5/12 後道さんデモ前の重要マイルストーン、本日中の review-14 完走推奨）。

# 報告フォーマット（review-14）

冒頭 3 行（🟢 review-14 / 元→宛先 / 発信日時）+ ~~~ ラップ + ネスト不使用 + コードブロック不使用 + 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）+ スクショ参照（Chrome MCP の `mcp__Claude_Preview__preview_screenshot` 等で取得した実描画画像パス明記）。

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1/v5.2 完全準拠）
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 評価対象 2 ファイル + 参考 1 ファイル明示
- [x] 評価観点 9 件（共通 6 + tab-3 独自 3）明示
- [x] 実描画必須事項 5 件（違反 10 再発防止策準拠）明示
- [x] 採用判定後の連動 3 シナリオ明示
- [x] 緊急度 🟡 + 5/12 デモ前マイルストーン明示
- [x] 番号 = main- No. 246（counter 継続）
~~~
