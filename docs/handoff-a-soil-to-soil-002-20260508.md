# Handoff - 2026-05-08 (a-soil → a-soil-002)

引継ぎ先: **a-soil-002**（C:\garden\a-soil-002 で起動予定）
発信日時: 2026-05-08(金) 16:00 想定（Vercel push 停止中、ローカル commit のみ）
引き継ぎ理由: §22-1 + §22-8 自発 token check で 60-65% 帯到達、引っ越し準備実行

---

## 今やっていること

5/8 1 日でガンガンモード 11 commit / 5,500+ insertions / 84 tests / 2 spec を完走。
直近で a-main-015 main- No. 144 受領、A 案 GO（handoff 整備 + 引っ越し）に従い本書作成中。

### 直近の成果（5/8）

- **Phase B-01 7/7 = 100% 完成**（Kintone API 30 万件取込パイプライン、feature/soil-batch16-impl）
  - migrations 7 本（apply 未実施、東海林さん別途承認後）
  - TypeScript 8 ファイル（types / helpers / import-transform / kintone-client / import-load / importer / actions / page UI）
  - Vitest 84 ケース全 PASS
  - admin 進捗 UI 完成（/soil/admin/imports、preview 検証済）
- **Batch 20 = B-01 Phase 2 + Phase 3 spec 完成**（feature/soil-batch20-spec）
  - Phase 2: FileMaker CSV 200 万件（574 行、1.0d → 25 分実績、24x）
  - Phase 3: 旧 CSV 商材別 20 万件（459 行、0.5d → 18 分実績、40x）
  - 合計 1,033 行、1.5d → 43 分実績（31x）
- **Soil B-01 全 Phase spec 揃 🏆**（Phase 1 実装完成 + Phase 2 / Phase 3 spec 完成）

---

## 次にやるべきこと（a-soil-002 起動後の優先順）

### 🔴 最優先 1: Vercel push 停止解除確認 + 残作業 push

- main- No. 148 broadcast = 5/9 09:00 JST 過ぎ解除予定
- 解除確認後に以下を push:
  - `feature/soil-batch16-impl` の最終状態（既 push 済、追加 commit なければ pull のみ）
  - `feature/soil-batch20-spec` の Phase 2 + Phase 3 spec（既 push 済）
  - 本 handoff 含む dispatch-counter / handoff-doc commit（本セッション中はローカルのみ）

### 🔴 最優先 2: Phase 2 / Phase 3 実装着手判断（東海林さん指示後）

東海林さんから「Phase 2 着手」指示あれば即実装。
実装内容は `docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md` §12 実装タスク参照（合計 1.8d 見積）:
1. scripts/soil-import-csv-phase2.ts
2. src/lib/db/soil-import-csv-source.ts + TDD
3. src/lib/db/soil-merge-detector.ts + TDD（R1/R2 検出）
4. INDEX OFF/ON migration
5. /soil/admin/imports の Phase 2 開始 UI 拡張
6. runbook（docs/runbooks/filemaker-export-runbook.md）整備
7. α 版テスト

Phase 3 実装は同じく `docs/specs/2026-05-08-soil-phase-b-01-phase-3-old-csv-by-business.md` §12 参照。

### 🟡 中優先 3: PR #127 review 状況確認

- PR #127 = Batch 19 Phase B 7 spec の develop 取込
- Vercel 復帰後 a-bloom or 適切なレビュアーから review コメント着く可能性
- review 着次第対応、なければ放置で develop merge（横断調整 main- No. 148 後の流れに従う）

### 🟡 中優先 4: B-01 全 Phase spec の cross-check

実装着手前に Phase 1 / Phase 2 / Phase 3 の整合性を最終確認:
- Adapter Pattern が 3 Phase で一貫しているか
- staging テーブル運用が共通化できているか
- Merge proposal 戦略が R1/R2/R3 で衝突しないか

### 🟢 低優先 5: effort-tracking 更新

- `docs/effort-tracking.md` に 5/8 1 日の実績を反映
- Batch 20 Phase 2 / Phase 3 行追加（spec 完了、実装は未）
- Phase B-01 第 1〜4 弾の実績集約

---

## 注意点・詰まっている点

### Vercel push 停止中（main- No. 148）

- **5/9 09:00 JST 過ぎまで GitHub push 禁止**
- ローカル commit OK、push は翌朝
- 本 handoff も同条件（commit のみ、push は翌朝）

### handle_pd_number_change の leaf_kanden_cases INSERT 列

- migration 20260507000006 で関数化済、apply 未実施
- INSERT は最小 3 列（soil_list_id / case_type / pd_number）のみ
- a-leaf に実 schema 確認後、p_new_kanden_data から動的展開する形に拡張要

### root_audit_log の列名差異

- migration 20260507000006 の関数内で動的判定 + EXCEPTION 吸収済
- a-root が正式列確定したら関数更新（EXECUTE format 部分）

### admin imports UI の SoilGate / SoilShell 未整備

- 既存 Bud / Tree のような Gate / Shell コンポーネントは Soil 用未作成
- 現在は DB RLS で gate（admin / super_admin のみ soil_list_imports SELECT 可）
- 次セッション以降で SoilGate / SoilShell 整備推奨（他モジュールパターンに合わせる）

### SSE 未実装

- /soil/admin/imports の live 更新は 5 秒間隔ポーリングで暫定実装
- spec §4.2 のライブログ要件は次セッション以降で SSE 化

---

## 関連情報

### ブランチ

| ブランチ | 状態 | 内容 |
|---|---|---|
| `feature/soil-batch16-impl` | origin push 済 | Batch 16 + B-01 Phase 1 実装（migrations 7 + TS 8 + tests 84）|
| `feature/soil-batch20-spec` | origin push 済 | Batch 20 = B-01 Phase 2 / Phase 3 spec（1,033 行）|
| `feature/soil-phase-b-decisions-applied-v2` | origin push 済 | PR #127 OPEN（Batch 19 Phase B 7 spec）|
| `feature/soil-phase-b-decisions-applied` | origin push 済 | 旧名（PR 作成エラー回避で -v2 へ移行）|
| `feature/soil-phase-b-specs-batch19-auto` | origin push 済 | Batch 19 起草元（a-auto-002） |

### PR

| PR | 状態 | 内容 |
|---|---|---|
| #127 | OPEN | Batch 19 Phase B 7 spec → develop（review 待ち、Vercel deploy ready） |

### 関連ファイル（実装完成分）

#### Migration drafts（7 本、apply 未実施）

- `supabase/migrations/20260507000001_soil_lists.sql`（spec #01 + #07 + B-03 関電列）
- `supabase/migrations/20260507000002_soil_call_history.sql`（spec #02 月次パーティション）
- `supabase/migrations/20260507000003_soil_rls.sql`（spec #06 RLS + MV + helper 関数）
- `supabase/migrations/20260507000004_leaf_kanden_soil_link.sql`（spec #03 leaf 列追加）
- `supabase/migrations/20260507000005_soil_indexes.sql`（spec #05 性能 INDEX + pg_trgm）
- `supabase/migrations/20260507000006_soil_handle_pd_number_change.sql`（B-03 §6 DB 関数）
- `supabase/migrations/20260507000007_soil_imports_staging.sql`（B-01 §3.3 staging tables）

#### TypeScript（8 ファイル）

- `src/lib/db/soil-types.ts`（DB 行型定義 + isValidSupplyPoint22）
- `src/lib/db/soil-helpers.ts`（normalizePhone / normalizeKana / buildSoftDeletePayload）
- `src/lib/db/soil-import-transform.ts`（Kintone App 55 → SoilListInsert 変換）
- `src/lib/db/kintone-client.ts`（fetch ベース Kintone REST API クライアント）
- `src/lib/db/soil-import-load.ts`（normalized → soil_lists upsert）
- `src/lib/db/soil-importer.ts`（runSoilImport orchestrator）
- `src/lib/db/soil-import-actions.ts`（Server Actions: start/pause/resume/retry/cancel）
- `src/app/soil/admin/imports/page.tsx`（admin 進捗 UI）

#### Tests（84 ケース全 PASS）

- `src/lib/db/__tests__/soil-types.test.ts`（8 ケース）
- `src/lib/db/__tests__/soil-helpers.test.ts`（23 ケース）
- `src/lib/db/__tests__/soil-import-transform.test.ts`（15 ケース）
- `src/lib/db/__tests__/kintone-client.test.ts`（15 ケース）
- `src/lib/db/__tests__/soil-import-load.test.ts`（5 ケース）
- `src/lib/db/__tests__/soil-importer.test.ts`（10 ケース）
- `src/lib/db/__tests__/soil-import-actions.test.ts`（8 ケース）

#### Spec（Batch 20）

- `docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md`（574 行）
- `docs/specs/2026-05-08-soil-phase-b-01-phase-3-old-csv-by-business.md`（459 行）

### 関連 dispatch ログ（5/8 抜粋）

- main- No. 86 / No. 88 / No. 91 / No. 93 / No. 95 / No. 98（5/7-5/8 朝、Phase B-01 第 1〜4 弾 GO）
- main- No. 104（5/8 金曜朝、起動 + Phase B-01 第 2 弾 GO）
- main- No. 120（Phase B-01 第 2 弾完走 + 第 3 弾 GO）
- main- No. 125（Phase B-01 第 3 弾完走 + 第 4 弾 GO）
- main- No. 127（CLAUDE.md §20-23 broadcast）
- main- No. 129（Phase B-01 100% 完走評価 + Batch 17 spec 起草 GO）
- main- No. 134（Batch 17 → Batch 20 訂正、Phase 2 GO）
- main- No. 137（Phase 2 完走評価 + Phase 3 GO）
- main- No. 144（A 案 = handoff 整備 + 引っ越し承認）
- main- No. 148（🔴 Vercel push 停止 broadcast、5/9 09:00 JST 過ぎまで）

### a-soil 発信ログ（5/8 抜粋）

- soil-38（Batch 16 第 1 弾完走報告）
- soil-39（Batch 16 第 2 弾完走報告）
- soil-40（Batch 16 第 3 弾完走報告）
- soil-41（Phase B-01 第 1 弾完走報告）
- soil-42（handoff 受領確認、5/7 セッション締め）
- soil-43（RTK 適用確認、65.3% 削減実測）
- soil-44（5/8 起動 + Phase B-01 第 2 弾完走報告）
- soil-45（Phase B-01 第 3 弾完走報告）
- soil-46（Phase B-01 7/7 = 100% 完走報告）
- soil-47（CLAUDE.md §20-23 受領確認）
- soil-48（Batch 17 名称重複問題エスカレーション）
- soil-49（Batch 20 Phase 2 spec 完走報告）
- soil-50（main- No. 134 重複受領の確認応答）
- soil-51（Batch 20 Phase 3 spec 完走報告）
- soil-52（main- No. 148 Vercel push 停止 受領確認）

### dispatch counter

- a-soil 最後の発信: soil-52（main- No. 148 受領確認）
- a-soil 最終発信予定: **soil-53**（本 handoff 完了報告）
- **a-soil-002 引継ぎ counter: 54**（次番号、本書 commit 後に更新）

> ※ main- No. 144 dispatch では「次 counter: 53（a-soil-002 で継承）」と記載されているが、a-soil 側で soil-52 受領確認後に counter 53 を消費（自発 chat 内で counter を進めた）。一貫性のため **a-soil-002 開始番号は 54** とする。a-main-015 側で齟齬あれば訂正可。

---

## a-soil-002 起動手順（東海林さん用）

東海林さんが別 PowerShell で:

```
cd C:\garden\a-soil-002
git fetch --all
git checkout feature/soil-batch20-spec   # Phase 2/3 spec branch（最新）
git pull
claude
```

起動後の最初の依頼:
> 「docs/handoff-a-soil-to-soil-002-20260508.md を読んで続きを進めて」

※ a-soil-002 worktree が未存在なら東海林さんが新設:

```
cd C:\garden\a-soil
git worktree add C:\garden\a-soil-002 feature/soil-batch20-spec
```

---

## 引っ越し後の最初のタスク（a-soil-002 で実施）

1. `pwd` で C:\garden\a-soil-002 確認
2. `git status` でブランチ確認（feature/soil-batch20-spec 推奨）
3. `git pull` で最新取得（5/9 09:00 過ぎ Vercel 復帰後の場合は origin から最新）
4. `docs/handoff-a-soil-to-soil-002-20260508.md` を再読
5. `docs/dispatch-counter.txt` = 54 確認
6. 1-2 行で要約返答 + 「続きの作業を準備完了」で待機

---

## §22 引っ越しチェックリスト

- [x] §22-7 RTK 削減集計 報告（前回 soil-43 で 65.3% 報告済、追加報告は a-main-015 判断）
- [x] handoff doc 起草完了
- [x] dispatch counter 引継ぎ番号確定（54）
- [x] 待機中ジョブ + 判断保留事項一覧化（本書「次にやるべきこと」§参照）
- [ ] commit 実施（次のステップ）
- [ ] push は 5/9 09:00 JST 過ぎ Vercel 解除後

— end of handoff —
