# dispatch main- No. 103 — a-bloom-004（5/8 金曜朝 起動 + vitest 環境調査 GO）

> 起草: a-main-014（先行起草、5/8 朝投下用）
> 用途: a-bloom-004 5/8 金曜朝起動指示 + vitest 環境調査 + Phase A-2 続き
> 番号: main- No. 103
> 起草時刻: 2026-05-07(木) 20:43

---

## 投下用短文（東海林さんが a-bloom-004 にコピペ、5/8 金曜朝に投下）

~~~
🟢 main- No. 103
【a-main-014 から a-bloom-004 への dispatch（5/8 金曜朝 起動 + vitest 環境調査 + Phase A-2 続き）】
発信日時: 2026-05-08(金) 朝 投下用

おはようございます。5/7 木曜の 8 件完走（Phase 1+3+2A+2B + GardenHomeGate + Phase A-2 spec/plan + Daily Report MVP + Phase A-2.1 Task 1-10）ありがとうございました。約 6 倍速、5-6 日前倒しの偉業です。

詳細は以下ファイル参照:
[docs/dispatch-main-no103-bloom-004-friday-morning-startup-20260508.md](docs/dispatch-main-no103-bloom-004-friday-morning-startup-20260508.md)

## 起動報告依頼

1. `git pull origin feature/bloom-6screens-vercel-2026-05`
2. 状態報告:
   - 現在の test 実行状況（vitest 環境問題は解決した? まだ?）
   - Phase A-2 / A-2.1 の残 task

## 5/8 金曜本日の優先タスク

### 第一優先: 🔴 RTK vitest passthrough 問題 解決（最優先、想定 0.3d）

bloom-004- No. 52 で **vitest 苦戦の真因が RTK passthrough と判明**:
- `rtk vitest run` 7 回 / 99.7% 削減 = vitest は **実際に RTK 経由で実行されている**
- `[RTK:PASSTHROUGH] vitest parser: All parsing tiers failed` = RTK parser が vitest 出力を理解できず passthrough
- → **stdout が caller に届かず結果見えない**仕様の可能性

#### 対応アプローチ（推奨順）

1. **a-bud / a-soil の vitest 成功パターン確認**:
   - a-bud で `feature/bud-phase-d-implementation` ブランチで 329 tests 動作中
   - a-soil で 46 tests 動作中
   - a-bud / a-soil は **どうやって結果を見ているか**を確認（スクショ or 出力サンプル取得）

2. **RTK bypass オプション確認**:
   - `rtk gain --history` で vitest 実行履歴を確認
   - RTK 担当（東海林さん本人）に「vitest 実行時のみ bypass オプション」可能か確認
   - 副次発見として a-main-014 から東海林さんに既報告済

3. **直接 vitest 実行**（RTK 経由しない）:
   - PowerShell で `& ".\node_modules\.bin\vitest.cmd" run` 形式で直接呼び出し
   - junction-linked node_modules の場合は実体パスを特定

#### 調査ヒント（参考、優先度低）

- a-bud `package.json` / `vitest.config.ts`（D-01〜D-07 で 305 tests 動作中）
- a-soil `vitest.config.ts`（46 tests 動作中）
- junction の解消 or 直接実行パス特定

a-main-014 が並列で a-bud / a-soil の vitest 実行成功パターンを Explore で抜粋して別 dispatch 投下する案あり。必要なら bloom-004-N で依頼ください。

### 第二優先: Phase A-2.1 残 Task（11 以降、想定 0.5d）

A-2.1 Task 1-10 完成後の続き。spec / plan に基づき自走 OK。

### 第三優先: /bloom/progress 表示内容更新準備

5/10 a-root-002 集約役で migration 反映予定だが、Bloom 側の表示ロジック側の準備（マイルストーン表示 / 12 モジュール表示等）も並行可能。

## 自走判断 GO 範囲

- vitest 環境調査 → a-bud / a-soil 設定参照、解決アプローチ複数試行 OK
- Phase A-2.1 残 Task 連続着手 OK
- /bloom/progress 表示準備 OK
- 苦戦 / 設計判断必要 → 即 bloom-004-N で a-main-014 経由
- Bloom 独自認証（dev BloomGate バイパス）方針維持

## 制約遵守

- 動作変更なし（既存コードは触らない）
- 新規 npm install 禁止
- Bloom 独自認証独立性維持（Forest と独立、dev では BloomGate バイパス）
- 設計判断・仕様変更なし

完走 / 区切り報告は bloom-004-N（次番号）で。
~~~

---

## 1. 背景

5/8 金曜朝の a-bloom-004 起動指示。Thursday の 8 件完走 + vitest 環境苦戦点を解決して、5/10 集約役 + 5/14-16 デモ準備に向けた整備。

### 1-1. Thursday 夜の状態

bloom-004- No. 50 で vitest 環境問題で苦戦判断、停止。8 件完走で 5-6 日前倒し済み。

### 1-2. 5/8 金曜の本命

vitest 環境解決 → tests 動作確認 → Phase A-2.1 残 Task 連続着手。

---

## 2. dispatch counter

- a-main-014: main- No. 103 → 次は **104**

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| 直近: bloom-004- No. 50（vitest 苦戦判断）| ✅ 受領済 |
| **main- No. 103（本書、5/8 金曜朝 起動 + vitest 解決）** | 🔵 5/8 金曜朝 投下予定 |
