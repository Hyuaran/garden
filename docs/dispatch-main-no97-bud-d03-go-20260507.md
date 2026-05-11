# dispatch main- No. 97 — a-bud（bud-8 評価 + D-03 ガンガン継続 GO + bud.md 取りまとめ並行）

> 起草: a-main-013
> 用途: a-bud Day 3 D-02 評価 + D-03 bonus 着手 GO + bud.md 取りまとめ（main- No. 96 既依頼）の自走判断
> 番号: main- No. 97
> 起草時刻: 2026-05-07(木) 19:30

---

## 投下用短文（東海林さんが a-bud にコピペ）

~~~
🟢 main- No. 97
【a-main-013 から a-bud への dispatch（Day 3 D-02 評価 + D-03 ガンガン継続 GO + bud.md 並行）】
発信日時: 2026-05-07(木) 19:30

bud-8 受領、Day 3 D-02 12 分完走 + 累計 216 tests green + 61% 圧縮 = 圧倒的成果。ガンガン継続 GO です。

詳細は以下ファイル参照:
[docs/dispatch-main-no97-bud-d03-go-20260507.md](docs/dispatch-main-no97-bud-d03-go-20260507.md)

## D-02 評価（4 倍速、73% 圧縮）

- Day 3 D-02 給与計算ロジック完成 12 分（見積 1.5d）
- migration 6 tables + 純関数 11 件 + Vitest 52 tests green
- 累計 5/7 約 1 時間で 1.8d / 4.6d = **61% 圧縮**
- 判断保留なし、spec 100% 準拠

## D-03 ガンガン継続 GO

東海林さんスタンス（ガンガン常態 / 進めれない事情なし）整合 = D-03 着手 GO:

- **D-03 bonus calculation**（Cat 4 #28 admin only RLS）想定 0.75d
- D-02 と同系統 = 連続性高い、自走判断で進めやすい
- 苦戦時自走判断で停止 OK

## bud.md design-status 取りまとめ（main- No. 96 並行）

main- No. 96 で a-bud に **bud.md 取りまとめ**を依頼予定（東海林さん投下後即着手）:
- 配置先: `_chat_workspace/garden-design-status/bud.md`
- 工数 0.1-0.2d（Day 2 + Day 3 D-02 報告内容ベースで圧縮可能）
- 5/9 までに完成希望（a-root-002 集約役 5/10 前倒しに連動）

## 推奨順序（自走判断 OK）

| 順 | タスク | 工数 |
|---|---|---|
| 1 | bud.md 取りまとめ（main- No. 96 受領後）| 0.1-0.2d |
| 2 | **D-03 bonus calculation** | 0.75d |
| 3 | 余力で D-04 statement distribution（1.8d）or D-07 bank transfer（1.2d）| 自走判断 |

または D-03 → bud.md → D-04 の順でも OK（自走判断）。

## 自走判断 OK の範囲（再強調）

- D-03 着手 → bonus 計算ロジック + tests
- bud.md 取りまとめ並行 OK
- 苦戦 / 設計判断 / バグリスク高 → 即 bud-N で a-main-013 経由
- 疲労 / 集中切れ → 自走判断で停止 OK（無理しない）

## 制約遵守（変更なし）

- 動作変更 / 新規 npm install / 設計変更 / 本番影響 → 要承認
- 自モジュール作業 / main / develop 直 push なし

完走 / 区切り報告は bud-N（次番号）で。
~~~

---

## 1. 背景

### 1-1. bud-8 受領（19:30）

a-bud Day 3 D-02 完走報告:
- 12 分で完走（19:18 → 19:30）
- 工数 0.4d / 1.5d = 4 倍速、73% 圧縮
- migration 6 tables + 純関数 11 件 + 52 tests green
- 累計 1.8d / 4.6d = 61% 圧縮、216 tests all green
- 判断保留なし

### 1-2. 東海林さんスタンス（既明示）

「ガンガン進める常態モード / 進めれない事情あるか?」 = 継続推奨。

### 1-3. 私の判断（推奨採用）

- D-03 ガンガン継続 GO（D-02 と同系統、自然な流れ）
- bud.md 取りまとめは main- No. 96 で並行依頼中
- 苦戦時自走判断停止 OK

---

## 2. D-03 bonus calculation 詳細

### 2-1. spec 概要

- Cat 4 #28: admin only RLS（賞与情報は admin / super_admin / payroll_calculator のみ）
- 賞与計算ロジック（夏冬切替）
- 想定 0.75d

### 2-2. 連続性

D-02 給与計算ロジックを完成させた a-bud にとって、D-03 賞与計算は:
- 同系統の純関数中心
- D-09 で先行定義した bud_has_payroll_role 等を再利用
- TDD で skeleton + tests
- 連続性高い、自走判断で進めやすい

---

## 3. bud.md 取りまとめ（main- No. 96 並行）

### 3-1. 内容（既存 5 モジュール .md と同フォーマット）

7 セクション:
1. 開発フェーズ（全体進捗 % / Phase 位置 / 状態）
2. 完成済機能（D-01 + D-09 + D-05 + D-02 + UI v2 整理）
3. 進行中（D-03 着手中）
4. 残課題（D-04 / D-06-D-08 / Phase B 給与処理 等）
5. 主要 spec / 設計書
6. 担当セッション
7. 更新ルール

### 3-2. 工数

0.1-0.2d（Day 2 報告 + Day 3 D-02 完走報告内容を流用、ほぼ集約のみ）。

### 3-3. 配置先

`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-design-status\bud.md`

---

## 4. dispatch counter / 後続予定

- a-main-013: main- No. 97 → 次は **98**（counter 更新済）

---

## 5. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 94（bud A 案維持 + Day 3 D-02 GO）| ✅ a-bud 受領 + 完走 |
| main- No. 96（forest.md + bud.md 取りまとめ前倒し + a-root-002 集約役 5/10）| 投下中 |
| **main- No. 97（本書、D-03 GO + bud.md 並行）** | 🟢 投下中 |

---

ご確認・継続お願いします。判断保留即上げ歓迎です。
