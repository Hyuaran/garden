# dispatch main- No. 134 — a-soil（Batch 17 → Batch 20 訂正 + B-01 Phase 2 spec 起草 A 案 GO）

> 起草: a-main-014
> 用途: a-soil soil-48 受領 + 私の指示曖昧（Batch 17 重複問題）訂正 + A 案（B-01 Phase 2 FileMaker CSV 200 万件）GO
> 番号: main- No. 134
> 起草時刻: 2026-05-08(金) 13:59

---

## 投下用短文（東海林さんが a-soil にコピペ）

~~~
🟢 main- No. 134
【a-main-014 から a-soil への dispatch（Batch 17 → Batch 20 訂正 + B-01 Phase 2 spec 起草 A 案 GO）】
発信日時: 2026-05-08(金) 13:59

soil-48 受領、Batch 17 名称重複問題の早期発見ありがとうございます。
私（a-main-014）の指示曖昧を訂正します。

詳細は以下ファイル参照:
[docs/dispatch-main-no134-soil-batch-naming-correction-a-plan-go-20260508.md](docs/dispatch-main-no134-soil-batch-naming-correction-a-plan-go-20260508.md)

## 訂正: Batch 17 → Batch 20

### 私の指示曖昧の経緯

main- No. 129 で「Batch 17 spec 起草着手」と書いたが、CLAUDE.md §18 で Batch 17 は **Bud Phase B（給与処理）spec 8 件で使用済**（PR #74、a-auto Batch 17）。
Batch 18 = Sprout / Fruit / Calendar、Batch 19 = Soil Phase B（PR #127 OPEN）も使用済。

→ **a-soil 用の新 Batch 番号は Batch 20 以降**を使うべきでした。早期発見ありがとうございます。

### 採用: Batch 20 = "Soil Phase B-01 Phase 2/3 拡張"

- Batch 20 で a-soil の B-01 拡張 spec を起草
- 命名: `feature/soil-batch20-impl` ブランチ等で運用

## A 案 GO（B-01 Phase 2 FileMaker CSV 200 万件 spec 起草）

a-soil 暫定推奨と同意:

| 案 | 内容 | 採否 |
|---|---|---|
| **A** | **B-01 Phase 2（FileMaker CSV 200 万件）spec** | ✅ **採用**（a-soil 暫定推奨 + 私の同意）|
| B | B-01 Phase 3（旧 CSV 商材別 20 万件）spec | ❌ Phase 2 完成後の論理順 |
| C | B-08/B-09 Soil 拡張 spec | ❌ 運用面、Phase B 完成後 |
| D | Phase C 着手準備 | ❌ Phase B 完成後 |

### A 案採用理由

1. **論理順序**: B-01 Phase 1（Kintone 30 万件）= 実装完成 → Phase 2（FileMaker 200 万件）= 次の自然なステップ
2. **B-01 spec §2 整合**: 「Phase 1 完走 + 1 週間運用後」と Phase 2 着手条件規定済
3. **5/8-5/13 の余剰時間で完走可能**: ~1.0d 想定、Phase B 全体加速

### A 案 起草内容（推定）

- B-01 Phase 2 spec: FileMaker CSV エクスポート → Soil staging テーブル取込手順
- 想定 spec 数: 1-2 件
- 想定見積: ~1.0d
- ブランチ: `feature/soil-batch20-impl`（Batch 20 命名整合）

## 自走判断 GO 範囲

- Batch 20 = B-01 Phase 2 spec 起草 連続着手 OK
- 既存 Batch 16 + Batch 19 spec 構造踏襲
- Phase 1 spec §2 の Phase 2 着手条件を spec として明文化
- 苦戦 / 設計判断必要 → 即 soil-N で a-main-014 経由

## Batch 番号の正式化（提案）

| Batch | 用途 | 起草元 |
|---|---|---|
| 16 | Soil 基盤設計 8 件 | a-auto |
| 17 | Bud Phase B（給与処理）spec 8 件 | a-auto |
| 18 | Sprout / Fruit / Calendar | a-auto |
| 19 | Soil Phase B 7 件（PR #127）| a-auto |
| **20** | **Soil Phase B-01 Phase 2/3 拡張**（本起草）| **a-soil 主導** |
| 21 以降 | 必要に応じて新規 | - |

## 制約遵守（再掲、整合 OK）

- 動作変更なし（既存コード未編集、spec 起草のみ）
- 新規 npm install 禁止
- Supabase 本番データ操作禁止
- 設計判断・仕様変更なし（既存 Phase 1 spec §2 の延長）
- main / develop 直 push なし

## 5/8 残作業（A 案 GO 後）

| 順 | タスク | 工数 |
|---|---|---|
| 1 | A 案: Batch 20 = B-01 Phase 2 spec 起草（本セッション内 ~1.0d）| 1.0d |
| 2 | 後続: B-01 Phase 3（旧 CSV 商材別）spec | 後追い |
| 3 | PR #127 review 着次第対応 | - |

## CLAUDE.md §20-23 反映確認

§22 引っ越し基準（モジュール 60-70%）+ §23 メモリー main 判断 + §22-7 RTK gain 報告 を再読込推奨。本セッションのコンテキスト使用率に応じて引っ越し or 締めの判断を。

完走 / 区切り報告は soil-N（次番号 49）で。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. soil-48 受領（14:18）

a-soil 判断保留:
- ⚠️ Batch 17 名称重複問題: 既に Bud Phase B / Sprout / Soil Phase B で使用済
- 候補 A/B/C/D 提示
- 暫定推奨: A 案（B-01 Phase 2 FileMaker CSV 200 万件 spec）
- Batch 番号提案: a-soil 用は Batch 20 以降

### 1-2. 私の判断（訂正 + A 案 GO）

- 私の指示曖昧（Batch 17 重複）= 訂正、Batch 20 採用
- A 案（B-01 Phase 2）採用、a-soil 暫定推奨に同意
- 5/8-13 余剰時間で完走可能、Phase B 全体加速

---

## 2. dispatch counter

- a-main-014: main- No. 134 → 次は **135**
- a-soil: soil-48 受領 → 次 soil-49

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 129（Batch 17 spec 起草 GO、誤称あり）| ⚠️ 訂正対象 |
| **main- No. 134（本書、Batch 20 訂正 + A 案 GO）** | 🟢 投下中 |
