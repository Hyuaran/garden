# dispatch main- No. 189 — a-bloom-006 へ PR #148/#149 レビュー指示

> 起草: a-main-018
> 用途: a-bud-002 起票 PR #148（Phase D 100%）+ PR #149（Phase E spec batch）への a-bloom 視点レビュー指示
> 番号: main- No. 189
> 起草時刻: 2026-05-09(土) 22:35

---

## 投下用短文（東海林さんが a-bloom-006 にコピペ）

~~~
🟡 main- No. 189
【a-main-018 から a-bloom-006 への dispatch（PR #148/#149 レビュー指示）】
発信日時: 2026-05-09(土) 22:35

# 件名

a-bud-002 起票 PR #148（Phase D 100%）+ PR #149（Phase E spec batch）の a-bloom 視点レビュー実施 + 完走報告

# 1. 背景

a-bud-002 が Phase D 完走 + Phase E spec を 5/8-5/9 にかけて push 済（main 系列、handoff §3-B 参照）:
- PR #148: Phase D（経理・振込・明細・MFC 給与 CSV 連携）100% 達成
- PR #149: Phase E spec batch（給与配信 / payslip 配信設計）

両 PR とも OPEN / MERGEABLE 状態、a-bloom-006 のレビュー回しが PR #150 起票完了後の次タスクとして待機中。

# 2. 依頼内容

a-bloom 視点で以下 4 観点をレビューし、各 PR にコメント残す:

- 観点 1: bud_* テーブル参照が bloom_* / root_* と整合しているか（特に法人 ID / 従業員 ID の外部キー）
- 観点 2: 認証ロール（toss/closer/cs/staff/manager/admin/super_admin）境界が Bud 側と Bloom 側で齟齬ないか
- 観点 3: payslip 配信フロー（PR #149 spec）が Bloom 日報 / KPI 集計と衝突しないか
- 観点 4: コードリプレース時の旧版データ保持ルール（memory feedback_no_delete_keep_legacy）遵守確認

# 3. 厳守事項

- レビューは「拒否権ではなく観点提示」、最終 merge 判断は a-bud-002 + 東海林さん
- 既存実装把握必須（grep + Read + git log + import 追跡 = memory feedback_check_existing_impl_before_discussion v2 の修正前トリガー準拠）
- Bloom 側 PR #150 の build 確認（Vercel preview）が優先、レビューは並行 OK 範囲で

# 4. 完走報告フォーマット

完走時、以下を a-main-018 へ返信（番号付き）:

- 報告番号: bloom-006- No. 2 以降
- PR #148 レビュー結果: OK / 要修正 N 件 / コメント済 N 件
- PR #149 レビュー結果: 同上
- 観点 1-4 で指摘した内容（要約 1-2 行ずつ）
- commit hash（push 必要時）/ なし
- 次の作業候補

# 5. 期限

なし（PR #150 build 確認優先で並行進行可）。

→ 受領したら「189受領 + 着手」で OK
~~~

---

## 詳細（参考、投下対象外）

### handoff §3-B より引用

```
| a-bud-002 | feature/bud-... | 8d09ec4 | PR #148 (Phase D 100%) / PR #149 (Phase E spec batch) | OPEN / MERGEABLE 両方 |
```

### 完走報告フォーマット例（参考）

```
bloom-006- No. 2 完走報告
PR #148: コメント済 3 件（観点 2 で employee_id 型不整合 1 件、観点 4 で legacy 保持確認 OK 2 件）
PR #149: OK（観点 3 で日報集計と独立、衝突なし確認）
次: PR #150 build 確認継続
```

---

## self-check

- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ
- [x] 添付画像なし（必要なし）
- [x] 既存実装把握済（handoff §3-B + memory project_bloom_auth_independence）
- [x] 厳守事項リスト化
- [x] 緊急度 🟡（PR #150 build 優先のため並行進行）
- [x] 投下用短文 ~~~ 内に ``` コードブロックなし（v5.1 準拠）
