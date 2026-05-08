# dispatch main- No. 109 — a-forest-002（forest-9 完走後 次タスク GO 事前テンプレ）

> 起草: a-main-014（先行起草、forest-9 完走報告受領後 即投下用）
> 用途: a-forest-002 forest-9 B-min 完走報告受領後の次タスク GO 事前テンプレ
> 番号: main- No. 109
> 起草時刻: 2026-05-07(木) 20:43

---

## 投下用短文（東海林さんが a-forest-002 にコピペ、forest-9 完走報告受領後に投下）

~~~
🟢 main- No. 109
【a-main-014 から a-forest-002 への dispatch（forest-9 B-min 完走評価 + 次タスク自走 GO）】
発信日時: forest-9 完走受領後 投下用（2026-05-08 想定）

forest-9 受領、B-min 残 #2/#1/#3/#5 完走ありがとうございました。

詳細は以下ファイル参照:
[docs/dispatch-main-no109-forest-002-next-task-go-template-20260508.md](docs/dispatch-main-no109-forest-002-next-task-go-template-20260508.md)

## B-min 完走評価

- 全 5 件（#1/#2/#3/#4/#5）完走 = Forest 仕訳帳 Phase 1 min 完成
- 既存 4 銀行 + 弥生フォーマット + 法人ダッシュボード + 確認画面の体系完成

## 次タスク 自走判断 GO

| 候補 | 内容 | 工数 | 性質 |
|---|---|---|---|
| **forest.md design-status 起草** | 5/9 朝予定の前倒し可 | 0.2d | ドキュメント |
| T-F6（v9 機能移植）| 既定の Phase A 残 | 1.0d | 機能移植 |
| 納税カレンダー | v9 機能移植 | 0.5d | 機能追加 |
| 決算書 ZIP | v9 機能移植 | 0.5d | 機能追加 |
| 派遣資産要件 | v9 機能移植 | 0.3d | 機能追加 |

東海林さんスタンス（ガンガン常態）整合 = どれも自走判断 OK:

- **forest.md 推奨**（5/10 a-root-002 集約役の前提、5/9 朝待たず即起草）
- T-F6 / 納税カレンダー等は forest.md 後の連続着手 OK
- 苦戦 / 集中切れ → 自走判断で停止 OK

## 自走判断 OK の範囲

- forest.md → bud.md / bloom.md / tree.md / leaf.md / root.md / soil.md と同形式
- T-F6 + v9 機能移植 → 既存 Forest コード踏襲
- 苦戦 / 設計判断必要 → 即 forest-N で a-main-014 経由

## 5/10 集約役との連携

a-root-002 が 5/10 に root_module_design_status migration で 7 モジュール .md を集約。
→ forest.md は 5/9 朝までに完成必須（5/10 集約に間に合わせ）。
→ 5/8 夕方〜5/9 朝で起草完成で十分余裕。

## 制約遵守

- 動作変更なし
- 新規 npm install 禁止
- Supabase 本番データ操作禁止
- 設計判断・仕様変更なし
- main / develop 直 push なし

完走 / 区切り報告は forest-N（次番号）で。
~~~

---

## 1. 背景

a-forest-002 が forest-9（B-min 残完走）を報告した後、即投下用に事前起草。
ガンガン常態モードで「報告受領後の判断空白時間」を最小化。

### 1-1. 想定タイミング

- 5/8 夕方〜5/8 夜（B-min 残 1.3d を 5/8 中に完走できれば前倒し）
- 5/9 朝（通常進行）

### 1-2. 投下条件

forest-9（B-min 完走報告）を受領した時点で即投下。
報告内容と本テンプレを照合し、必要なら微調整して投下。

---

## 2. dispatch counter

- a-main-014: main- No. 109 → 次は **110**

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 100（B-min 残 Thursday 夜前倒し GO）| ✅ → #4 着手中 |
| main- No. 108（5/8 金曜朝 起動 + B-min 残続き）| 🔵 5/8 金曜朝 投下予定 |
| **main- No. 109（本書、forest-9 完走後 次タスク GO 事前テンプレ）** | 🔵 forest-9 受領後 投下予定 |
