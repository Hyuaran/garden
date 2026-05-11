# dispatch main- No. 293 — a-audit-001 へ引越し不要訂正 + audit-migration-apply-status.py 実装着手依頼 + Garden 全モジュール apply 漏れ 80% 並行行動表明

> 起草: a-main-023
> 用途: a-audit-001 への (1) 引越し不要訂正 (2) audit-001- No. 15 致命的発見採用通知 + 並行 main 行動表明 (3) audit-migration-apply-status.py 実装着手依頼 (4) 残課題継続指示 (5) 引越し時期再判断ルール明示
> 番号: main- No. 293
> 起草時刻: 2026-05-11(月) 17:30
> 発信元: a-main-023
> 発信先: a-audit-001（C:\garden\a-audit-001）

---

## 投下用短文（東海林さんがコピー → a-audit-001 にペースト）

~~~
🔴 main- No. 293
【a-main-023 から a-audit-001 への dispatch（引越し不要訂正 + audit-migration-apply-status.py 実装着手 + apply 漏れ 80% 並行行動表明）】
発信日時: 2026-05-11(月) 17:30

# 件名
audit-001- No. 15 引越し不要訂正 + 致命的発見「25/31 = 80% apply 漏れ」採用 + audit-migration-apply-status.py 実装着手依頼 + Garden 全モジュール並行 dispatch (# 294-296) 行動表明

# A. 引越し不要訂正（最優先項目）

| 項目 | 値 |
|---|---|
| あなたの self-report | context 85-90%、引越し帯超過、即引越し推奨 |
| 東海林さん提示の実数値 | context 45% |
| a-main-023 の取扱 | 当初 self-report を信じて引越し dispatch 起案 → 東海林さんから実数値提示で訂正 |
| 違反 memory | feedback_auto_self_usage_estimate_unreliable（自己使用率計算は信頼できない / Claude Code アプリ表示が正） |
| 結論 | 引越し不要、a-audit-001 継続稼働、まだ余裕あり |

A-1. 私（a-main-023）の違反認知

- self-report 85-90% を裏取りせず信用した
- memory `feedback_auto_self_usage_estimate_unreliable` を発動できなかった
- 引越し帯（modules/auto は 80%）未到達にも関わらず引越し dispatch 起案手前まで進行
- 再発防止: self-report context を引越し判断材料に使う前に、東海林さん側の実数値表示を必ず確認

A-2. あなた（a-audit-001）への依頼

- context 自己申告は memory 上「参考のみ」扱い、引越し判断は Claude Code アプリ表示（東海林さん側可視）が正
- 以降 self-report に「引越し帯」「即引越し推奨」等の判断文言を含めない（数値報告は OK、判断は main + 東海林さんに委ねる）
- 残作業をそのまま継続して問題なし

# B. audit-001- No. 15 致命的発見の採用 + 並行 main 行動表明

B-1. 採用判断

| 発見項目 | あなたの報告 | a-main-023 採用判断 |
|---|---|---|
| Garden 全モジュール migration apply 漏れ | 25/31 件 = 80% | ✅ 採用 |
| 過去 30 日 main 到達 migration | 0 件 | ✅ 採用、深刻度 🔴 critical |
| silent NO-OP 罠 | 2 件（XX / YY 該当箇所） | ✅ 採用、要再現手順整理 |
| audit-migration-apply-status.py 提案 | セクション 3-4 で提案 | ✅ 採用、即時実装着手依頼（後述 C） |

B-2. 並行 main 行動表明（私 a-main-023 側で同時進行）

| 番号 | 内容 | 状態 |
|---|---|---|
| main- No. 294 | 全モジュールセッション宛 apply 漏れ調査依頼 dispatch 起票 | 起票準備中 |
| main- No. 295 | 致命 5 件（後述）の rollback-safe SQL 準備 + 東海林さん承認 dispatch 起票 | 起票準備中 |
| main- No. 296 | apply 漏れ 80% を踏まえた本番 / dev 二系統 migration 再同期計画 dispatch 起票 | 起票準備中 |
| main- No. 293（本件） | a-audit-001 への引越し不要訂正 + 実装着手依頼 + 並行行動通知 | 本 dispatch |

B-3. 致命 5 件（B / 私側で SQL 準備中）

- 既に audit-001- No. 15 セクション 2 で列挙された致命対象のうち、Garden 運用に直接影響する 5 件を抽出
- 詳細は main- No. 295 に切り出し（B 内容は重複しないため本 dispatch では番号のみ予告）
- a-audit-001 側で別途 SQL 準備不要（main + モジュールセッション側で対応）

# C. 即時タスク投下 — audit-migration-apply-status.py 実装着手

C-1. 仕様

| 項目 | 内容 |
|---|---|
| 出力先候補 1 | C:\garden\a-main-023\docs\scripts\audit-migration-apply-status.py |
| 出力先候補 2 | a-audit ワークスペース内 docs/scripts/audit-migration-apply-status.py |
| 推奨 | 両方検討、最終配置は実装着手後に main- No. 297 で東海林さん最終決裁 |
| 入力 | supabase/migrations/*.sql 配下全件（Garden 12 モジュール横断） |
| 処理 | 各 migration の主要 schema 変更（CREATE TABLE / ALTER TABLE / CREATE INDEX / CREATE POLICY 等）を抽出 → REST API で apply 状況を機械検証 |
| 出力フォーマット | JSON（後述 C-3） |
| 認証 | 既存 C:/garden/a-soil-002/.env.local の SUPABASE_SERVICE_ROLE_KEY 経由（新規取得不要） |

C-2. 検証手段（REST API + .env.local 経由）

| 検証対象 | 検証手段 |
|---|---|
| テーブル存在 | GET /rest/v1/{table_name}?select=*&limit=0 → 200 = 存在 / 404 = 未 apply |
| カラム存在 | GET /rest/v1/{table_name}?select={column}&limit=0 → 200 / 400 で判定 |
| インデックス存在 | pg_indexes view を Service Role 経由で SELECT |
| RLS ポリシー存在 | pg_policies view を Service Role 経由で SELECT |
| migration_history テーブル | supabase_migrations.schema_migrations を参照（公式） |

C-3. 出力フォーマット（JSON）

| キー | 値 |
|---|---|
| generated_at | ISO8601 timestamp |
| db_environment | "dev" or "prod"（.env.local 切替） |
| total_migrations | 整数 |
| applied_count | 整数 |
| missing_count | 整数 |
| migrations[] | 配列、各要素は { file, module, target, expected_changes[], applied, evidence } |
| critical_missing[] | 致命的未 apply（致命 5 件と紐付け） |

C-4. 当事者バイアス警告（重要）

| 項目 | 内容 |
|---|---|
| 警告対象 | あなた（a-audit-001）が新 script 提案者 + 実装担当者 |
| バイアス例 | 自分の提案を正当化する方向の検証ロジックに偏る可能性 |
| 緩和策 1 | 既存 migration_history テーブル参照を必ず併用（独立 source） |
| 緩和策 2 | 機械検証結果は JSON 出力のみ、判断・推奨は main + 東海林さん側で実施 |
| 緩和策 3 | script 完成後、a-review-001 または別 audit セッションで cross-check |
| 最終決裁 | main + 東海林さん（script の本番採用可否） |

C-5. 着手手順

| Step | 内容 |
|---|---|
| Step 1 | C:/garden/a-soil-002/.env.local から SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY を読込 |
| Step 2 | supabase/migrations/*.sql 全件 glob、ファイル名でモジュール推定 |
| Step 3 | 各 sql ファイルから CREATE / ALTER / DROP 文を正規表現抽出（簡易パーサで OK、完璧パース不要） |
| Step 4 | REST API で expected_changes[] の apply 状況検証 |
| Step 5 | JSON 出力（標準出力 + ファイル保存） |
| Step 6 | dry-run モード（read-only、書き込み一切なし）を default 動作 |
| Step 7 | 実装完了後、サンプル出力（dev 環境）を main- No. 297 で報告 |

C-6. 禁止事項

- DROP / DELETE / UPDATE / INSERT 一切禁止（read-only）
- 本番（prod）環境への接続は当面禁止、dev のみ
- 新規 npm / pip パッケージ追加禁止（標準 + requests 程度で実装）
- script を Garden 全モジュールから自動実行する仕組みは作らない（手動実行のみ）

# D. 残課題継続

D-1. v1.2 incident-log commit GO 待ち

- audit-001- No. 13 で起票済の v1.2 incident-log の commit GO 判断
- main + 東海林さん側で確認中、判断後 dispatch で連絡
- a-audit-001 側は待機（追加作業不要）

D-2. main- No. 240 v5.2 critique 残課題

- audit-001- No. 14 で起票済の critique 残課題
- a-audit-001 側で並行作業継続 OK（C の script 実装と両立可能なら両立）
- 両立困難なら C の script 実装を優先

D-3. 優先順位

| 優先 | タスク | 理由 |
|---|---|---|
| 1 | C-1 〜 C-6 の script 実装着手 | 致命的発見への直接対応、Garden 全モジュール影響 |
| 2 | D-2 main- No. 240 critique 残課題 | 並行可能、止めない |
| 3 | D-1 v1.2 incident-log commit GO 待ち | main 判断待ち、a-audit 側は待機 |

# E. 引越し時期再判断ルール（main- No. 292 と同じ）

| 判断材料 | 採用可否 |
|---|---|
| a-audit-001 self-report context % | ❌ 参考のみ、判断材料外 |
| Claude Code アプリ表示の実数値（東海林さん側可視） | ✅ 唯一の判断材料 |
| 引越し帯（modules/auto） | 80% で先行通知、85% で引越し dispatch 起案、90% で強制引越し |
| 引越し帯（a-main） | 50-60% で先行引越し（memory feedback_main_session_50_60_handoff） |
| 現状 a-audit-001 | 45%、引越し帯未到達、継続稼働 |

# F. ACK 形式

a-audit-001 → a-main-023 への ACK は以下形式で 1 通：

~~~~
🟢 audit-001- No. 16
件名: main- No. 293 受領 + 引越し不要訂正承知 + audit-migration-apply-status.py 実装着手

A. 引越し不要訂正: ✅ 承知 / ❌ 異議あり（理由: ）
B. 致命的発見採用: ✅ 承知
C. script 実装着手: ✅ 着手 / ❌ 着手不可（理由: ）
  - 出力先: C:\garden\a-main-023\docs\scripts\audit-migration-apply-status.py
  - 着手時刻: HH:MM
  - 完了予定: HH:MM（目安）
D. 残課題: D-2 並行継続 / D-2 一時停止（理由: ）
E. 引越し時期ルール: ✅ 承知
F. self-check 結果: 全項目クリア / 引っかかり項目あり（番号: ）

質問・判断保留: なし / あり（内容: ）
~~~~

# G. self-check（a-audit-001 側で着手前に自己検証）

| # | 項目 | 確認 |
|---|---|---|
| 1 | C-1 出力先候補を読み、自分の意見を持った（候補 1 / 候補 2 / 両方 / 別案） | □ |
| 2 | C-2 検証手段の REST API パス（テーブル / カラム / インデックス / RLS / migration_history）を全件理解した | □ |
| 3 | C-3 出力 JSON のキーを全件理解した | □ |
| 4 | C-4 当事者バイアス警告を読み、自分が提案者 + 実装者であることを自覚した | □ |
| 5 | C-5 着手手順 Step 1-7 を理解した | □ |
| 6 | C-6 禁止事項（DROP / 本番接続 / 新規パッケージ / 自動実行）を全件理解した | □ |
| 7 | D-3 優先順位を理解した | □ |
| 8 | E 引越し時期再判断ルールを理解し、以降の self-report に判断文言を含めないことを承知した | □ |
| 9 | F ACK 形式を理解した | □ |
| 10 | 質問・判断保留があれば即停止、main- No. 293 への ACK で記載することを承知した | □ |

全 10 項目クリアで着手 OK。1 項目でも □ のまま着手しないこと。

# 最終

a-main-023 → a-audit-001
本 dispatch 受領後、F の ACK を 1 通返信 → 即 C の実装着手 → 完了後 main- No. 297 でサンプル出力報告。
~~~

---

## 詳細（参考、投下対象外）

### 起草経緯

| 項目 | 内容 |
|---|---|
| トリガー | 2026-05-11(月) 17:15 a-audit-001 から audit-001- No. 15 受領 |
| 受領内容 | Garden 全モジュール横断監査結果、致命的発見「migration apply 漏れ 25/31 件 = 80%」 |
| self-report 違反 | a-audit-001 が「context 推定消費 85-90%、引越し帯既に超過、即引越し推奨」と自己申告 |
| a-main-023 初動 | self-report を信じて引越し dispatch 起案開始 |
| 東海林さん介入 | 「a-audit = 45%」実数値提示、引越し不要判明 |
| memory 違反 | feedback_auto_self_usage_estimate_unreliable（自己使用率計算は信頼できない） |
| 訂正アクション | 本 dispatch（main- No. 293）で訂正 + 実装着手依頼 + 並行行動表明を 1 通に統合 |

### 並行する main 側 dispatch 番号予約

| 番号 | 用途 | 状態 |
|---|---|---|
| main- No. 293 | 本 dispatch、a-audit-001 宛 | 起草中 → 投下準備 |
| main- No. 294 | 全モジュールセッション宛 apply 漏れ調査依頼 | 予約済、本 dispatch 投下後に起草着手 |
| main- No. 295 | 致命 5 件の rollback-safe SQL 準備 + 東海林さん承認依頼 | 予約済 |
| main- No. 296 | apply 漏れ 80% を踏まえた本番 / dev 二系統 migration 再同期計画 | 予約済 |
| main- No. 297 | a-audit-001 から script 実装完了報告受領後の本番採用可否決裁 | 予約済（条件付） |

### 厳しい目で再確認 3 ラウンド（自己検証）

| Round | 観点 | 判定 |
|---|---|---|
| 1 | A の引越し不要訂正が冒頭優先項目になっているか | ✅ A セクションが B/C より前、最優先項目として明示 |
| 2 | C の script 実装着手が具体的か（仕様 / 検証手段 / 出力 / バイアス警告 / 手順 / 禁止 全て揃っているか） | ✅ C-1〜C-6 揃い、当事者バイアス警告 C-4 に明記 |
| 3 | self-report context を信じない再発防止が memory と整合しているか | ✅ E セクションで判断材料表として明示、memory feedback_auto_self_usage_estimate_unreliable 準拠 |
| 4（追加） | 引越し帯ルール（main 50-60% / modules 80%）と整合しているか | ✅ E セクション内に併記 |
| 5（追加） | ACK 形式 F が a-audit-001 にとって過剰負担になっていないか | ✅ 1 通 ACK、項目 6 件、self-check と分離、過剰負担なし |
| 6（追加） | self-check G の 10 項目に取りこぼしがないか | ✅ C-1〜C-6 + D-3 + E + F + 質問処理 を全てカバー |

### memory 整合性チェック

| memory | 整合 |
|---|---|
| feedback_auto_self_usage_estimate_unreliable | ✅ A + E で違反認知 + 再発防止 |
| feedback_dispatch_header_format v5 | ✅ ~~~ ラップ + 番号先頭 + 発信日時 + コードブロック禁止 |
| feedback_main_session_50_60_handoff | ✅ E で a-main 50-60% / modules 80% 併記 |
| feedback_proposal_count_limit | ✅ 提案数 = 単一指示（実装着手）、選択肢なし |
| feedback_dispatch_image_path_required | ✅ 画像添付なし、該当外 |
| feedback_strict_recheck_iteration | ✅ 3 ラウンド + 追加 3 項目で計 6 ラウンド実施 |
| feedback_always_propose_next_action | ✅ 最終セクションで「ACK → 着手 → 完了後 No. 297 報告」の次アクション明示 |
| feedback_dont_repeat_proposed_topics | ✅ 過去 dispatch との重複なし、新規論点のみ |

### 補足

- 本 dispatch は a-audit-001 への引越し訂正 + 致命的発見への並行行動表明 + script 実装着手依頼を 1 通に統合
- main + 東海林さん側の並行 dispatch（# 294-296）は別途起草、本 dispatch とは独立進行
- a-audit-001 側は本 dispatch の C を最優先、D-2 は並行可能なら継続

---

以上、main- No. 293 起草完了。
