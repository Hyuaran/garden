# Codex-448 完了報告

## 対象

Bloom 12画面、Tree 24画面。Tree のログインは対象外。マイページは既存の System への移動を維持し、移動前に Tree の閲覧設定を確認する。

- /bloom（ホーム）
- /bloom/blueprint（設計図）：全体 [overview]、モジュール [modules]
- /bloom/ceo-status（経営状況）：全体 [overview]、業績 [performance]、判断・会議 [decisions]、設定 [settings]
- /bloom/daily-report（日報）：サマリ [Summary]、達成事項 [Achievements]、進捗グラフ [Progress]、次の目標 [Next Goals]
- /bloom/kpi（経営指標）：サマリ [summary]、売上 [forest]、架電 [tree]、経理 [bud]、全社統合 [全社統合]、ヒュアラン [ヒュアラン]、センターライズ [センターライズ]、ARATA [ARATA]、リンクサポート [リンクサポート]、たいよう [たいよう]、壱 [壱]
- /bloom/monthly-digest（月次まとめ）：サマリ [Summary]、達成リスト [Achievements]、進捗グラフ [Progress]、次月目標 [Next Goals]
- /bloom/monthly-digest/[month]（月のまとめ）
- /bloom/monthly-digest/[month]/edit（月次まとめの編集）
- /bloom/progress（開発進捗）：全体 [overview]、モジュール [modules]、履歴 [history]
- /bloom/roadmap（ロードマップ）
- /bloom/workboard（ワークボード）：ワークボード [today]、週次 [weekly]、メンバー別 [members]
- /bloom/workboard/ceo-status（東海林さんの状況）
- /tree（ホーム）
- /tree/dashboard（ダッシュボード）
- /tree/mypage（マイページ）
- /tree/call（通話画面）
- /tree/calling/branch（クローザー架電）
- /tree/calling/sprout（トス架電）
- /tree/toss-wait（クローザー待ち）
- /tree/confirm-wait（前確・後確待ち）
- /tree/wrap-up（業務終了報告）
- /tree/follow-call（フォローコール）
- /tree/search（検索）
- /tree/scripts（スクリプト管理）
- /tree/qa（質問と回答）
- /tree/videos（動画）
- /tree/ranking（有効率）
- /tree/alerts（要フォロー）
- /tree/aporan（アポラン）
- /tree/birthday（誕生日）
- /tree/break-schedule（休憩予定）
- /tree/breeze（Breeze）
- /tree/chatwork（Chatwork情報）
- /tree/monitoring（モニタリング）
- /tree/feedback（フィードバック入力）
- /tree/feedback/list（フィードバック一覧）

## migration

- supabase/migrations/20261027000448_bloom_tree_view_permissions.sql（作成のみ・未適用）
- Bloom は viewers_can_add を DB check で禁止。Tree は既定オフ。
- 共有テーブルの参照を src 全体で確認。root_employees は他モジュールの認証・マスタも読むため RLS を追加していない。
- bloom_* 5表と開発進捗の root_daily_reports / root_daily_report_logs / root_module_progress は対象外モジュールに参照がないことを確認して SELECT の restrictive policy を追加。既存の書き込み policy は変更していない。
- soil_call_history は Tree の保存先。新しい policy は追加していない。
- /api/bloom/cron と /api/tree/update-password は変更なし。本番 DB・環境変数・git・npm install は操作なし。

## 設定なしの既定

Bloom は通常 staff / outsource / manager / admin / super_admin。経営状況だけ super_admin、月次編集は既存の編集制限どおり admin / super_admin。新しい閲覧者に編集操作は開放せず、月次編集は内容の読み取りだけを提供する。

Tree は各画面のURL入口では全8役職が通る従来の挙動を維持。画面内の役職別データ・操作制限も維持。以下は「入口 / メニュー」（○=可・表示、—=元々メニューなし）。マイページの内容は既存の移動先で判定する。

|画面|トス|クローザー|CS|社員|外注|責任者|管理者|全権管理者|
|---|---|---|---|---|---|---|---|---|
|/tree（ホーム）|○/—|○/—|○/—|○/—|○/—|○/—|○/—|○/—|
|/tree/dashboard（ダッシュボード）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/mypage（マイページ）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/call（通話画面）|○/—|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/calling/branch（クローザー架電）|○/—|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/calling/sprout（トス架電）|○/○|○/—|○/—|○/—|○/—|○/—|○/—|○/—|
|/tree/toss-wait（クローザー待ち）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/confirm-wait（前確・後確待ち）|○/—|○/—|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/wrap-up（業務終了報告）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/follow-call（フォローコール）|○/—|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/search（検索）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/scripts（スクリプト管理）|○/—|○/—|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/qa（質問と回答）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/videos（動画）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/ranking（有効率）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/alerts（要フォロー）|○/—|○/—|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/aporan（アポラン）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/birthday（誕生日）|○/—|○/—|○/—|○/—|○/—|○/—|○/—|○/—|
|/tree/break-schedule（休憩予定）|○/—|○/—|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/breeze（Breeze）|○/—|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/chatwork（Chatwork情報）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/monitoring（モニタリング）|○/—|○/—|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/feedback（フィードバック入力）|○/—|○/—|○/○|○/○|○/○|○/○|○/○|○/○|
|/tree/feedback/list（フィードバック一覧）|○/○|○/○|○/○|○/○|○/○|○/○|○/○|○/○|

設定なしで既存の閲覧者が見られなくなる画面：なし。609件のスコープ・APIテストと10件のメニュー描画テストで確認。サイドバーはURL入口の既定とは分けて従来の出し分けを渡している。

## 日本語にした見出し・タブ

- 設計図：全体、モジュール、AI役割分担、参照先、モジュール設計、モジュール設計情報、12モジュール・役割
- 経営状況：全体、業績、判断・会議、設定（英語の併記を除去）、経営指標と推移
- 日報：本日の日報、本日のサマリ、直近の日報、今週のサマリ、メンバー別。サマリ、達成事項、進捗グラフ、次の目標
- 月次まとめ：今月の総括、業務サマリ、進捗グラフ、達成リスト、次月目標、後道代表への報告。タブの英語併記を除去
- ワークボード：ワークボード、週次、メンバー別。走行中プロジェクト、本日のステータス、今日の予定、次のマイルストーン、週次達成、ワーカーステータス
- 経営指標：サマリ、売上、架電、経理、法人別KPI、Garden開発進捗
- 開発進捗：全体、モジュール、履歴、全体進捗、マイルストーン、モジュール別進捗、モジュール一覧
- ロードマップ：Phase → 段階
- Tree アポラン：英語の APPOINTER RANKING 併記を除去

## 検証

- npx tsc --noEmit：成功
- npx vitest run：577ファイル成功・8ファイルskip。5828件成功・32件skip、FAIL 0（全5860件）
- 追加テスト：全8役職の画面・タブ既定、拡大・縮小・個人追加、タブ優先、未知スコープ拒否、API拒否時の管理者接続未作成、別画面のデータ指定拒否、書き込み・cron境界、Tree の役職別メニュー維持と追加・非表示。
- UTF-8、BOM・連続疑問符への文字化けなしを検査。
