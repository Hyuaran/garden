# main- No. 62 dispatch - a-forest 仕訳帳機能 現状確認 + 5 月中スコープ + 後道さん残高表示連携 - 2026-05-05

> 起草: a-main-012
> 用途: spec/forest-shiwakechou-design 仕様書 read 完了後、a-forest セッションに現状 + Phase 1 着手状況 + 緊急ニーズへの対応スコープを確認
> 番号: main- No. 62
> 起草時刻: 2026-05-05(火) 20:53
> 緊急度: 🔴 ヒュアラン決算 5 月中 + 後道さん向け現金流れ（MF API 停止対応）

---

## 投下用短文（東海林さんが a-forest にコピペ）

~~~
🔴 main- No. 62
【a-main-012 から a-forest への dispatch（仕訳帳機能 現状確認 + 5 月中スコープ + 後道さん残高表示連携）】
発信日時: 2026-05-05(火) 20:53

東海林さんから 2 件の緊急案件が発生、a-forest が暫定保有する仕訳帳機能（spec/forest-shiwakechou-design）と密接に関連するため、a-forest セッションに現状確認 + 対応スコープのご提案を依頼します。

【背景: 緊急案件 2 件】

# 1: ヒュアラン決算作業（〜5/9 でデータ準備、5/12-16 税理士作業）

東海林さん「Garden Forest 機能を早急に使用可能化する必要あり」
→ 仕訳帳機能で 6 法人の銀行 CSV → 弥生 CSV を生成、税理士提供データを今週中に準備したい

# 2: 後道さん向け現金流れ可視化（MF 銀行 API 停止対応）

東海林さん「MF クラウド会計の銀行 API 連携停止 → 後道さんが毎日見るルーティン崩壊」
→ せめて前日残高を翌日に表示できる仕組みを Garden 上に構築したい
→ データソース: 各銀行から CSV ダウンロード → Garden で取込

【a-main-012 の認識】

a-main-012 が spec を全文 read 完了:
- 配置: src/app/forest/shiwakechou/（暫定 Forest、将来 Bud 移行）
- DB: bud_* prefix 8 テーブル（corporations / bank_accounts / master_rules / intercompany_rules / transactions / yayoi_exports / files / audit_log）
- Phase 1: 銀行 CSV（楽天 / PayPay / 京都 / みずほ）→ 確認 → 弥生 CSV
- 既存 Python（G:\...\001_仕訳帳\）からの移植

→ Phase 1 が完成すれば bud_transactions テーブルに銀行明細が蓄積される。これを使えば後道さん向け前日残高表示も同セッション内で実装可能。

【確認事項 5 件】

# Q1: spec ブランチの現状

- ブランチ: `spec/forest-shiwakechou-design`、コミット `cc35e14`
- 現状: spec 単独 / develop 未 merge / PR 未発行 ?
- それとも既にレビュー → develop merge 済 ?
- a-forest 側で spec の修正・追加コミットが入っていますか？

# Q2: Phase 1 実装の着手状況

- 実装着手済み？未着手？
- もし着手中なら、どこまで完成？（テーブル migration / 銀行 CSV パーサー / 確認画面 / 弥生エクスポート / マスタ画面 のうち）
- 着手中の場合、現状ブランチ + commit hash 共有

# Q3: ヒュアラン決算（〜5/9 データ準備）に向けた最小スコープ

5/8 デモ + 5/8 までの並行進行を考慮、Phase 1 全機能は工数大。最小スコープで 5/9 までに実用化する案:

| 案 | 内容 | 工数感 |
|---|---|---|
| A | **Phase 1 完全実装**（4 銀行 + マスタ画面 + 弥生 + 監査）| 大（5 月中無理）|
| B | **最小 MVP**: 1〜2 銀行（みずほ + 楽天）+ 弥生 CSV 出力のみ、マスタは Excel→DB 一括 import script 1 回 | 中（5/9 までに実用化可能性）|
| C | 既存 Python スクリプト並走、Garden は今週は手をつけない | 小（決算は Python で対応、Garden は post-デモ）|

→ a-forest としての **推奨案 + 工数見積** を教えてください。

# Q4: 後道さん向け前日残高表示の連携可能性

bud_transactions が銀行明細を保管 → 前日残高表示画面を Phase 1 完了直後（or 並行）で追加可能か:

- 追加画面: `/forest/shiwakechou/[corp_id]/balance` or `/forest/shiwakechou/balance-overview`（全法人）
- 表示内容: 口座別前日残高 + 当日入出金合計
- 認証: 経営者ロール（後道さん向け、forest_users.role に新ロール追加 or admin 兼用）

→ 実装可能か、a-forest としての判断 + 工数見積。

# Q5: 不足リソース / ブロッカー

- 未確認の Python ロジック（特にみずほ .api 形式）
- 6 法人マスタ初期投入用 Excel データ
- Supabase Storage 設定（bud-files バケット）
- その他、進める上で必要な情報・権限

【次のフロー（a-forest 回答後）】

a-forest からの回答を受けて a-main-012 が:
1. 5 月中スコープを東海林さんと確定
2. main- No. 63 / 64 で具体的実装 dispatch（migration / parser / UI 等）

または、a-forest が既に詳細実装計画を持っているなら、そのまま着手 OK の権限委譲も可能。

【期限】

- a-forest 回答: 5/6 朝までに（東海林さんが朝にレビュー → 即承認 → 実装着手）
- ヒュアラン決算データ準備: 5/9 まで
- 後道さん向け残高: 5/9 までに MVP（Phase 1 と同時 or 直後）

【dispatch counter】

a-main-012: 次 main- No. 63
a-forest: forest-NN（既存カウンターからの連番）で完了報告予定

工数見込み (a-forest 側回答): 30 分（spec 確認 + 現状把握 + Q1-5 回答）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 20:53 初版（a-main-012、spec 全文 read 完了 + 緊急案件 2 件発生後）
