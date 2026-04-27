# PR #82 レビュー — bud Phase D 給与処理 spec 改訂（a-review #74 + Cat 4 #26/#27/#28 対応）

- **対象**: PR #82 / branch `feature/bud-phase-d-specs-batch17-auto-fixes`
- **base**: `develop`
- **mergeStateStatus**: `DIRTY` (CONFLICTING) ⚠️
- **diff**: 8594 additions / 1 deletion / 23 files（spec docs のみ）
- **作成**: 2026-04-27（a-review GW セッション）

## 📋 概要

a-review が PR #74 で指摘した 5 重大事項について、**3 完全修正 / 1 partial / 1 design decision で解決**。特にセキュリティ最大の論点だった「PDF パスワード規則の脆弱性」は **Y 案（強ランダム 16 文字 + マイページ確認）への全面切替**で根治、メール送信基盤の SPF/DKIM/DMARC も専用サブドメイン採用で堅牢化。**LGTM 条件付（マージ前 conflict 解消必須）**。

## 🔍 5 重大指摘の修正状況

| # | 指摘内容 | 状態 |
|---|---|---|
| 1 | D-04 PDF PW 規則（MMDD or 社員番号下 4 桁）が脆弱 | ✅ **完全修正（Y 案採用）** |
| 2 | メール送信基盤の SPF/DKIM/DMARC 未定義 | ✅ **完全修正（専用サブドメイン）** |
| 3 | D-01 `paid_leave_days numeric(4,2)` の桁不足 | 🟡 **partial（実用 OK だが余裕欲しい）** |
| 4 | D-07 unique 制約が再振込シナリオで詰まる | 🟢 **design decision（行単位 retry）** |
| 5 | D-01 `source_root_attendance_id` だけでは遡及修正検知不十分 | ✅ **完全修正（overrides 経由）** |

---

## ✅ 完全修正（3 件）

### #74-1 PDF パスワード — Y 案採用で根治

`spec-d-04-statement-distribution.md:51-103`:

```markdown
> 🎯 改訂 2026-04-26: 旧採択「方式 2 = MMDD 4 桁 PW PDF メール添付」は a-review #1 重大指摘で破棄。
> 東海林さん最終判断で Y 案 + フォールバック を採択（旧 §2 は §16.7 履歴へ移動）。
```

**主経路 (Tree マイページ)**:
- 社内 PC で Garden ログイン → PW 確認
- 自宅メールで PDF 開く（PW = 強ランダム 16 文字、PW 保護）
- **マイページ PW は本人のみ閲覧可（RLS）+ 表示後 24h 自動マスク**

**捨案明示** (line 100-102):
```
❌ MMDD 4 桁 PW（候補 366 でブルートフォース容易、a-review #1 で破棄）
❌ 社員番号下 4 桁 PW（候補 10000 + 連番予測可、同上）
❌ メール本文に PW 規則 hint を記載（メール傍受時に PDF + PW がセット漏洩）
```

memory「給与明細配信設計（Y 案 + フォールバック）」と完全整合。**セキュリティ要件として 16 文字ランダム PW は 2^96 ≈ 8e28 候補**で brute-force 不可能。

### #74-2 SPF/DKIM/DMARC — 全項目定義 + 専用サブドメイン

`spec-d-04-statement-distribution.md:496-507`:

```
SPF:   v=spf1 include:_spf.<provider> -all（hard fail）
DKIM:  プロバイダ発行の公開鍵を 2048bit で登録
DMARC: v=DMARC1; p=reject; rua=mailto:dmarc@hyuaran.com; sp=reject; adkim=s; aspf=s
```

**特に良い点（line 507）**:
> 専用サブドメイン（例: `payroll@notice.<domain>`）を採用し、メインドメインへの DMARC 失敗の影響を局所化。

これは **メール送信ドメインの分離隔離**で、payroll メール配信失敗が `@hyuaran.com` の他メール（営業・取引先）の DMARC reputation を毀損しない設計。エンタープライズ水準の堅牢性。

### #74-5 遡及修正検知 — overrides テーブル経由で明示化

`spec-d-01-attendance-schema.md:412-415`:

```
§10.5 KoT 側の遡及修正
- KoT は遡及修正可能（過去月の打刻訂正等）→ 一度 Bud で確定した値は固定
- 対策: スナップショット作成後の遡及は bud_payroll_attendance_overrides 経由のみ反映
```

**評価**: snapshot を不変（`source_root_attendance_id` 固定）にし、後発の amendments は別テーブル `bud_payroll_attendance_overrides` で**明示的に admin 承認を経て反映**する設計。会計上の改ざん防止 + 監査トレイル両立。memory「Garden 申請承認パターン」とも整合。

---

## 🟡 部分修正（1 件）

### #74-3 `paid_leave_days numeric(4,2)` — 実用 OK だが将来余裕欲しい

`spec-d-01-attendance-schema.md:160-162`:

```sql
paid_leave_days numeric(4, 2) NOT NULL DEFAULT 0,  -- 半休 0.5 日 単位許容
paid_leave_remaining numeric(4, 2),                -- スナップショット時点の残
```

**現状**: max 99.99（4 桁 / 小数 2 桁）。

**評価**:
- 労基法上限の年付与 40 日 + 過去未消化繰越（労基法 第 39 条で最大 2 年保留可）→ **理論上最大 80 日**
- 月次スナップショットの単一 row なら 99.99 で十分
- ただし「全期間累積」「特殊な長期休職復帰者」を扱う場合に詰まる可能性

**推奨（任意）**: 将来の余裕として `numeric(5, 2)` = 999.99 にしておくと安全。Phase D 実装時のテーブル作成 migration で変更すれば後方互換性に影響なし。本 PR の範囲では partial OK。

---

## 🟢 design decision（1 件）

### #74-4 D-07 unique 制約再振込シナリオ — 行単位 retry で解決

`spec-d-07-bank-transfer.md:139`:

```sql
UNIQUE (payroll_period_id, company_id, transfer_type)
```

`spec-d-07-bank-transfer.md:648`:

```
失敗分は個別 retry（admin 手動修正）
```

**評価**: 「batch 単位での再振込」は unique 制約で禁止 → 失敗時は **行単位の手動 retry** で対応する design decision。これは：

- ✅ batch ID の重複（事故）を防ぐ
- ✅ 失敗 row のみリトライで効率的
- ⚠️ batch 全体の自動再実行 UX は提供されない（admin が手動介入必要）

GW デモまでは admin 手動 retry で問題なし。Phase 2 で「batch retry のための新 batch_id 生成 + 失敗 row のみコピー」UI を別 spec で対応推奨。

---

## ⚠️ 注意事項

### mergeStateStatus: DIRTY (CONFLICTING)

PR #87 と同様、develop 側に新コミットがあり conflict 発生。spec docs のみの PR でも、`docs/effort-tracking.md` 等の共有ファイルで conflict が起きうる。

**対応推奨**: マージ前に `git merge develop` または rebase で conflict 解消し、解消後の差分を再確認。spec docs の手動 merge は混入事故を起こしやすいため、**必ず conflict 解消後の spec を 1 度 review し直すこと**。

### Cat 4 #26/#27/#28 関連の確認

PR title に「Cat 4 #26/#27/#28」とあるが、これらの内容（カテゴリ 4 = Kintone 反映分）は本レビュー範囲外。a-bud / a-main 側で別途確認推奨。

## 📚 known-pitfalls.md 横断チェック

- #1 timestamptz 空文字: ✅ Phase D の attendance schema は `NOT NULL DEFAULT now()` 採用
- #2 RLS anon 流用: ✅ Route Handler 経路で `createRouteHandlerClient` 想定（spec §認証で言及）
- #3 空 payload insert: ✅ 該当なし（spec のみ）
- #6 garden_role CHECK 制約: ✅ has_role_at_least パターンと整合
- #8 deleted_at vs is_active: ✅ 該当なし

## 🎯 重大度サマリ

| 修正 | 件数 | 詳細 |
|---|---|---|
| 🔴 重大 | 0 | — |
| 🟡 推奨 | **2** | conflict 解消確認 / `paid_leave_days numeric(5,2)` 拡張 |
| 🟢 任意 | 1 | batch retry UI の Phase 2 別 spec 化 |

## 🚦 判定

### ✅ APPROVE（条件付）— マージ前 conflict 解消必須

**マージ前必須対応**:
1. 🟡 `git merge develop` で conflict 解消、解消後の spec docs を再確認

**実装着手時の調整推奨（任意）**:
2. 🟡 `paid_leave_days` / `paid_leave_remaining` を `numeric(5, 2)` に変更（実装フェーズ migration で対応で OK）
3. 🟢 batch retry UI を Phase 2 別 spec 化（GW 後対応）

セキュリティ要件（PDF PW + メール認証）は完全達成、業務インパクト最大の D-04 / D-01 は spec として運用可能水準。本 spec を基に a-bud が実装着手可能。

---

🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
