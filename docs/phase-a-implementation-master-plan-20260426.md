# Garden Phase A 実装着手 Master Plan - 2026-04-26 - a-main 006

> CLAUDE.md §18「Garden 構築優先順位」の Phase A（経理総務の自動化、1〜2 ヶ月）の実装着手準備。
> spec 完成済モジュールの実装フェーズ移行の優先順位 + ready セッション割当 + 着手判断材料を集約。

**作成日**：2026-04-26 a-main 006
**目標期間**：Phase A 完走 1-2 ヶ月（2026-06 末まで）

---

## 1. Phase A 対象モジュール（CLAUDE.md §18）

### 基本方針
**東海林さんの通常業務軽減を最優先** → 作業時間確保 → 後続 Phase B/C/D 加速

### Phase A 3 モジュール

| 順 | モジュール | 役割 | 現状 | 着手 ready 度 |
|---|---|---|---|---|
| **1** | **Garden-Forest**（経営ダッシュボード）| 既に本番稼働中、v9 機能移植継続 | 🟢 本番稼働 + Phase 1-4 残 | ✅ 高 |
| **2** | **Garden-Root**（認証・マスタ） | 経理参照基盤、7 マスタ完成 + Bud 連携 | 🟢 Phase A-1/A-2 完走、Phase B 7 spec 完成 | ✅ 高 |
| **3** | **Garden-Bud**（経理・振込・明細） | 経理自動化の中核、給与処理 Phase D 拡張 | 🟢 Phase 1b.2 Task 5/13 完了 + Phase D 8 spec | 🟡 中 |

---

## 2. 各モジュール 実装着手準備状況

### 2.1 Garden-Forest（最優先、本番稼働中）

#### spec 完成度

- ✅ Forest 既存設計（fiscal_periods 等）安定運用中
- ✅ Forest #21（App 85 アーカイブ扱い）反映済
- ✅ v9 機能移植 Phase 1-4 設計済（既存 plan 参照）

#### 残実装タスク

- 納税カレンダー機能追加
- 決算書 ZIP 機能（Phase B Storage 統合バッチでまとめ実装）
- 派遣資産要件追加
- v9 互換性向上（既存）

#### 担当セッション

- **a-forest**（実装本体）
- **a-bloom**（レビュー）

#### 着手判断

🟢 **即着手可能**（GitHub 復旧後）。本番影響あるため段階的リリース推奨。

---

### 2.2 Garden-Root（経理基盤、最優先）

#### spec 完成度

- ✅ Phase A-1（既存 CRUD UI 仕上げ）完走
- ✅ Phase A-2（KoT API 月次勤怠取込）完走
- 🟡 **Phase B 7 spec 確定済 60 件反映**（a-root-002 進行中）
- 🟡 新規 2 spec 起草済（権限管理画面 1,004 行 + ヘルプモジュール 828 行）

#### 残実装タスク

- Phase B-1 権限詳細設計実装（has_permission_v2 関数 + UI）
- Phase B-2 監査ログ拡張実装（actor_account_name + diff 方式）
- Phase B-3 退職運用実装（退職日翌日 03:00 Cron）
- Phase B-4 マスタ整合性チェック実装（root_business_entities + 役割テーブル分離）
- Phase B-5 認証セキュリティ強化（2FA admin / super_admin 必須化）
- Phase B-6 通知基盤（ハイブリッドメール + Chatwork レート制限）
- Phase B-7 移行ツール（Kintone + FileMaker 取込）

#### 担当セッション

- **a-root / a-root-002**（実装本体）
- **a-bloom**（レビュー）

#### 着手判断

🟡 **a-root-002 完走報告 + GitHub 復旧後着手可能**。Phase A 経理（Bud）と並行で進めるべき大規模 Phase。

---

### 2.3 Garden-Bud（経理本体）

#### spec 完成度

- ✅ Phase 1b.2 Task 5/13 完了
- ✅ Phase D 8 spec + 新規 D-09/D-10/D-11 起草済
- ✅ Y 案 + フォールバック確定（給与明細配信）
- ✅ Kintone 統合確定 5 件（口座分離 / Excel 排除 / 権限境界 / MFC CSV / 東海林頼んだ Excel 廃止）
- ✅ Bud follow-up 4 件確定（給与期間 / 1 月精算 / ハイブリッド振込 / 8 区分階層）

#### 残実装タスク

- Phase 1b.2 Task 6-13 完走（経理マスタ機能拡張）
- Phase D 給与処理実装（attendance / 給与計算 / 賞与 / 配信 / 振込 / 年末調整）
- MFC CSV 出力実装（72 列）
- bud_payroll_accounting_reports（8 区分階層レポート）

#### 担当セッション

- **a-bud**（実装本体）
- **a-auto**（spec 整合性チェック / 並列タスク）
- **a-bloom**（レビュー）

#### 着手判断

🟢 **Phase 1b.2 Task 6-13 即着手可能**（GitHub 復旧後）。Phase D は Root の権限基盤完成後着手推奨。

---

## 3. 並列実装計画（5 月 〜 6 月想定）

### 3.1 月次マイルストーン

```
2026-04 末（GitHub 復旧後）：
  ↓ 20+ ブランチ push + PR 発行 + merge（数日）
  ↓
2026-05 第 1-2 週：
  ↓ Forest v9 機能移植 完走（a-forest）
  ↓ Root Phase B-1/B-2/B-3 実装（a-root）
  ↓ Bud Phase 1b.2 Task 6-13 完走（a-bud）
  ↓
2026-05 第 3-4 週：
  ↓ Forest 完走 → α版運用開始
  ↓ Root Phase B-4/B-5/B-6 実装
  ↓ Bud Phase D 給与計算実装着手（a-bud + a-auto 並列）
  ↓
2026-06 第 1-2 週：
  ↓ Root Phase B-7 移行ツール（Kintone + FileMaker）実装
  ↓ Bud Phase D 完走 → α版運用開始
  ↓
2026-06 第 3-4 週：
  ↓ Phase A 全完走、α版運用安定
  ↓ Phase B 着手準備（Leaf / Sprout / Fruit / Calendar）
```

### 3.2 並列実行マトリックス

| 期間 | a-forest | a-root | a-bud | a-auto | a-bloom |
|---|---|---|---|---|---|
| 5 月第 1-2 週 | v9 移植 | Phase B-1〜3 | Phase 1b.2 Task 6-13 | Bud Phase D 並列タスク | レビュー |
| 5 月第 3-4 週 | α 運用開始 | Phase B-4〜6 | Phase D 給与計算 | MFC CSV 出力 | レビュー |
| 6 月第 1-2 週 | （新規機能）| Phase B-7 移行 | Phase D 残実装 | 並行 spec 改訂 | レビュー |
| 6 月第 3-4 週 | （調整）| Phase B 完走 | Phase D α運用 | Phase B 補助 | リリース判断 |

---

## 4. 実装着手の前提条件

### 4.1 必須条件（揃わないと着手不可）

| # | 条件 | 状態 |
|---|---|---|
| 1 | GitHub 復旧（push 可能）| ⏳ チケット #4325863 |
| 2 | 槙さん invite 受諾（暫定アカウント or 元 ShojiMikoto 復旧）| ⏳ |
| 3 | 13+ ブランチ push + PR 発行 + merge | ⏸ GitHub 復旧後 |
| 4 | a-root-002 確定 60 件反映 完走 | 🟡 進行中 |

### 4.2 推奨条件（あれば加速）

| # | 条件 | 状態 |
|---|---|---|
| 1 | Supabase Pro → Team 昇格判断 | 🟡 Phase B-1 完了後判断 |
| 2 | イノベラ API 仕様書受領 | 🟡 先方連携待ち |
| 3 | FileMaker 詳細 CSV サンプル | 🟢 ファイル所在確認済（後日 a-root 抽出）|
| 4 | お名前ドットコムサーバー解約タイミング判断 | 🟡 別途判断 |

---

## 5. 着手判断ポイント

### 5.1 各モジュール着手の go/no-go 基準

#### Forest 着手判断
- ✅ go：v9 既存設計安定、本番影響を段階的に管理
- ❌ no-go：本番停止リスクあるなら週末ウィンドウのみ

#### Root 着手判断
- ✅ go：Phase B-1〜B-3 は基盤、B-4 以降は順次積み上げ
- ❌ no-go：法人マスタ統合判断（Fruit との関係）が未確定なら B-4 待機

#### Bud 着手判断
- ✅ go：Phase 1b.2 Task 6-13 は経理機能拡張、独立実装可
- ❌ no-go：Phase D は Root Phase B-1（権限基盤）完成後に着手推奨

### 5.2 リリース時期目標との整合性

CLAUDE.md §18：**6 ヶ月（MAX 年内）でのリリース**

```
2026-04: Phase A 着手準備（本日完了）
2026-05: Phase A 実装（5-6 週間）
2026-06 末: Phase A 完走 + α版運用安定
2026-07 〜 08: Phase B（Leaf 関電 + Bud 給与）
2026-09 〜 10: Phase C（Soil / Bloom / Rill / Seed / Leaf 他）
2026-11 〜 12: Phase D（Tree 最終段階）
2027-01: 全社展開完了
```

→ **2026-04 時点で 6 ヶ月目標は順調な進捗**。Phase A 着手の判断は GitHub 復旧後即時 OK。

---

## 6. 後続 Phase との連携

### Phase B 着手前の必須準備

- Garden Sprout（応募者管理）spec 完成（Batch 18 完走済）
- Garden Fruit（法人法的実体情報）spec 完成（Batch 18 完走済）
- Garden Calendar spec 完成（Batch 18 完走済）
- Leaf 関電 Phase C 完成（既存）

→ Phase A 完走と並行で Phase B spec 改訂 follow-up 完了予定。

### Phase D 着手前の必須準備（Tree、最厳格）

- Tree Phase D 6 spec + 新規 2 spec 完成（a-tree 完走済）
- イノベラ API 仕様書受領
- α版テスト計画（東海林さん 1 人）
- β版運用準備（コールセンタースタッフ 1 名）

---

## 7. リスク管理

### リスク 1：GitHub 復旧遅延

- 影響：実装着手遅延 + ローカル滞留 commit リスク
- 対策：暫定アカウント（ShojiMikoto-B）で push 開始準備済、復旧次第即実行

### リスク 2：a-root Phase B 範囲広すぎ

- 影響：Phase A 完走時期遅延
- 対策：B-1/B-2/B-3 を最優先、B-4〜B-7 は順次

### リスク 3：Bud Phase D 複雑性

- 影響：給与計算ロジック移行（Excel → Garden）の検証時間長期化
- 対策：α版運用 + 1-2 ヶ月並行（既存 Excel + Garden 両方）→ 整合性確認 → Garden 単独運用

### リスク 4：法人マスタ統合判断未決

- 影響：B-4 マスタ整合性チェック実装着手遅延
- 対策：Fruit 統合判断は B-4 着手前に東海林さん協議、現状は別テーブルで先行 OK

---

## 8. 改訂履歴

- 2026-04-26 初版（a-main 006、Phase A 実装着手前の master plan）
