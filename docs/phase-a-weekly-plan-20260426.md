# Garden Phase A 週次実装計画 - 2026-04-26 - a-main 006

> Phase A 実装着手 master plan を **week-by-week + 担当セッション割当**まで詳細化。
> 東海林さんが「実装着手 GO」サイン出すだけで全セッションが動き出せる状態を目指す。

**期間**：2026-05-01 〜 2026-06-30（約 9 週間、5 月 + 6 月）
**前提**：GitHub 復旧 + 槙さん invite 受諾完了
**前提資料**：`phase-a-implementation-master-plan-20260426.md`

---

## 0. Phase A の最優先 Task（🚨 master plan に追加）

### Task #0：Garden 共通 UI 設計 + 実装（**全 Phase A の最優先**）

**現状問題**：
- `src/app/page.tsx` = Next.js デフォルト（Hello World）
- 共通ログイン画面なし
- 共通ホーム画面なし（モジュール選択不可）
- 全社員が「どこにアクセスすればいいか不明」

**設計方針**：
```
/ ← Garden ホーム（ロール別モジュール選択 + クイックアクセス）
/login ← Garden 共通ログイン（既存個別 login を統一）
/tree, /root, /bud, /bloom, /forest, /soil, /leaf, /sprout, /fruit, /calendar, /seed, /rill ← 各モジュール（既存維持）
各モジュール内 dashboard ← 既存維持
```

**Task 詳細**：
| Sub-task | 担当 | 見積 |
|---|---|---|
| 共通ログイン spec 起草 | a-root | 0.5d |
| 共通ホーム spec 起草（ロール別モジュール選択 UI）| a-root + a-bloom | 0.5d |
| 共通レイアウト component（ヘッダー / ナビ / フッタ）| a-bloom | 1.0d |
| 各モジュール個別 login → 共通 login へ統合 | 各モジュールセッション | 0.25d × 12 = 3d |
| ロール別ダッシュボード（toss / closer / cs / staff / outsource / manager / admin / super_admin）| a-bloom | 1.5d |

→ **計 6.5d**、5 月第 1 週で完走目標。

---

## 1. 月次マイルストーン（再掲、master plan 整合）

```
2026-04 末：
  ↓ GitHub 復旧 → 30+ ブランチ push + PR 発行 + merge
  ↓
2026-05-01 〜 05-07（第 1 週）：Garden 共通 UI 最優先
  ↓
2026-05-08 〜 05-31（第 2-4 週）：Forest v9 + Root B-1〜B-3 + Bud Phase 1b.2 完走
  ↓
2026-06-01 〜 06-15（第 5-7 週）：Root B-4〜B-7 + Bud Phase D 給与計算
  ↓
2026-06-16 〜 06-30（第 8-9 週）：Phase A 完走、α 運用安定 → Phase B 着手準備
```

---

## 2. 週次計画

### 第 1 週（2026-05-01 〜 05-07）：Garden 共通 UI 構築 🚨 最優先

| 担当セッション | Task | 完走条件 |
|---|---|---|
| a-root | 共通ログイン spec 起草 | spec 完成 + 既存個別 login の統合方針 |
| a-root + a-bloom | 共通ホーム spec 起草（ロール別モジュール選択）| spec 完成 + UI モックアップ |
| a-bloom | 共通レイアウト component（ヘッダー / サイドバー / フッタ）| `src/components/layouts/` に共通 component 配置 |
| a-bloom | ロール別ダッシュボード設計 + 実装着手 | 8 ロール分のホーム画面 |
| **目標** | Garden ホーム（`/`）+ 共通ログイン（`/login`）+ ロール別ダッシュボード起動可 | α 版で東海林さん操作可 |

### 第 2 週（2026-05-08 〜 05-14）：Forest v9 移植 + Root B-1〜B-2

| セッション | Task | 完走条件 |
|---|---|---|
| a-forest | Forest v9 機能移植（納税カレンダー / 決算書 ZIP / 派遣資産要件）| Forest 完走、α 運用 |
| a-root | Root B-1 権限詳細設計実装（has_permission_v2 + UI）| `root_role_permissions` テーブル + 管理画面 |
| a-root | Root B-2 監査ログ拡張実装（actor_account_name + diff 方式）| `root_audit_log` 拡張、6 アクション → 全モジュール対応 |
| a-bud | Bud Phase 1b.2 Task 6-13 完走 | 経理マスタ機能拡張完成 |
| a-bloom | レビュー + 共通 UI 改修 | 各 PR レビュー完了 |

### 第 3 週（2026-05-15 〜 05-21）：Forest 完走 + Root B-3 + Bud Phase 1b.2 仕上げ

| セッション | Task | 完走条件 |
|---|---|---|
| a-forest | Forest α 運用開始（東海林さん 1 人）| α 運用 1 週目開始 |
| a-root | Root B-3 退職運用実装（退職日翌日 03:00 Vercel Cron）| 退職処理フロー稼働 |
| a-bud | Bud Phase 1b.2 完走 + Phase D 給与計算実装着手準備 | 既存経理機能完成 |
| a-bloom | Bloom Workboard / Roadmap 進捗管理画面 | 既存 Phase A-1 完走分の本番化 |

### 第 4 週（2026-05-22 〜 05-31）：Root B-4〜B-5 + Bud Phase D 着手

| セッション | Task | 完走条件 |
|---|---|---|
| a-root | Root B-4 マスタ整合性チェック実装（root_business_entities + 役割テーブル分離）| 法人マスタ + partner / vendor relationships 完成 |
| a-root | Root B-5 認証セキュリティ強化（2FA admin / super_admin 必須化）| 2FA 必須化、TOTP 対応 |
| a-bud | Bud Phase D 給与計算実装着手（D-10 payroll-calculation）| α 版給与計算ロジック稼働 |
| a-auto | MFC CSV 出力実装（D-11 mfc-csv-export）| 72 列 CSV 出力 |

### 第 5 週（2026-06-01 〜 06-07）：Root B-6 通知基盤 + Bud Phase D 進行

| セッション | Task | 完走条件 |
|---|---|---|
| a-root | Root B-6 通知基盤（ハイブリッドメール + Chatwork レート制限）| Resend 統合、`p-queue` 対応 |
| a-bud | Bud Phase D 給与確定 6 段階フロー実装（社労士確認 + スケジュール + リマインダ）| 6 段階フロー稼働、リマインダ通知動作 |
| a-bloom | KPI ダッシュボード本番化 | Bloom 既存設計の本番反映 |

### 第 6 週（2026-06-08 〜 06-14）：Root B-7 移行ツール + Bud Phase D 完走

| セッション | Task | 完走条件 |
|---|---|---|
| a-root | Root B-7 移行ツール（Kintone + FileMaker 取込）| staging + Vercel Cron 分割実行で動作 |
| a-bud | Bud Phase D 給与計算 完走 + α 運用開始 | α 運用 1 週目開始 |
| a-leaf | Leaf 関電 Phase C 仕上げ（Phase B 着手準備）| 残実装完成 |

### 第 7 週（2026-06-15 〜 06-21）：Phase A 統合テスト + α 運用検証

| セッション | Task | 完走条件 |
|---|---|---|
| 全セッション | Phase A 統合テスト | E2E テスト合格 |
| 東海林さん | α 運用検証（Forest + Root + Bud）| 1 週間運用、問題報告 |
| a-bloom | レビュー + バグ修正 | 軽微バグ修正完了 |

### 第 8 週（2026-06-22 〜 06-28）：Phase A 完走 + Phase B 着手準備

| セッション | Task | 完走条件 |
|---|---|---|
| 全セッション | Phase A α 運用 → β 運用判断 | 東海林さん go/no-go |
| a-auto | Phase B spec 改訂 follow-up（Sprout / Fruit / Calendar / Leaf）| Phase B 着手 ready |
| a-bloom | Phase B 計画書起草 | 月次計画完成 |

### 第 9 週（2026-06-29 〜 06-30）：Phase A クロージング

| Task | 完走条件 |
|---|---|
| Phase A 全モジュール α 運用安定 | リリース判断材料整理 |
| Phase B 着手 GO サイン待機 | 東海林さん最終判断 |

---

## 3. 並列実行マトリックス（週次）

| 週 | a-forest | a-root | a-bud | a-auto | a-bloom | a-tree |
|---|---|---|---|---|---|---|
| 1 | （待機）| 共通ログイン spec | （待機）| （待機）| **共通 UI 実装** | （待機）|
| 2 | v9 移植 | B-1 + B-2 | Phase 1b.2 完走 | （Bud 並列）| 共通 UI 改修 | （待機）|
| 3 | α 運用開始 | B-3 | Phase 1b.2 仕上げ | （Bud 並列）| Workboard 本番 | （待機）|
| 4 | （調整）| B-4 + B-5 | Phase D 着手 | MFC CSV | レビュー | （待機）|
| 5 | （調整）| B-6 | Phase D 6 段階 | （MFC 並列）| KPI 本番 | （待機）|
| 6 | （調整）| B-7 移行 | Phase D α 運用 | Phase B spec | レビュー | （待機）|
| 7 | 統合テスト | 統合テスト | 統合テスト | （Phase B 準備）| 統合テスト + バグ | （Phase D 着手準備）|
| 8 | β 運用 | β 運用 | β 運用 | Phase B spec follow-up | Phase B 計画 | （Phase D 着手準備）|
| 9 | 安定運用 | 安定運用 | 安定運用 | （待機）| Phase B 計画完了 | Phase D 着手判断 |

---

## 4. リスク管理

### リスク 1：Garden 共通 UI 第 1 週で完成しないと全 Phase A 遅延

- 影響：全社員アクセス不可 → α 運用開始遅延
- 対策：第 1 週は最優先、a-root + a-bloom 集中投下

### リスク 2：Root B-4 法人マスタ統合判断未決

- 影響：B-4 着手遅延
- 対策：第 4 週着手前に東海林さん協議、Fruit 統合 or 独立どちらかで先行

### リスク 3：Bud Phase D 6 段階フロー実装複雑

- 影響：第 5-6 週遅延
- 対策：α 運用 + 既存 Excel 並行で慎重に検証、無理せず第 6 週後半に倒れる場合は β 運用前に修正

### リスク 4：Forest v9 移植で本番影響

- 影響：稼働中 Forest にバグ混入
- 対策：feature flag + 段階的リリース、第 2 週は機能追加のみで本番影響最小化

---

## 5. 完走判定基準（Phase A 全体）

### 必須条件

- [ ] Garden 共通ログイン + ホーム + 8 ロール別ダッシュボード 稼働
- [ ] Forest v9 機能移植完走 + α 運用 2 週間以上問題なし
- [ ] Root B-1〜B-7 全実装完走 + テストパス
- [ ] Bud Phase 1b.2 完走 + Phase D 給与計算 α 運用開始
- [ ] 全 Phase A 関連 PR merge 完了
- [ ] 全モジュール E2E テスト合格

### 推奨条件

- [ ] α 運用フィードバックを known-pitfalls.md に集約
- [ ] β 運用候補スタッフ（3-5 名）の選定完了
- [ ] Phase B spec 改訂 follow-up 完了

---

## 6. Phase B / C / D 連携

### Phase B 着手準備（Phase A 完了並行）

- Garden Sprout（応募者管理）spec 完成 ✅（既完成）
- Garden Fruit（法人法的実体情報）spec 完成 ✅
- Garden Calendar spec 完成 ✅
- Leaf 関電 Phase C 完成 ✅
- Phase B-1（リスト 30 万件取込）の運用検証

### Phase D 着手準備（Phase A 完了後）

- Tree Phase D 6 spec + 新規 2 spec 完成 ✅
- イノベラ API 仕様書受領（4/27 週中予定）
- Tree α 版テスト計画

---

## 7. 改訂履歴

- 2026-04-26 初版（a-main 006、Phase A 9 週間 week-by-week 計画 + Garden 共通 UI 最優先 Task #0 追加）
