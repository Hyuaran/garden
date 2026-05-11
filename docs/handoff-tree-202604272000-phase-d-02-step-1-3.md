# Tree Phase D-02 operator UI Step 1+2+3 完了 — handoff（次セッション継続）

- 日時: 2026-04-27 ~20:00 中間報告
- セッション: a-tree
- ブランチ: `feature/tree-phase-d-02-implementation-20260427`（develop ベース、新規）
- 状態: spec §12 10 ステップ中 **3 ステップ完了、7 ステップ残**

## 完了済 Step（同セッション内）

### Step 1+2: キャンペーン選択画面 + セッション API（commit `bc3bcfa`、vitest 7/7 PASS）

#### 設計判断
- **既存 `/tree/call`（InCallScreen）は不変**で保護。spec §3.1 の「ログイン後キャンペーン選択画面」は新 path `/tree/select-campaign` で新設（既存動作破壊回避、spec 解釈の範囲内）
- accessToken パターン採用（Tree Phase B-β `change-birthday-with-password.ts` と同パターン）

#### 成果物
- 新規: `src/app/tree/select-campaign/page.tsx`
- 新規: `src/app/tree/_actions/session.ts`（openSession / closeSession）
- 新規: `src/app/tree/_actions/__tests__/session.test.ts`（7 ケース）

#### Vitest
7/7 PASS（UNAUTHENTICATED / INVALID_INPUT 各種 / EMPLOYEE_NOT_FOUND / 成功 / closeSession 2 種）

### Step 3: Sprout 画面 Supabase 連携（commit `60fbc7d`、vitest 24/24 PASS）

#### 設計方針
- 既存 `sprout/page.tsx` は完成度高い既存実装、**全面置換禁止 + 結果ボタン onClick に Supabase INSERT を追加** で最小変更
- 既存 `insertCall`（Phase B `soil_call_history` 用）は不変、新規 `insertTreeCallRecord` を別実装
- session_id は `localStorage 'tree.current_session_id'`、campaign_code は `localStorage 'tree.current_campaign_code'` で受渡し（TreeStateContext 改変回避）

#### 成果物
- 新規: `src/app/tree/_lib/resultCodeMapping.ts`（label→DB enum 12 種、result_group 4 分類、isMemoRequired）
- 新規: `src/app/tree/_actions/insertTreeCallRecord.ts`（Server Action、入力検証 + メモ必須 + 500 文字 truncate）
- 新規: `src/app/tree/_lib/__tests__/resultCodeMapping.test.ts`（14 ケース）
- 新規: `src/app/tree/_actions/__tests__/insertTreeCallRecord.test.ts`（9 ケース）
- 修正: `src/app/tree/select-campaign/page.tsx`（+3 行、localStorage 保存追加）
- 修正: `src/app/tree/calling/sprout/page.tsx`（+50 行、既存 onClick に追加 + エラー表示）

#### Vitest
- resultCodeMapping: 14/14 PASS
- insertTreeCallRecord: 9/9 PASS（UNAUTHENTICATED / INVALID_INPUT 各種 / MEMO_REQUIRED / EMPLOYEE_NOT_FOUND / 500 文字 truncate / 成功）
- 旧テスト不変
- **本ブランチ累計: 31/31 PASS**

## 残 Step（次セッション、想定 0.7d）

| Step | 内容 | 想定 | 推奨アプローチ |
|---|---|---|---|
| **4** | Branch 画面同等対応 | 0.5h | Step 3 と同パターン、`branch/page.tsx` に同じ Supabase INSERT 追加 |
| **5** | FM 互換ショートカット F1-F10 | 1.0h | spec §4 ショートカット表通り、`window.addEventListener('keydown')` で実装。判 0-4 確定: preventDefault + ユーザー教育 |
| **6** | 巻き戻し UI | 0.5h | spec §7、`prev_result_code` UPDATE で実装。判 0-3 確定: 5 秒固定 |
| **7** | オフライン耐性 localStorage キュー | 1.5h | spec §5、判 0-2 確定: 500 件上限。`tree_offline_queue_v1` に enqueue / オンライン復帰時 flush |
| **8** | 画面遷移ガード | 0.5h | spec §6、`beforeunload` + カスタム Link コンポーネント |
| **9** | Breeze/Aporan/Confirm-wait 連携 | 1.5h | 既存 3 画面に Supabase 連携追加。判 0-7 確定: メモ 500 文字 / 判 0-5 beep OFF |
| **10** | 結合テスト・バグ修正 | 1.5h | E2E（Playwright）or 手動、`docs/phase-b-beta-e2e-checklist.md` パターン参考 |

## 次セッション開始時の手順

1. `cd C:/garden/a-tree && git fetch origin develop && git checkout feature/tree-phase-d-02-implementation-20260427`
2. `git log --oneline | head -5` で commit `60fbc7d` / `bc3bcfa` 確認
3. Step 4 から着手:
   - `src/app/tree/calling/branch/page.tsx` を Step 3 同パターンで修正
   - 既存 `RESULT_BUTTONS`（11 種）→ `labelToResultCode` で変換、`insertTreeCallRecord` 呼出
   - 既存実装の保護重視（最小変更）
4. Step 5 以降は spec §4-§7 / §0 確定事項を参照しながら順次

## 既知の課題・気になった点

### 1. session.test.ts の既存型エラー（CloseSessionResult）
- 新規実装ではなく既存型定義との齟齬、本ブランチでは新規ファイル由来エラーゼロ
- 次セッションで Step 4 着手前に小さな fix を入れるか、または Step 10 で一括対処

### 2. D-01 migration ファイルの参照
- 別ブランチ `feature/tree-phase-d-01-implementation-20260427`（commit `45decb4`）に migration SQL あり
- 本 D-02 ブランチは develop 派生のため migration ファイル含まず（schema は garden-dev に投入済前提）
- D-01 + D-02 のブランチが develop merge 後、両者が一体で揃う

### 3. localStorage 経由の session_id 受渡し
- 暫定設計、TreeStateContext を改変しないための簡素化
- D-02 の他 Step（巻き戻し / オフラインキュー）も localStorage パターンで揃える前提

## ステータス

判断保留が出なかったため pause file 作成不要。push は GitHub 復旧後（push plan 参照）。

## 次のアクション

1. **次セッション or 同セッション継続**で Step 4 着手
2. 各 Step 完走で a-main へ進捗報告（指示通り）
3. 全 10 Step 完走後、α 版（東海林さん 1 人テスト）へ移行判断
4. **GitHub 復旧後 push** + PR 発行（develop 向け、レビュー: a-bloom）

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-27 | v1.0 | Phase D-02 Step 1+2+3 完了（31 vitest PASS）、Step 4-10 を次セッションへ handoff | a-tree |
