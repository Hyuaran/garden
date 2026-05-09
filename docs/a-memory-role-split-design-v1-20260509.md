# a-memory 役割分割 設計書 v1（020 期実装ベース）

> 起草: a-main-017 + 東海林さん 議論成果（2026-05-09 22:00 〜 23:30）
> 対象: 020 期以降の Garden 全体運用
> 目的: a-memory を「a-analysis 判断提案」「a-audit 監査」に分割、main 暴走防止 + 構造的死角検出 + 三点セット同期漏れ防止
> 永続化目的: 017 セッション消滅後も 020 が本設計書を Read で実装可能

---

## §1 概要 + 背景

### 1-1 経緯

- 5/9 23:00 a-main-018 起動時に「ガンガン = skip OK」誤解で 8 件違反（リセット症状）
- 6 重防御確立（sentinel / N ラウンド / 完了報告 / §0 ロック / 東海林さん定期チェック / a-memory）
- 5/9 23:00 過ぎ 東海林さん提案「a-memory を解析用 vs 監査用に分割」
- 5/9 23:00 〜 24:00 017 + 東海林さん議論で本設計書確定

### 1-2 目的

| 目的 | 効果 |
|---|---|
| main 暴走防止 | a-audit が main 単独編集を後追い critique |
| 構造的死角検出 | a-analysis（生成側）vs a-audit（監査側）の対構造で互いに critique |
| 三点セット同期漏れ防止 | 「Claudeへの指示」「手順」更新を a-analysis / a-audit が管理 |
| 017 消滅リスクヘッジ | 議論内容を本設計書として永続化、020 起動時に Read で再現可能 |

### 1-3 採択方針

| 観点 | 採択 |
|---|---|
| 単一 a-memory vs 6a/6b 分割 | **6a/6b 分割採択** |
| 実装タイミング | **020 期から実装**（018/019 期は除外、018 信頼喪失で完全リセット）|
| main の memory 編集権限 | **常時保持**（a-analysis/audit は提案・critique のみ）|

---

## §2 役割定義

### 2-1 セッション一覧

| セッション | 名称 | 役割 |
|---|---|---|
| **a-analysis 判断提案 001** | 解析・提案側 | memory 新設提案 / 改訂内容起草 / 棚卸し / 統合判断 / 「Claudeへの指示」「手順」更新案併起草 |
| **a-audit 監査 001** | 監査・相違調査側 | main / a-analysis 判断との相違確認 / 整合性検証 / 矛盾検出 / 違反検出 / 事故パターン蓄積 / claude.ai snapshot 整合 critique |

### 2-2 権限階層

| 主体 | 役割 | memory 編集権限 |
|---|---|---|
| **main**（a-main）| 登録 + 全体俯瞰 + 最終決裁 | ✅ 常時保持 |
| **a-analysis** | 判断・提案専門 | ❌ なし、提案のみ |
| **a-audit** | 監査・critique 専門 | ❌ なし、critique のみ |
| **東海林さん** | 全体決裁、最終人間ゲート | （main 経由）|

### 2-3 自己参照禁止（メタルール）

a-analysis / a-audit は **自身の運用ルール変更を自己提案できない**。

| 状況 | judge |
|---|---|
| a-analysis 自身の役割範囲変更 | 東海林さん + main 二者で判断 |
| a-audit 自身の事故 log フォーマット変更 | 同上 |
| 6a/6b 間の権限階層変更 | 同上 |

→ 自己 critique は構造的に不可。人間ゲート + main 必須。

---

## §3 起動・運用

### 3-1 起動方法

| 項目 | 内容 |
|---|---|
| 起動方式 | **on-demand**（main からの依頼時のみ起動）|
| worktree 作成 | **Claude（018/019 等）がタスク実行**、017 / 東海林さん負担なし |
| 起動コマンド | 東海林さんが `cd C:\garden\a-analysis-001` → `claude` |
| 初回起動 | memory 全件 Read（30-60 分、キャッシュ作成）|
| 2 回目以降 | キャッシュ + 差分 Read（**5-10 分**）|

### 3-2 セッション場所

| セッション | パス（初代）| 引越し後 |
|---|---|---|
| a-analysis | `C:\garden\a-analysis-001\` | `a-analysis-002`, `a-analysis-003` ... |
| a-audit | `C:\garden\a-audit-001\` | `a-audit-002`, `a-audit-003` ... |

### 3-3 起動コスト緩和（キャッシュ機構）

| 項目 | 内容 |
|---|---|
| キャッシュファイル | `docs/a-analysis-cache-YYYYMMDD.json`（前回 Read 済 memory のサマリー保持）|
| 差分 Read | 前回起動以降に追加 / 改訂された memory のみ Read |
| キャッシュ更新 | セッション終了時 + 起動時 |
| 失敗時動作 | キャッシュ破損なら再生成（30-60 分）|

### 3-4 独自 handoff loop

各セッション独立 handoff:
- 50-60% 帯で引越し（a-main 同様）
- 頻度低（on-demand = 月 1-2 回想定）
- 共通テンプレ docs: `docs/a-memory-handoff-template.md`（§6-1 で詳述）

---

## §4 dispatch flow

### 4-1 標準フロー（memory 新設・改訂、3 段経由）

```
main → a-analysis（提案起草）→ a-audit（critique）→ main（決裁・登録）
```

詳細手順:
1. main が memory 新設・改訂が必要と判断
2. main → a-analysis dispatch（main- No. NNN）
3. a-analysis が起草 → analysis-001- No. NN で main に提案 + 「Claudeへの指示」「手順」差分案併記
4. main → a-audit dispatch（critique 依頼）
5. a-audit が critique（整合性 / 矛盾 / 改善 / snapshot 整合）→ audit-001- No. NN で main 報告
6. main が修正版起草 → 東海林さん最終決裁仰ぎ
7. 東海林さん GO → main が memory ファイル登録 + 三点セット同期実施

### 4-2 違反検出フロー（独立、a-analysis 経由なし）

```
main → a-audit → main
```

main が「既存 memory との矛盾検出」「main 自身の違反 critique」依頼時。

### 4-3 事故報告フロー（独立、義務化）

事故発生時、main は **即時** に a-audit へ報告:

報告フォーマット:
- 件名: 事故 X 発生（緊急度 🟢🟡🔴）
- 事故内容: 発生時刻 / 違反内容 / 該当 memory / 影響範囲
- main 自己分析: 真因（推測）/ 暫定対処
- a-audit へのお願い: 客観分析 / 真因特定 / 再発防止策提案 / memory 改訂判断

a-audit 動作:
- 受領 → 客観分析 → main 報告（真因 + 再発防止策）
- `docs/incident-pattern-log.md` に蓄積（類似パターン検出能力向上）

a-audit 起動不能時:
- main が `docs/incident-pending-audit-YYYYMMDD.md` に即記録
- a-audit 次回起動時に未処理事故全件 critique

### 4-4 緊急 bypass フロー（main 単独編集 + a-audit 報告義務）

| ケース | main 単独 OK? | 編集後動作 |
|---|---|---|
| typo / 表現微調整 | ✅ | a-audit に即時報告 |
| フォーマット調整 | ✅ | a-audit に即時報告 |
| 緊急編集（数秒で必要）| ✅ | a-audit に即時報告 + 後追い critique |
| 軽微 memory 新設 | 🟡 main 判断 | a-audit に即時報告（main 単独選択時）|
| 中規模改訂 | 🟡 main 判断 | 同上 |
| 重要 memory 新設・本質改訂 | ❌ | a-analysis → a-audit → main 必須 |
| ガバナンス変更 | ❌ | 同上 |

a-audit 受領後の判断:
- 「軽微 OK、流す」: 1 行確認返答
- 「critique 必要」: 詳細 critique → main 再修正
- 「重大、エスカレーション」: 東海林さん即報告

a-audit 起動不能時:
- main が `docs/memory-pending-audit-YYYYMMDD.md` に記録
- a-audit 次回起動時に全件 critique

### 4-5 「Claudeへの指示」「手順」管理フロー

a-analysis 役割:
- memory 改訂時、「Claudeへの指示」「手順」追加・修正案も**併せて起草**
- 既存 snapshot との差分抽出 → 完全版 v(N+1) ドラフト

a-audit 役割:
- claude.ai 既存「Claudeへの指示」「手順」と新 memory の整合性 critique
- 三点セット同期の漏れ検出（CC memory 更新したのに claude.ai 側未更新等）
- 月 1 定期監査: snapshot と最新 memory の整合性

main 役割（変更なし、既存三点セット同期 v2 準拠）:
- 完全版 v(N+1) .md ファイル発行
- 東海林さん貼付指示
- snapshot ファイル上書き

### 4-6 不採択ログ永続化（メタルール）

a-audit critique を main が「不採択」とした場合:
- ファイル: `docs/audit-critique-rejected-log.md`
- 内容: a-audit critique 内容 + main 不採択理由 + 東海林さん最終 GO 記録
- 目的: 後で振り返り可能、main の判断品質を東海林さんが監査可

---

## §5 防御層位置（7 層構造）

| 層 | 名称 | 必達度 | 役割 |
|---|---|---|---|
| **層 0** | 最低限ルール 8 項目 | 🔴 絶対 | 基礎、毎応答前必達（日付 / ファイル存在 / 状態明示 / 既存実装 / N ラウンド / sentinel / コピペ形式 / system reminder 全体）|
| **層 1** | sentinel + N ラウンド統合 | 🔴 絶対 | 応答前装置 |
| **層 4** | §0 ロック | 🔴 絶対 | 起動時装置 |
| 補助 3 | 完了報告 + 東海林さんチェック | 🟡 | 補助 |
| 補助 5 | 東海林さん定期チェック | 🟡 | 外部観測（人間ゲート）|
| **補助 6a** | a-analysis | 🟡 | 別セッション解析視点 |
| **補助 6b** | a-audit | 🟡 | 別セッション監査視点 |

呼称: 「**3 層基本 + 4 層補助**」or 「**6+1 重防御**」

### 5-1 補助 5（東海林さん）と補助 6b（a-audit）の関係

| 装置 | 担当 | 役割 |
|---|---|---|
| 補助 5 | 東海林さん | 外部観測（人間ゲート、任意発動）|
| 補助 6b | a-audit | 内部監査（Claude セッション間、main / a-analysis を critique）|

連携:
- a-audit が **東海林さん定期チェックテンプレ起草支援**（東海林さん作業負荷軽減）
- 東海林さんが定期チェックで違反検出 → a-audit に詳細調査依頼可能
- 独立装置だが、6b が 5 を支援する関係（**人間 + Claude 二重監視**）

---

## §6 handoff 組込

### 6-1 a-memory 共通 handoff テンプレ

ファイル: `docs/a-memory-handoff-template.md`（020 期で起草）

| セクション | 共通 / 個別 |
|---|---|
| §1 引越し理由 | 共通 |
| §2 git 実態 | 共通 |
| §3 dispatch counter | 共通（a-analysis: analysis-001- 系 / a-audit: audit-001- 系）|
| §4 直近 dispatch | 共通 |
| §5 進行中タスク | 共通 |
| §6 注意点 | 共通 |
| §7 セッション内違反集計 | 共通 |
| **§8** | **個別**（a-analysis: memory 棚卸し進捗 / 提案中 memory 案 / a-audit: 事故パターン log / 進行中 critique）|
| **§9** | **個別**（main / 6a / 6b 認識ズレ log）|
| §10 RTK 報告 | 共通 |
| §11 起動後アクション | 共通 |

### 6-2 main handoff への組込

| handoff セクション | 組込内容 |
|---|---|
| §0-1 必読 docs # 9（新設）| 「a-memory 役割分割設計書 v1」（**本設計書**）|
| §A 重要決定 | 「a-analysis / a-audit 役割分割（6a / 6b）」を最重要決定として記載 |
| §B 違反 + 再発防止策 | 「a-audit 事故パターン蓄積機能」「main 単独編集 a-audit 報告義務化」追記 |

### 6-3 6a / 6b 衝突回避ルール

| ルール | 内容 |
|---|---|
| 1 | 6a と 6b は**直接通信禁止**、必ず main 経由 |
| 2 | main は同時に 6a / 6b 両方に**同じ依頼を送らない**（順序フロー: main → 6a → 6b → main）|
| 3 | 6a / 6b 同時起動 OK、ただし**各々独立 dispatch loop** |
| 4 | 違反検出フロー = 6b 単独（6a 経由なし）、衝突なし |
| 5 | 緊急 bypass = main 単独編集後 6a or 6b いずれか報告（両方ではない）|

---

## §7 メタ抜け対処

### 7-1 自己参照禁止（メタ 1）

| 状況 | judge |
|---|---|
| a-analysis 自身の運用変更 | 東海林さん + main（人間ゲート）|
| a-audit 自身の事故 log フォーマット変更 | 同上 |
| 6a/6b 権限階層変更 | 同上 |

a-analysis / a-audit は自分自身の運用変更を自己提案不可。

### 7-2 main 不採択時のログ永続化（メタ 2）

ファイル: `docs/audit-critique-rejected-log.md`

| 記録項目 |
|---|
| 日時 |
| a-audit critique 内容 |
| main 不採択理由 |
| 東海林さん最終 GO 記録 |
| 後の振り返り結果（事後修正があれば追記）|

---

## §8 020 期実装手順

### 8-1 020 起動時

1. 020 worktree 作成（018 / 019 にタスク振る、017 は議論集中）
2. 020 起動 → handoff §0-1 # 9 で本設計書を Read
3. 8 項目チェックリスト完了 → 東海林さん最終 GO 受領
4. 020 稼働 GO

### 8-2 a-analysis-001 / a-audit-001 構築

1. 020 が「a-analysis-001 worktree 作成依頼」を 018 or 019 に dispatch
2. 同様に a-audit-001 worktree 作成依頼
3. 各々起動 → 初期化（memory 全件 Read + キャッシュ作成、30-60 分）
4. 020 が test dispatch（軽微 memory 改訂依頼）→ 標準フロー実施 → 動作確認
5. 020 が稼働 GO（a-memory 6a/6b 連携 OK）

### 8-3 共通テンプレ起草

1. 020 が `docs/a-memory-handoff-template.md` 起草
2. a-analysis-001 / a-audit-001 各々が初回 handoff で本テンプレを Read
3. 個別差分（§8 / §9）を各セッションで運用

### 8-4 既存 memory 群との統合

- 既存 memory 50+ 件: a-analysis-001 が初回起動時に全件 Read + キャッシュ
- snapshot ファイル（`claudeai-instructions-snapshot-*` / `claudeai-procedures-snapshot-*`）: a-audit-001 が初回起動時に Read + 整合性 check

---

## §9 参考リンク（既存 docs / memory）

### 既存 memory（連携対象）

- `feedback_three_way_sync_cc_claudeai_procedure` v2 — 三点セット同期、§4-5 と統合
- `feedback_session_handoff_checklist` — handoff チェックリスト、§6 と統合
- `feedback_strict_recheck_iteration` v2 — 厳しい目 N ラウンド、§5 層 1 で参照
- `feedback_self_memory_audit_in_session` v2 — sentinel 5 項目、§5 層 1 で参照
- `feedback_gangan_pause_state_management` v2 — 状態明示、§5 層 0 で参照
- `feedback_my_weak_areas` — 不得意分野自覚、§3-1 worktree 作成別セッション依頼の根拠

### 既存 docs（参照）

- `docs/governance-rules-v1-20260509.md` — 16 § 構成、本設計書は §17 として追加候補
- `docs/handoff-checklist.md` — handoff フォーマット、§B 起動時必読 docs ロックと統合
- `docs/dispatch-template.md` — dispatch 形式 v5.1、a-memory dispatch も準拠

### 関連事故事例

- main- No. 182 D-06/D-08 既完走見落とし（5/9 21:30）= a-audit があれば検出可能だった
- main- No. 180 mock v1 縦積み誤指示（5/9 21:15）= a-audit が「外部依頼前確認」を critique 可
- 5/9 23:00 a-main-018 リセット症状 = a-audit が「最低限ルール skip」を即検出可

---

## §10 改訂サイクル

| トリガー | 動作 |
|---|---|
| 新規違反 / 抜け発見 | 020 期の運用中に発見 → 本設計書を v1.1 として改訂 |
| 月次レビュー | 020 が a-audit に「設計書 v(N) 妥当性」を依頼 → critique 受領 → 必要なら改訂 |
| 020→021 引越し時 | 本設計書の運用実績を §10 改訂履歴に追記 |

---

## §11 改訂履歴

- 2026-05-09 23:30 v1 初版（a-main-017 + 東海林さん議論成果、5 グループ G1-G5 + 追加 2 件 + メタ抜け 2 件 + 020 期実装手順、慎重モードで起草）

---

## §12 020 起動時の確認事項（東海林さんへ）

| # | 確認 |
|---|---|
| 1 | 本設計書を 020 が §0-1 # 9 で Read 済 |
| 2 | a-analysis-001 / a-audit-001 worktree 作成完了 |
| 3 | 各々初期化完了（キャッシュ作成）|
| 4 | test dispatch で標準フロー動作確認 |
| 5 | 東海林さん最終 GO で稼働開始 |

---

## 完成宣言

本設計書は a-main-017 期で確立した a-memory 役割分割の永続化 docs。017 セッション消滅後も 020 が本ファイルを Read で実装可能。

東海林さんの「全てがうまくいくようにする」「最低限すら守れないなら ほか守れない」「リスクヘッジ」の 3 視点を統合した最終形。

020 期での実戦投入、運用実績フィードバックを v1.1 で反映予定。
