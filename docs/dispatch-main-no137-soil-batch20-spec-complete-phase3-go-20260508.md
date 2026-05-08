# dispatch main- No. 137 — a-soil（Batch 20 spec 完走評価 + A 案 Phase 3 spec 起草 GO）

> 起草: a-main-014
> 用途: a-soil soil-49 受領 + Batch 20 spec 24 倍速完成評価 + A 案連続着手 GO
> 番号: main- No. 137
> 起草時刻: 2026-05-08(金) 14:38

---

## 投下用短文（東海林さんが a-soil にコピペ）

~~~
🟢 main- No. 137
【a-main-014 から a-soil への dispatch（Batch 20 spec 完走評価 + A 案 Phase 3 spec 起草連続 GO）】
発信日時: 2026-05-08(金) 14:38

soil-49 受領、Batch 20 = B-01 Phase 2 FileMaker CSV spec 25 分完成（24 倍速、574 行）= 圧倒的偉業。
本日累計 9 commit / 5,074+ insertions / 84 tests + 1 spec / 工数換算 ~7.5d → 実績 ~8h。

詳細: [docs/dispatch-main-no137-soil-batch20-spec-complete-phase3-go-20260508.md](docs/dispatch-main-no137-soil-batch20-spec-complete-phase3-go-20260508.md)

## Batch 20 spec 評価（24 倍速）

- 1.0d 想定 → 25 分実績（24 倍速）
- 574 行、§1-§14 完備
- 既存 Phase 1 実装 95% 再利用設計（5 ファイル踏襲）
- §11 受入基準 9 項目 + §12 実装タスク 7 件（合計 1.8d）
- §13 判断保留 7 件 + §14 既知リスク 6 件
- 判断保留なし（spec 内で明確化）

## ガンガン自走判断 評価（5 件全採用）

| 項目 | 採用 |
|---|---|
| 1. chunkSize = 10,000（Phase 1 倍増、200 万件 trx granularity）| ✅ 妥当 |
| 2. Adapter パターン採用（既存 Transform 関数変更不要）| ✅ **優秀**（再利用性最大化）|
| 3. R1 自動 + R2 manual review 区分 | ✅ 妥当（confidence ベース設計）|
| 4. 取込時間帯 22:00-7:00 推奨（Tree 営業時間外）| ✅ 妥当 |
| 5. csv-parse npm install 判断保留 | ✅ 妥当（実装時に既存依存確認）|

## 判断: A 案 GO（Phase 3 spec 起草連続着手）

| 案 | 内容 | 採否 |
|---|---|---|
| **A** | **Phase 3 spec 起草（旧 CSV 商材別 20 万件、~0.5d）** | ✅ **採用** |
| B | 本セッション一旦締め、新セッションで Phase 3 起草 | ❌ |
| C | PR #127 review 待ち / 別タスク | ❌（review 未着）|
| D | その他指示待ち | ❌ |

理由:
- ガンガン常態モード = 連続着手の流れ整合
- Phase 2 spec 25 分 → Phase 3 spec も短時間完走可能性（推定 15-30 分、~0.5d 大幅短縮見込み）
- Batch 20 で Phase 2 + 3 完成 = Soil B-01 全 Phase spec 揃う、Phase B 第 2 段階準備完了

## Phase 3 spec 起草 内容（推定）

- 旧 CSV 商材別 20 万件取込（光回線 / クレカ等 30 商材）
- 商材別フォーマット差異対応
- Phase 2 設計の流用（chunkSize / Adapter / 重複処理）
- 商材別マッピング設定（business_id ベース）

## 自走判断 GO 範囲（A 案）

- Phase 3 spec 起草 連続着手 OK
- 既存 Batch 20 Phase 2 spec 構造踏襲
- §11 受入基準 + §12 実装タスク + §13 判断保留 + §14 既知リスク 構成
- 苦戦 / 設計判断必要 → 即 soil-N で a-main-014 経由
- ブランチ: `feature/soil-batch20-spec` 継続使用 OK（Phase 2 + 3 同 PR 想定）

## Soil 全体進捗（A 案完走後の見通し）

| 項目 | 状態 |
|---|---|
| Batch 16 Soil 基盤 8/8 | ✅ PR #57 merge 済 |
| Batch 19 Soil Phase B 7 spec | ✅ PR #127 OPEN |
| B-01 Phase 1 実装 7/7 | ✅（feature/soil-batch16-impl）|
| Batch 20 Phase 2 spec | ✅（feature/soil-batch20-spec）|
| **Batch 20 Phase 3 spec** | **🟢 A 案で着手** |

→ A 案完走 → Soil B-01 全 Phase spec 揃う、Phase B 第 2 段階準備完了。

## 制約遵守（再掲、整合 OK）

- 動作変更なし（spec のみ追加、既存コード未編集）
- 新規 npm install なし（spec 内で判断保留として明記）
- Supabase 本番データ操作なし
- migration 追加なし（spec のみ）
- 設計判断・仕様変更なし
- main / develop 直 push なし

## CLAUDE.md §22-4 / §22-8 反映確認

最新の CLAUDE.md には §22-4 + §22-8 追加済。git fetch --all + 再読込推奨。

完走 / 区切り報告は soil-N（次番号 50）で。判断保留即上げ歓迎です。
~~~

---

## dispatch counter

- a-main-014: main- No. 137 → 次は **138**

## 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 134（Batch 17 → Batch 20 訂正 + A 案 GO）| ✅ → Batch 20 spec 完成 |
| **main- No. 137（本書、A 案 Phase 3 spec 起草 GO）** | 🟢 投下中 |
