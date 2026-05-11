# dispatch main- No. 104 — a-soil（5/8 金曜朝 起動 + Phase B-01 第 2 弾 GO）

> 起草: a-main-014（先行起草、5/8 朝投下用）
> 用途: a-soil 5/8 金曜朝起動指示 + Phase B-01 第 2 弾着手
> 番号: main- No. 104
> 起草時刻: 2026-05-07(木) 20:43

---

## 投下用短文（東海林さんが a-soil にコピペ、5/8 金曜朝に投下）

~~~
🟢 main- No. 104
【a-main-014 から a-soil への dispatch（5/8 金曜朝 起動 + Phase B-01 第 2 弾 GO）】
発信日時: 2026-05-08(金) 朝 投下用

おはようございます。5/7 木曜 Batch 16 8/8 完成 + Phase B-01 第 1 弾（7 migrations、3 TS、46 tests）ありがとうございました。約 13 倍速の偉業です。

詳細は以下ファイル参照:
[docs/dispatch-main-no104-soil-friday-morning-startup-20260508.md](docs/dispatch-main-no104-soil-friday-morning-startup-20260508.md)

## 起動報告依頼

1. `git pull origin feature/soil-batch16-impl`
2. 状態報告:
   - PR #127（A 案、a-soil パターン）レビュー進捗
   - Batch 16 8/8 完成状態（migrations / TS / tests 全部 push 済?）

## 5/8 金曜本日の優先タスク

### 第一優先: Phase B-01 第 2 弾 着手（想定 1.0d）

第 1 弾完成 → 第 2 弾の中身は spec に従い:
- 残 migrations
- helpers / Server Actions
- Vitest 拡充

### 第二優先: PR #127 レビュー対応（あれば）

5/7 木曜発行の新規 PR #127（旧 #101 消失代替）。レビューコメント着いていれば対応。

### 第三優先: Batch 17 spec 起草（次フェーズ準備、想定 0.5d）

Phase B-01 完成見通し立ったら、次の Batch 17 を spec から起草開始。a-auto 並列投入候補にも該当。

## 自走判断 GO 範囲

- Phase B-01 第 2 弾 連続着手 OK
- 既存 Batch 16 helpers 再利用 OK
- spec / plan に基づき自走判断 OK
- 苦戦 / 設計判断必要 → 即 soil-N で a-main-014 経由
- 253 万件リスト + 335 万件コール履歴の前提崩さない

## 制約遵守

- 動作変更なし（既存コードは触らない）
- 新規 npm install 禁止
- Supabase 本番（garden-prod）データ操作禁止
- garden-dev migration は spec / plan 通り
- 設計判断・仕様変更なし
- main / develop 直 push なし

完走 / 区切り報告は soil-N（次番号 43）で。
~~~

---

## 1. 背景

5/8 金曜朝の a-soil 起動指示。Thursday の Batch 16 8/8 + Phase B-01 第 1 弾完成を受けて、第 2 弾連続着手 + Batch 17 spec 起草準備。

### 1-1. Thursday 夜の状態

Batch 16 8/8 完成 + Phase B-01 第 1 弾 (7 migrations、3 TS、46 tests)。約 13 倍速で前倒し。

### 1-2. 5/8 金曜の本命

Phase B-01 第 2 弾連続着手。次 Batch 17 spec 起草も並列。

---

## 2. dispatch counter

- a-main-014: main- No. 104 → 次は **105**

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| 直近: soil-42（Batch 16 + B-01 第 1 弾完走）| ✅ 受領済 |
| **main- No. 104（本書、5/8 金曜朝 起動 + B-01 第 2 弾）** | 🔵 5/8 金曜朝 投下予定 |
