# PR #82 再レビュー — Bud Phase D 4 次 follow-up（給与 PDF + Y 案 + Cat 4 #26/#27/#28）

- **対象**: PR #82 / branch `feature/bud-phase-d-specs-batch17-auto-fixes` / commit `19f2151`
- **base**: `develop`（merge 解消済）
- **diff**: 8594 additions / 1 deletion / 23 files（spec docs のみ）
- **作成**: 2026-04-27 07:00（a-review GW セッション、4 次 follow-up 反映後初回）
- **依頼元**: a-main-009

## 📋 概要

a-bud が **4 次 follow-up（Cat 4 #26/#27/#28）**で給与確定フローを **6 段階 → 7 段階**化、`payroll_visual_checker` ロール（上田君）を追加、3 経路同時生成（D-07 §4.4）と賞与 admin 限定（D-03 §7）を spec に反映。Bud は §16 で🔴最厳格（金額・振込系）扱いだが、**RLS 設計・段階遷移ルール・spec 内整合のいずれも経理事故防止の観点で堅牢**。Y 案 + フォールバック（私の初回 #74 レビューでの最大論点）も維持。

**判定**: ✅ **APPROVE 条件付**（妥当性確認 5 件、軽微指摘 2 件）

## 🔍 4 次 follow-up 主要変更の検証

### ✅ 7 段階フロー + payroll_visual_checker ロール追加

`spec-d-10 §4.1 / §6.4 / §7`:

```
① calculated → ② approved → ③ exported → ④ confirmed_by_auditor
   → ⑤ visual_double_checked ⭐ NEW → ⑥ confirmed_by_sharoshi → ⑦ finalized
```

**RLS の堅牢性**（D-10 §7）:

```sql
-- ⑤ confirmed_by_auditor → visual_double_checked: payroll_visual_checker（上田）
CREATE POLICY pr_visual_check ON bud.payroll_records FOR UPDATE
  USING (
    status = 'confirmed_by_auditor'
    AND has_payroll_role(ARRAY['payroll_visual_checker'])
    AND visual_double_check_requested_at IS NOT NULL  -- 依頼送信済必須
  )
  WITH CHECK (
    status = 'visual_double_checked'
    AND has_payroll_role(ARRAY['payroll_visual_checker'])
    AND visual_double_checked_at IS NOT NULL
    AND visual_double_checked_by IS NOT NULL
  );
```

**評価**:
- ✅ **依頼送信済が前提条件**として policy に組み込まれ、上田が「依頼なきレコード」を勝手に進められない設計
- ✅ WITH CHECK で `visual_double_checked_at/by IS NOT NULL` を強制 → タイムスタンプ・実行者監査が確実
- ✅ `pr_request_visual_check` policy（status 据え置きで列のみ更新）で、依頼動作と遷移動作を独立 → 監査トレイル分離

### ✅ 3 経路同時生成（D-07 §4.4 / Cat 4 #27）

```
4 次 follow-up: 3 経路を 1 トランザクションで同時生成（旧 30 件閾値判定は廃止）
- 経路 A: 全銀協 FB データ 1 ファイル → Storage 保存
- 経路 B: 勘定項目別レポート CSV（8 大区分階層） → MFC 会計
- 経路 C: MFC 互換 CSV（72 列 / cp932） → MFC 給与
```

**評価**:
- ✅ 旧設計（経路 C 後追い）から 3 経路同時生成に統一 → 出力タイミング揃えで運用ミス削減
- ✅ 1 トランザクション内で `bud_payroll_transfer_batches.fb_data_path` セット + status='exported' 一括更新
- ⚠️ **要確認（軽微）**: PostgreSQL トランザクションは Storage 操作（外部サービス）と atomic ではない。Storage 保存後に DB rollback 発生時の orphan ファイル処理が spec で未明記。a-leaf #72 で同じ問題が flagged 済（Storage オーファン）→ D-07 §4.4 にも cleanup job or 2 段階コミット pattern 言及推奨

### ✅ 賞与 admin 限定（D-03 §7 / Cat 4 #28）

```sql
-- INSERT / UPDATE / DELETE は admin+ のみ（賞与額は admin が直接入力）
CREATE POLICY bonus_admin_only_write ON bud_bonus_records FOR INSERT
  WITH CHECK (is_admin_or_super_admin());
```

**評価**:
- ✅ 賞与は年 2-3 回・金額大・税計算特殊で **ミスのインパクトが給与より大きい** という業務的根拠も明記
- ✅ V6 自起票禁止と同等の自己承認禁止が組み込まれている
- ✅ payroll_disburser ではなく admin が起票 → 役割分離の徹底

### ✅ D-12 7 stage offset（営業日累積 8-10 営業日）

```
calculation: period_end + 2 営業日
approval:    +1 営業日 (累計 +3)
mfc_import:  +1 営業日 (累計 +4)
audit:       +1 営業日 (累計 +5)
visual_double_check ⭐ NEW: +1 営業日 (累計 +6)
sharoshi_check: +3 営業日 (累計 +9)
finalization: +1 営業日 (累計 +10)
```

**評価**:
- ✅ 既存 `business-day` ライブラリ流用で土日スキップ済
- ✅ 8-10 営業日は給与計算サイクル（月締め → 翌月支給）に余裕
- 🟡 **祝日対応未実装**（spec 内でも「Phase E で拡張」と明記）→ GW 中盤の祝日（5/3, 5/4, 5/5）が period_end 直後に来る場合、初回運用が遅延する可能性。**Phase E 着手前に祝日テーブル準備推奨**

### ✅ Y 案維持（私の #74 初回指摘の主目的）

`spec-d-04 §2 / §16.7`:

旧採択「方式 2 = MMDD 4 桁 PW PDF メール添付」は**継続して破棄**、Y 案（強ランダム 16 文字 + マイページ確認 + 24h 自動マスク）が主軸。MMDD/社員番号 PW の**捨案明示**も維持。**初回 #74 レビューの完全修正状態が 4 次 follow-up でも保たれている** ✅

---

## 🟡 軽微指摘 (2 件)

### 1. payroll_visual_checker の SELECT スコープ未明示

D-10 §7 の `pr_select` policy:
```sql
CREATE POLICY pr_select ON bud.payroll_records FOR SELECT USING (
  ... OR has_payroll_role()
);
```

`has_payroll_role()` は引数なしで any payroll role 判定 → **上田が「依頼されたレコード以外」も SELECT 可能**。spec §6.5 では「閲覧 + OK ボタンのみ」と書かれているが、SELECT policy で「依頼済のみ」の絞り込みがない。

**修正案**:
```sql
CREATE POLICY pr_select_visual_checker ON bud.payroll_records FOR SELECT
  USING (
    has_payroll_role(ARRAY['payroll_visual_checker'])
    AND status = 'confirmed_by_auditor'
    AND visual_double_check_requested_at IS NOT NULL
  );
```

または、上田の SELECT 権限を「依頼済の一覧表示」UI 側でフィルタするなら spec §6.4 に明示。**Phase D 実装着手時に追加修正で OK**（spec 段階の指摘）。

### 2. 3 経路同時生成の atomic 担保（Storage オーファン）

D-07 §4.4 は「1 トランザクションで全ファイル保存 + status='exported' 一括更新」と記載。ただし PostgreSQL トランザクションは Supabase Storage（外部サービス）操作と atomic でない。

**シナリオ**:
- 経路 A FB 保存成功 → 経路 B CSV 保存成功 → 経路 C MFC 保存途中で失敗 → DB rollback
- → A / B のファイルが Storage に **orphan** として残存

**修正案**: D-07 §4.4 に以下を追記推奨：
- 失敗時の compensating cleanup（保存済 paths を `supabase.storage.remove()`）
- または status='generating' で先行 INSERT → Storage 保存全成功後に status='exported' 更新（cleanup job が `status='generating' AND created_at < now() - 1h` を一括削除）

**参考**: a-review が PR #72 (leaf attachments) で flagged 済。known-pitfalls 横断で類似パターン。

---

## 📚 known-pitfalls.md 横断（再レビュー）

- #1 timestamptz 空文字: ✅ DEFAULT now() / NOT NULL 整備済
- #2 RLS anon 流用: ✅ Server Action 経路、`createRouteHandlerClient` 想定明記
- #3 空 payload insert: ✅ 各 schema に NOT NULL + CHECK
- #6 garden_role CHECK 制約: ✅ `has_payroll_role(ARRAY[...])` で抽象化、ハードコード回避
- #8 deleted_at vs is_active: ✅ 該当なし

## 🎯 重大度サマリ

| 修正 | 件数 | 詳細 |
|---|---|---|
| 🔴 重大 | **0** | （4 次 follow-up で経理事故防止の核心はすべて整備済） |
| 🟡 推奨 | **2** | visual_checker SELECT スコープ / Storage オーファン cleanup |
| 🟢 任意 | 1 | Phase E 祝日対応の準備（D-12） |

## 🚦 判定

### ✅ APPROVE（軽微指摘 2 件、Phase D 実装着手時に対応で OK）

5/3 GW 中盤までの merge で問題なし。spec only PR のため Vercel build 影響なし。

**マージ後フォロー**:
- 🟡 D-10 §7 に `pr_select_visual_checker` policy 追加 or §6.4 に SELECT 絞込の運用ルール明記（実装フェーズで対応）
- 🟡 D-07 §4.4 に Storage オーファン cleanup 戦略追記（実装フェーズで対応、a-review #72 と同パターン）
- 🟢 Phase E 着手前に祝日テーブル準備（5/3-5/5 GW を経た後の適用予定）

経理事故防止の核心（Y 案維持・賞与 admin 限定・visual checker 独立ロール・3 経路同時化）はすべて堅牢に整備されており、5/5 後道さんデモ前の安心材料として十分な仕様。

---

🤖 a-review by Claude Opus 4.7 (1M context)
