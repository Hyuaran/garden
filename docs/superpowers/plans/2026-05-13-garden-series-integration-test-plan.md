# Garden Series 5/13 全モジュール統合テスト Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5/14-16 後道さんデモの前提として、5/13（火）08:00-19:00 の 1 日で Garden Series 全 12 モジュール統一認証ゲート + 各モジュール画面の Vercel 本番動作を全数確認し、リスクを潰し切る。

**Architecture:** a-main-013 が指揮セッションとして Chrome MCP で横断テスト（未認証→/login→role 別振分け→garden-home→各モジュール）を実行。各モジュールセッション（a-bloom / a-forest / a-tree / a-bud / a-leaf / a-root / a-soil / a-rill / a-sprout / a-calendar / a-fruit / a-seed）は 0.5d 以内で自モジュール画面の動作確認・修正対応を担当する。テスト環境は ローカル → Vercel preview → Vercel 本番（garden-chi-ochre.vercel.app） の 3 段階。失敗時は dispatch 即投下で修正、最終手段で 5/14-16 デモ延期判断。

**Tech Stack:** Next.js 16 (App Router) / React 19 / Supabase JS v2.103 / Vercel / Chrome MCP / TypeScript 5。テストは手動ブラウザ確認 + `npm run build` 型チェック + `vitest`（既存テストの run のみ、新規テストは書かない）。

**Branch:** `main`（5/12 EOD 時点で develop → main マージ済み前提）

**Spec:** 本ドキュメント自身

**Demo URL:** `https://garden-chi-ochre.vercel.app`

**前提:**
- 5/8-5/12 で各モジュールが認証統一実装 + 前倒しタスクを完了している
- 5/12 23:59 までに各セッションが「5/13 統合テスト Ready」を a-main-013 に報告済み
- Supabase（garden-prod）のテストアカウント（CEO / admin / manager / staff 各 1 件）が登録済み
- Vercel 本番（main ブランチ）に最新コードがデプロイ済み

---

## Test Environments

| 環境 | URL / Path | 用途 | 担当 |
|---|---|---|---|
| **L1: ローカル** | `http://localhost:3000` | 各モジュールが自セッション内で先行確認 | 各モジュールセッション |
| **L2: Vercel preview** | `https://garden-<branch>-<hash>.vercel.app` | 5/13 朝の develop → main PR 確認用 | a-main-013 |
| **L3: Vercel 本番** | `https://garden-chi-ochre.vercel.app` | デモ用最終確認 | a-main-013 |

---

## Test Accounts

Supabase（garden-prod）に登録済みの想定。実 ID は実行時に Supabase Dashboard で確認する。

| ロール | 社員番号（例） | 期待振分け先 | 用途 |
|---|---|---|---|
| **CEO** | `0001` | `/`（garden-home） | 全モジュール閲覧 |
| **admin** | `0002` | `/`（garden-home） | 全モジュール閲覧・編集 |
| **manager** | `0010` | `/root` | 組織・マスタ管理 |
| **staff** | `0100` | `/tree` | 架電業務 |
| **未登録** | `9999` | `/login` でエラー表示 | 異常系 |

---

## 役割分担

| セッション | 5/13 担当 | 工数目安 |
|---|---|---|
| **a-main-013（指揮）** | 横断シナリオ（未認証→/login→振分け→garden-home→12 モジュール巡回）を Chrome MCP で実行。`test-results.md` を集約。dispatch 投下判断。 | 1.0d |
| **a-bloom** | `/` (garden-home) + `/bloom/*` の自画面確認 | 0.3d |
| **a-forest** | `/forest/*` の自画面確認 | 0.3d |
| **a-tree** | `/tree/*` の自画面確認 | 0.3d |
| **a-bud** | `/bud/*` の自画面確認 | 0.3d |
| **a-leaf** | `/leaf/*` の自画面確認 | 0.3d |
| **a-root** | `/root/*` の自画面確認 | 0.3d |
| **a-soil** | `/soil/*` の自画面確認 | 0.3d |
| **a-rill** | `/rill/*` の自画面確認 | 0.3d |
| **a-sprout** | `/sprout/*` の自画面確認 | 0.3d |
| **a-calendar** | `/calendar/*` の自画面確認 | 0.3d |
| **a-fruit** | `/fruit/*` の自画面確認（概念のみの場合スキップ可） | 0.1d |
| **a-seed** | `/seed/*` の自画面確認 | 0.3d |

---

## Success Criteria（成功基準）

統合テスト全体は以下を全て満たした時点で **PASS**。

1. **HTTP**: 全対象 URL（後述 12 モジュール × 主要画面）が **200 OK** で応答
2. **認証フロー**: 後述シナリオ S1〜S6 が全て期待通り動作
3. **画面表示**: 表示崩れ（ヘッダー欠落・空 div・無限スピナー・hydration error）なし
4. **Console**: ブラウザ Console に **error / uncaught exception なし**（warning は許容）
5. **役割振分け**: role 別の自動振分けが期待通り（CEO/admin → `/`、manager → `/root`、staff → `/tree`）

**Fail 時の手順**: §Failure Procedure 参照。

---

## Failure Procedure（失敗時の手順）

### F1: 単一画面の Console エラー / 表示崩れ
1. a-main-013 が `console-errors.md` に該当画面・URL・スタックトレースを記録
2. 該当モジュールセッションへ **dispatch 即投下**
3. 該当セッションが 60 分以内に修正・PR・main マージ・Vercel 反映
4. a-main-013 が再テスト → PASS なら結果更新

### F2: 認証ゲート / 役割振分けの動作不良
1. a-main-013 が **a-root（認証統一実装の元担当）** へ最優先 dispatch
2. 影響範囲が複数モジュールに及ぶ場合、関連全セッションへ横断 broadcast
3. **17:00 までに復旧見込みが立たない場合 → §F4 デモ延期判断**へ

### F3: Vercel 本番デプロイ失敗 / 環境変数欠落
1. a-main-013 が Vercel ダッシュボードで Build Log / Env を確認
2. ローカル `npm run build` で再現確認
3. 修正は `feature/hotfix-20260513` ブランチで develop → main → Vercel 反映
4. **18:00 までに復旧見込みが立たない場合 → §F4**

### F4: 5/14-16 デモ延期判断（最終手段）
- **判定者**: 東海林（a-main-013 経由）
- **判定タイミング**: 5/13 18:00 / 19:00 の 2 回
- **判定基準**:
  - 18:00 時点で Success Criteria の 1 つでも満たせていない場合は要相談
  - 19:00 時点で未復旧 → 延期確定（5/19 週へ繰下げ提案）

---

## Test Scenarios（横断シナリオ S1〜S6）

### S1: 未認証 → /login リダイレクト
- 全モジュールパスへ未認証アクセスすると `/login` にリダイレクトされること

### S2: CEO ログイン → / (garden-home) 表示
- 社員番号 `0001` + パスワードでログイン → `/` に着地 → 12 モジュール入口が並ぶ

### S3: admin ログイン → / 表示
- S2 と同じ振分け（CEO と同等扱い）

### S4: manager ログイン → /root 振分け
- 社員番号 `0010` + パスワードでログイン → `/root` に直接着地

### S5: staff ログイン → /tree 振分け
- 社員番号 `0100` + パスワードでログイン → `/tree` に直接着地

### S6: garden-home から 12 モジュール入口クリック
- CEO セッションで `/` から各モジュール入口を順番にクリック → 全モジュールへ正常遷移

### S7（異常系）: 未登録 / 不正パスワード
- 社員番号 `9999` でログイン試行 → エラー表示、`/` には遷移しない
- `0001` + 不正パスワード → 同上

---

## File Structure

### 新規ファイル (3)

| パス | 役割 |
|---|---|
| `docs/integration-test-20260513/test-results.md` | 全シナリオの PASS/FAIL を集約（チェックリスト + 所見） |
| `docs/integration-test-20260513/console-errors.md` | 各画面で観測した Console エラーの全文ログ |
| `docs/integration-test-20260513/screenshots/` | 各画面のスクショ保存ディレクトリ（PNG） |

### 触らないファイル

- `src/**/*` 一切編集しない（テスト実行 Plan のため）
- 修正が必要になった場合は **a-main-013 から該当モジュールセッションへ dispatch を投下**し、別セッションで対応させる

---

## Dispatch Template（修正依頼用）

a-main-013 から各セッションへの修正 dispatch は以下フォーマット。

```
【横断セッション(a-main-013)からの共有】統合テスト失敗 (5/13 HH:MM)

■ 対象URL: <フル URL>
■ 環境: L3 Vercel 本番 / L2 preview / L1 local
■ 症状: <具体的症状 + 期待動作>
■ Console エラー: <スタックトレース貼付>
■ スクショ: docs/integration-test-20260513/screenshots/<file>.png
■ 期限: 60 分以内に PR 提出 + main マージ + Vercel 反映
■ 完了報告: a-main-013 へ「修正完了 + Vercel デプロイ確認済」で返信
```

---

## Tasks 概要（5/13 タイムテーブル）

### Task 0: 5/13 朝 08:00 ベースライン確認（30 分）
- a-main-013 worktree 確認
- `docs/integration-test-20260513/` ディレクトリ作成
- `test-results.md` + `console-errors.md` 雛形生成
- コミット

### Task 1: 全モジュールセッション broadcast（30 分）
- 各セッション 5/12 EOD「Ready」報告確認
- 5/13 08:30 開始 broadcast 投下

### Task 2: L1 ローカル スモークテスト（30 分）
- npm run dev 起動
- /login 表示確認
- Console エラー確認
- L1 はスモークのみ（詳細は L3 で）

### Task 3: L2 Vercel preview スモークテスト（30 分）
- preview URL 取得
- /login + CEO ログイン → / 着地確認
- Console エラー確認

### Task 4: L3 シナリオ S1（未認証 → /login）（30 分）
- Chrome シークレット + クッキー削除
- 全 12 モジュールパス未認証アクセス → /login リダイレクト確認
- スクショ保存

### Task 5: L3 シナリオ S2-S5（role 別振分け）（90 分）
- CEO（0001）→ /
- admin（0002）→ /
- manager（0010）→ /root
- staff（0100）→ /tree
- 各スクショ + 結果記録

### Task 6: L3 シナリオ S6（12 モジュール巡回）（120 分）
- CEO セッションで / から 12 モジュール入口クリック
- 各モジュール主要画面遷移確認
- Console エラー確認 + スクショ
- モジュール別画面確認結果集約

### Task 7: 異常系シナリオ S7（30 分）
- 未登録 9999 ログイン
- 不正 password ログイン
- エラー表示確認

### Task 8: 各モジュールセッション報告取りまとめ（60 分）
- 各セッション報告集約
- 二重チェック（a-main-013 確認 vs セッション報告）
- 不一致あれば再テスト

### Task 9: 失敗対応（予備 120 分）
- FAIL 案件あれば §F1-F3 に従って dispatch 投下
- 修正後再テスト
- 再テスト結果追記

### Task 10: 最終総括 + Go/No-Go 判定（60 分）
- サマリ集計
- 東海林さん（ユーザー）へ Go/No-Go 推奨提示
- 全モジュールセッション最終結果 broadcast
- 最終コミット + push

---

## 5/13 Timetable

| 時間 | タスク |
|---|---|
| 08:00-08:30 | Task 0 ベースライン |
| 08:30-09:00 | Task 1 broadcast |
| 09:00-09:30 | Task 2 L1 スモーク |
| 09:30-10:00 | Task 3 L2 スモーク |
| 10:00-10:30 | Task 4 S1 |
| 10:30-12:00 | Task 5 S2-S5 |
| 13:00-15:00 | Task 6 S6（12 モジュール巡回） |
| 15:00-15:30 | Task 7 S7 異常系 |
| 15:30-16:30 | Task 8 報告取りまとめ |
| 16:30-18:30 | Task 9 失敗対応（予備） |
| 18:30-19:00 | Task 10 最終総括 + Go/No-Go |

合計 約 9 時間 + 予備 2 時間 = 11 時間（08:00-19:00）

---

## Self-Review チェックリスト（Plan 自体の品質）

- [x] 5/13 一日（08:00-19:00 = 11 時間）で完走可能な分量か → Task 0〜10 で約 9 時間 + 予備 2 時間
- [x] 各モジュール作業は 0.5d 以内か → 役割分担表で各 0.3d 設定
- [x] 統合テスト全体は 1.0d 以内か → 1.0d
- [x] テスト環境 L1/L2/L3 が明示されているか → §Test Environments
- [x] 認証ゲート + role 別振分け + garden-home + 12 モジュール巡回がカバーされているか → S1-S7
- [x] 体制（a-main-013 指揮 / 各モジュールセッション / Chrome MCP）明示されているか → §役割分担
- [x] 成功基準が定量的か → §Success Criteria
- [x] 失敗時手順 + デモ延期判断が明示されているか → §Failure Procedure
- [x] 各 Task に概要 + 工数が含まれているか
- [x] Placeholder（TBD / 適宜）が無いか

---

## 改訂履歴

- 2026-05-07 初版（a-main-013 起草、Plan agent 補助）
