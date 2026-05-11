# dispatch main- No. 303 — a-leaf-002 へ Leaf 修復 A 案 GO + 業務ヒアリング後回し（①-⑥ 完了後）+ 確認希望 5 項目一括回答 + 教訓横展開検討

> 起草: a-main-023
> 用途: a-leaf-002 への Leaf 本体 migration 修復方針 A 案 GO 採択通知 + 業務フィールド確定ヒアリングの ①-⑥ critical path 完了後への後回し通知 + 確認希望 5 項目一括回答 + Leaf 教訓 docs/leaf-migration-checklist.md 横展開検討
> 番号: main- No. 303
> 起草時刻: 2026-05-11(月) 18:25
> 投下先: a-leaf-002（C:\garden\a-leaf-002）
> 添付: なし（参照 PR: #165 Leaf 修復計画、PR #138 既存 migration、PR #147 a-bloom レビュー受領待ち）
> 緊急度: 🟡 中

---

## 投下用短文（東海林さんがコピー → a-leaf-002 にペースト）

~~~
🟡 main- No. 303
【a-main-023 から a-leaf-002 への dispatch（Leaf 修復 A 案 GO + 業務ヒアリング ①-⑥ 完了後 + 5 項目回答 + 教訓横展開検討）】
発信日時: 2026-05-11(月) 18:25

# 件名
🟡 Leaf 修復 A 案 GO (本体 CREATE migration 新規起草、0.7 日) + 業務フィールド確定ヒアリング は ①-⑥ critical path 完了後（5/18 以降）+ 確認希望 5 項目 一括回答 + 教訓 docs/leaf-migration-checklist.md 横展開検討

# A. 採択結果（5/11 18:15 東海林さん決裁）

| # | 論点 | 採択 |
|---|---|---|
| 1 | Leaf 本体 migration 修復方針 | **A 案 GO**（本体 CREATE migration 新規起草 + 既存 D.1 後続 apply、0.7 日） |
| 2 | 業務フィールド確定ヒアリング | **後回し**（①-⑥ critical path 完了後 = 5/18 以降） |
| 3 | 確認希望 5 項目 # 2-5 | **一括回答**（本 dispatch C セクション参照） |

**東海林さんコメント原文**:
- 「1.2は推奨で進める」= A 案 GO + Bud 仕訳帳 Plan A 改 GO
- 「3は今すぐする必要ないよね？であれば、①-⑥おわってからかな」= 業務ヒアリング後回し確定

---

# B. 業務ヒアリング 後回し理由

## B-1. 1 週間 critical path ①-⑥ の優先度

| # | 目標 | 担当 | 完了見込み |
|---|---|---|---|
| ① | 仕訳帳 | a-bud-002 | 5/11 中本番開始 |
| ② | 残高 UI | a-bud-002 | 5/12-5/13 |
| ③ | ログイン → Series Home | a-root-003 (Task 1-6) | 5/14-5/15 |
| ④ | Bloom 進捗 | a-bloom-006 | 5/14-5/16 |
| ⑤ | Forest UI | a-forest-002 + claude.ai | 5/15-5/17 |
| ⑥ | Tree UI 移行 | a-tree-002 (Phase D) | 5/18 後（70 task / 5 週間予定） |

## B-2. Leaf 業務ヒアリング タイミング

- **5/18 以降** = ⑥ Tree UI 移行 完了が最遅 critical path
- ただし Tree Phase D は 5 週間予定のため、現実的には **5/18 以降の Tree 進捗による調整**
- ヒアリング自体は 30 分-1h 程度の想定（leaf_kanden_cases の業務列 確定 + 関連派生表 整理）

## B-3. なぜ後回し OK か

- **修復計画 A 案は業務列ヒアリング不要で進行可能**（最小構成 = 基幹列のみ + 派生列は後付け migration）
- a-leaf-002 # 22 の修復計画も「最小スキーマで CREATE → 業務列は後続 migration で追加」前提
- 業務ヒアリングは「派生列の網羅性」を高める作業であり、A 案の進行ブロックではない

---

# C. 確認希望 5 項目 一括回答

## C-1. 業務フィールド確定（leaf_kanden_cases の業務必要列）

**回答: 後回し**（①-⑥ critical path 完了後、5/18 以降）

A 案進行ブロックではないため、最小スキーマで先行 CREATE。
業務列追加は本体 CREATE 後の別 migration で対応（C-5 と同じパターン）。

最小スキーマ案（a-leaf-002 で起草時の参考）:
```
leaf_kanden_cases (
  id uuid PRIMARY KEY,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid REFERENCES root_employees(id),
  updated_by uuid REFERENCES root_employees(id),
  case_status text,
  -- 業務列は後続 migration で追加
)
```

## C-2. 既存 leaf_kanden_attachments の schema 取得方法

**回答: Supabase Dashboard 経由で東海林さん 手動取得 → a-leaf-002 に共有**

理由:
- Dashboard 手動 CREATE 200 のため pg_dump / supabase db pull は権限要件で詰まる可能性高
- Dashboard SQL Editor で `\d leaf_kanden_attachments` 相当の情報抽出（information_schema.columns SELECT）を東海林さんが実行
- 結果は a-leaf-002 # 23 で東海林さん → a-leaf-002 共有

取得 SQL（東海林さんが Supabase Dashboard SQL Editor 実行）:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leaf_kanden_attachments'
ORDER BY ordinal_position;
```

## C-3. apply 環境

**回答: garden-dev 先行**（CLAUDE.md ルール準拠）

- 本番直接 apply は禁止（CLAUDE.md「Supabase 本番（garden-prod）のデータを直接操作しない」）
- garden-dev で apply → 試験 → 問題なければ本番 apply の段階運用
- 本番 apply タイミングは別途東海林さん判断（リリース直前を想定）

## C-4. Phase D 92.9% 完成の検証

**回答: apply 後 a-bud-002 試験ケース流用 or 別途設計**

優先順:
1. **a-bud-002 試験ケース流用**: Bud Phase A の 919 tests と同等の網羅性テスト構造を Leaf に転用
2. **別途設計**: Leaf 固有の業務シナリオ（関電業務委託 案件登録 → 進捗 → 完了）の Integration test を 5-10 ケース起草
3. **Phase D 残 D.14 カバレッジ確認**: merge 後実施（既存方針継続）

a-bud-002 試験ケース流用が現実的（速度優先 + Bud 既存品質基準準拠）。

## C-5. Soil 連携 leaf_kanden_soil_link

**回答: 別 migration 後付け**（親 CREATE は最小構成）

- 本体 CREATE migration = leaf_kanden_cases / leaf_kanden_attachments / 他 8 件の最小スキーマ
- Soil 連携 = 別 migration で順次追加（例: `xxxxx_leaf_kanden_soil_link.sql`）
- 理由: 本体 CREATE と Soil 連携を同梱すると依存関係（Soil 側テーブル ready 必須）で apply 失敗リスク

---

# D. PR #165 review プロセス

## D-1. 受領経路

PR #165（Leaf 修復計画）は別 dispatch # 304 で a-bloom-006 batch review に追加予定。
batch review 構成:
- PR #147（既存）
- PR #165（追加）← 本件
- 他 critical path 関連 PR があれば順次追加

## D-2. a-leaf-002 側 行動

- PR #165 はそのまま open 維持
- a-bloom-006 から review コメント受領後、a-leaf-002 で修正反映 → merge へ
- merge 後、本体 CREATE migration apply フェーズへ移行

## D-3. タイムライン（暫定）

| 日付 | アクション |
|---|---|
| 5/11 18:30 | dispatch # 304 で PR #165 を a-bloom-006 batch review 追加 |
| 5/12-5/13 | a-bloom-006 review 完了 → a-leaf-002 修正反映 |
| 5/13-5/14 | PR #165 merge + apply（garden-dev） |
| 5/14-5/15 | 既存 D.1-D.13 apply（後続） |
| 5/15-5/17 | D.14 カバレッジ確認 |

---

# E. Leaf 教訓 横展開（docs/leaf-migration-checklist.md）

## E-1. 提案内容（a-leaf-002 # 22 §H 参照）

5 項目チェックリスト:
1. 商材ごとに本体 CREATE migration を最初に作る
2. 連携列追加 migration は本体 CREATE 後
3. Supabase Dashboard 手動 CREATE 禁止
4. 既存テーブル 逆方向 migration 化（schema を migration ファイル化）
5. 商材実装着手前 grep self-check（`grep -r "CREATE TABLE leaf_kanden_" supabase/migrations/`）

## E-2. Garden 全モジュール横展開価値

- Soil / Root / Bud / Tree / Forest / Bloom 全モジュール共通の migration governance 基準
- 同種事故（Dashboard 手動 CREATE / migration 未化）の再発防止
- a-analysis-001 + a-audit-001 経由で governance ドキュメント化が望ましい

## E-3. 起票判断

**a-main-023 判断: a-analysis-001 経由で起票推奨**

理由:
- Leaf 単独の知見ではなく全モジュール共通の migration 衛生基準
- a-analysis-001 が分析結果として起票 → a-audit-001 が監査として承認 → governance 反映
- a-leaf-002 単独で `docs/leaf-migration-checklist.md` 起票も可だが、全モジュール展開のためには上位 governance 経由が望ましい

## E-4. a-leaf-002 への依頼

**今すぐは不要**。本件は a-main-023 が a-analysis-001 + a-audit-001 経由で別途 dispatch する。
ただし a-leaf-002 # 22 §H の 5 項目 + 教訓本文は **そのまま governance 起票の素材**となるため、PR #165 内 docs/ に残しておくこと。

---

# F. 並行進行可能タスク

| # | タスク | 状態 |
|---|---|---|
| F-1 | Leaf Phase A/B/F spec 詳細化 | 進行中（a-leaf-002 # 21 既出） |
| F-2 | 他商材 skeleton レビュー（PR #40 merge 済 5 件） | 進行中 |
| F-3 | effort-tracking.md 更新（5/11 分） | 5/11 中追記 |
| F-4 | PR #147 a-bloom レビュー受領 | 待機中（a-bloom-006 batch review） |
| F-5 | PR #165 a-bloom レビュー受領 | 待機中（dispatch # 304 で追加） |

a-leaf-002 は F-1 / F-2 / F-3 を 5/11-5/13 で進行可能。
F-4 / F-5 は review 受領後の修正反映フェーズ。

---

# G. 業務ヒアリング 着手タイミング（再掲 + 詳細）

## G-1. 着手条件

- **必須条件**: ⑥ Tree UI 移行 完了（5/18 以降、Phase D 70 task 進捗による）
- **理想条件**: ①-⑥ 全完了 + 東海林さんが Tree 現場投入準備に専念していない時間帯

## G-2. ヒアリング内容（事前準備）

- leaf_kanden_cases の業務列候補リスト（a-leaf-002 が事前起草）
- 既存 FileMaker / kintone 関電業務委託の項目スクリーンショット（東海林さんが用意）
- 派生表（leaf_kanden_progress / leaf_kanden_billing 等）の必要性確認

## G-3. ヒアリング所要時間

30 分-1h 想定。
東海林さん作業時間最小化のため、a-leaf-002 が事前に「業務列候補 + 仮設計」を提示 → 東海林さん「OK / NG / 追加」で短時間決裁の運用。

## G-4. ヒアリング後の作業

- 業務列追加 migration 起草（leaf_kanden_cases 派生列 + 関連派生表）
- garden-dev apply + 試験
- PR 発行 → review → merge

---

# H. ACK 形式

軽量 ACK で OK:

~~~
leaf-002- No. NN
【a-leaf-002 から a-main-023 への ACK】
発信日時: YYYY-MM-DD(曜) HH:MM

main- No. 303 受領。

# 確認内容
- A 案 GO 採択 → PR #165 修正反映後 apply 進行
- 業務ヒアリング後回し（①-⑥ 完了後、5/18 以降）了解
- 確認希望 5 項目 回答受領（C-1 後回し / C-2 Dashboard 取得 / C-3 garden-dev / C-4 試験ケース流用 / C-5 別 migration）
- PR #165 a-bloom batch review 追加（# 304 経由）了解
- 教訓横展開は a-analysis-001 経由（a-leaf-002 単独起票不要）了解

# 次アクション
- F-1 Phase A/B/F spec 詳細化 継続
- PR #165 review 受領待ち
- 業務ヒアリング素材（業務列候補リスト）事前起草開始 = 後回しのため低優先

self-check: 採択結果 / 5 項目回答 / 後回しタイミング / 教訓横展開判断 すべて理解 ✅
~~~

---

# I. self-check（a-main-023 起草時）

| 項目 | 状態 |
|---|---|
| 採択結果 A 案 GO 明示 | ✅ A セクション |
| 業務ヒアリング後回し理由 | ✅ B セクション（critical path ①-⑥ 明示） |
| 確認希望 5 項目 一括回答 | ✅ C セクション（C-1 〜 C-5） |
| PR #165 review プロセス | ✅ D セクション（# 304 経由 batch review） |
| 教訓横展開判断 | ✅ E セクション（a-analysis-001 経由推奨） |
| 並行進行可能タスク | ✅ F セクション |
| 業務ヒアリング 着手条件 | ✅ G セクション（5/18 以降） |
| ACK 形式 軽量化 | ✅ H セクション |
| 緊急度 🟡 妥当性 | ✅ A 案 GO + 後回し通知 = 即着手部分限定 |
| dispatch v5.2 ヘッダー準拠 | ✅ 投下先 / ファイル / 添付 / 緊急度 先頭明示 |

~~~

---

## 補足（東海林さん向け / a-leaf-002 に投下しない）

### 投下後の流れ
1. 東海林さん → a-leaf-002 に上記 `~~~` ブロックを ペースト
2. a-leaf-002 が ACK 返却（leaf-002- No. NN）
3. a-leaf-002 が PR #165 修正反映準備 + F-1/F-2/F-3 並行進行
4. 別 dispatch # 304 で a-bloom-006 batch review に PR #165 追加（次タスク）

### 関連 dispatch
- main- No. 302: a-bud-002 へ仕訳帳 Plan A 改 GO（別途起草）
- main- No. 304: a-bloom-006 batch review に PR #165 追加（次起草予定）
- main- No. 305 以降: 教訓横展開 a-analysis-001 起票（タイミング未定）

### 次アクション提案（東海林さん向け）
1. 本 dispatch # 303 を a-leaf-002 に投下
2. dispatch # 302（Bud Plan A 改 GO）を a-bud-002 に投下
3. dispatch # 304（PR #165 batch review 追加）の起草指示
