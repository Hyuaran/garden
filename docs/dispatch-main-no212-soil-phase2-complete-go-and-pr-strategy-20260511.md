~~~
🟡 main- No. 212
【a-main-020 から a-soil-002 への dispatch】
発信日時: 2026-05-11(月) 09:55

# 件名
Phase B-01 Phase 2 完走承認 + 判 1-4 全件 GO + PR #127 (Phase 1) → develop 先行起票指示

# 1. soil-59 受領 + 評価

| 項目 | 結果 |
|---|---|
| Phase B-01 Phase 2 (FileMaker CSV 200 万件取込) | 7 / 7 完走 ✅ |
| 見積 1.8d → 実績 ~1.2h | **-90% 大幅短縮**（Phase 1 Adapter Pattern 再利用効果）|
| 新規 tests | 97 件追加、全 PASS |
| Soil db tests 全体 | 181 / 181 PASS |
| commits | 4 件 push 完了（7e64c2f / bbd7769 / 8b70511 / dc131dc） |

main 評価: 優秀な完走、Phase 1 設計の再利用性が証明された好例。

# 2. 判 1-4 全件 GO（東海林さん決裁済 2026-05-11 09:50 受領）

| 判 | 論点 | GO 内容 |
|---|---|---|
| 1 | PR 起票タイミング | **B 採用**（Phase 1 先行 → batch20-impl 後続）= 分離レビューで Phase 1 review コメント取込しやすい |
| 2 | migrations apply タイミング | **5/12 採用**（5/13 統合テスト前日、Supabase Dashboard SQL Editor、既存 7 + Phase 2 新規 1 = 計 8 本）|
| 3 | α テスト実施 | **両方採用**（5/12 sample 200 件 dev 環境 → 5/13 本番想定 1 ファイル 200 万件）|
| 4 | unrelated 14 test 失敗 | **scope 外、別セッション対応**（a-bloom-006 レビュー時 or a-root-002 で別 issue として処理）|

# 3. 即実行アクション

## 3-1. 最優先: PR #127 (Phase 1) → develop 先行起票

既存 PR #127 が OPEN 状態の場合:
- 状態確認（`gh pr view 127` または GitHub Web UI）
- a-bloom-006 への正式レビュー回し依頼 dispatch を main 経由で発行（main- No. 214 候補で別途）

未起票 or 起票失敗状態の場合:
- feature/soil-batch16-impl → develop の PR 起票
- 件名: feat(soil): Phase B-01 Phase 1 — FileMaker Soil 取込基盤 + Adapter Pattern + 84 tests
- 説明: Phase 1 spec §X-X 準拠 + 84 tests 全 PASS + Adapter Pattern 設計

## 3-2. Phase 2 PR は Phase 1 レビュー完了後

判 1 B 案準拠: PR #127 (Phase 1) review コメント取込 + merge 後、feature/soil-batch20-impl → develop の Phase 2 PR を別起票。

スケジュール想定:
- 5/11(月) 朝〜午前: PR #127 a-bloom-006 レビュー実施
- 5/11(月) 午後〜夕方: Phase 1 review コメント取込 + main merge
- 5/12(火): Phase 2 PR 起票 + migrations apply + sample α テスト
- 5/13(水): 統合テスト本番 200 万件投入

## 3-3. 5/12 migrations apply 準備

| # | ファイル | 順序 |
|---|---|---|
| 1-7 | 既存 migrations (Phase 1) | 5/12 先行（既存運用通り）|
| 8 | migrations/20260509000001_soil_phase2_index_helpers.sql | 5/12 Phase 2 用追加 |

apply 手順は runbook `docs/runbooks/filemaker-export-runbook.md` §X-X 参照。

## 3-4. 5/12 sample 200 件 α テスト

- script: scripts/soil-generate-sample-csv.ts（200 件合成 CSV、a-soil-002 実装済）
- 実行: dev 環境 supabase で取込実行、結果検証
- 検証項目: parse 結果 / Merge detector R1-R3 / INDEX OFF/ON / count 一致 / エラー件数 0

## 3-5. 5/13 本番想定 200 万件投入

- runbook §1-1 通り（22:00 以降推奨、列名厳守、CRLF / BOM 対応）
- 全体実行時間想定: INDEX OFF + 並列取込 + INDEX ON 再構築で約 X 時間（runbook §X 参照）

# 4. 完走報告 (soil-60)

冒頭 3 行（🟢 soil-60 / 元→宛先 / 発信日時）+ 全体を ~~~ でラップ + 以下構造で起草。報告内では ~~~ ネスト不使用、コードブロック不使用（v5.1 完全準拠）。

### 件名
PR #127 (Phase 1) 起票 / 確認結果 + a-bloom-006 レビュー回し準備完了

### PR #127 状態
- 起票状態: 既存 OPEN / 新規起票 / 起票失敗（理由明示）
- branch: feature/soil-batch16-impl → develop
- diff: +N / -N、commits NN 件
- 件名 + 説明: ...

### a-bloom-006 レビュー回し準備
- main 経由で main- No. 214 候補レビュー依頼予定
- a-bloom-006 が PR #148/#149 レビュー進行中のため、完走後の順次対応想定
- 想定タイムライン: 5/11(月) 朝〜午前 PR #127 レビュー → 午後 Phase 1 review 取込 → merge

### 5/12 準備状況
- migrations apply 手順確認: OK / 確認中
- sample α テスト script 確認: OK / 確認中
- runbook §1-1 列名厳守 / 22:00 以降推奨 等の手順内化: OK

### 緊急度
🟢 通常

### self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ
- [x] 自然会話形式禁止
- [x] PR 状態明示 + a-bloom-006 レビュー回し準備明示
- [x] 5/12 / 5/13 準備状況明示
- [x] 報告内に ~~~ ネスト不使用 + コードブロック不使用（v5.1 違反防止）

# 5. 緊急度

🟡（標準フロー、5/12 migrations apply + 5/13 本番投入に向けた前倒し進行）

# self-check（本 dispatch として）

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置（v5.1 完全準拠）
- [x] ~~~ ラップ
- [x] 中身は通常テキスト（バッククォート不使用）
- [x] ~~~ ネスト不使用（v5.1 準拠）
- [x] 判 1-4 全件 GO 明示
- [x] PR 起票 B 案（Phase 1 先行）明示
- [x] 5/12 / 5/13 スケジュール明示
- [x] 完走報告 (soil-60) 雛形提示（v5.1 完全準拠）
- [x] 番号 = main- No. 212（counter 継続）
~~~
