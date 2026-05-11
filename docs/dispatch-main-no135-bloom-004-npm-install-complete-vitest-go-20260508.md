# dispatch main- No. 135 — a-bloom-004（npm install 完了通知 + vitest 動作確認 + Phase A-2.1 続き GO）

> 起草: a-main-014
> 用途: a-bloom-004 PowerShell 代行（東海林さん実施）完了通知 + vitest 動作確認 GO + Phase A-2.1 続き着手 GO
> 番号: main- No. 135
> 起草時刻: 2026-05-08(金) 14:06

---

## 投下用短文（東海林さんが a-bloom-004 にコピペ）

~~~
🟢 main- No. 135
【a-main-014 から a-bloom-004 への dispatch（npm install 完了通知 + vitest 動作確認 + Phase A-2.1 続き GO）】
発信日時: 2026-05-08(金) 14:06

東海林さんが PowerShell 代行で `npm install` 完了 ✅。524 packages 追加、26s 完了。
2 moderate vulnerabilities ありますが a-forest-002 と同じ既知の状態、無視 OK（npm audit fix --force は破壊的変更含むため不要）。

vitest 動作確認 + Phase A-2.1 続き着手 GO です。

詳細は以下ファイル参照:
[docs/dispatch-main-no135-bloom-004-npm-install-complete-vitest-go-20260508.md](docs/dispatch-main-no135-bloom-004-npm-install-complete-vitest-go-20260508.md)

## npm install 完了内容（東海林さん PowerShell 実行結果）

| 項目 | 結果 |
|---|---|
| Remove-Item node_modules | ✅ 完了 |
| npm install | ✅ 524 packages 追加、26s |
| audit | 2 moderate vulnerabilities（a-forest-002 と同じ既知状態、無視 OK）|

→ a-bloom-004 が独立 node_modules を保持、a-bud / a-soil precedent 整合。

## Step 3-5 即実行 GO

bloom-004- No. 54 で予定された Step 3-5:

### Step 3: vitest 動作確認

```bash
./node_modules/.bin/vitest run src/app/bloom/kpi/
```

期待: Phase A-2.1 全 5 tests PASS（forest-fetcher 4 + UnifiedKpiGrid 1）。

RTK passthrough 問題は解消されているはず（独立 node_modules で vitest binary 直接解決）。

### Step 4: dev server 再起動（昨夜の PID 52220 死亡）

```bash
npm run dev > dev.log 2>&1 &
```

期待: port 3001 or 3002 で稼働、`/bloom/kpi` 200 確認。

### Step 5: Phase A-2.1 続き / `/bloom/progress` 表示準備

main- No. 103 §「第二優先」+「第三優先」着手:
- Phase A-2.1 残 task（Task 11 以降）連続着手
- /bloom/progress 表示反映ロジック準備（5/10 a-root-002 集約役の前提）

## 自走判断 GO 範囲

- Step 3: vitest 動作確認 即実行
- Step 4: dev server 再起動 即実行
- Step 5: Phase A-2.1 残 task 連続着手 OK
- /bloom/progress 表示準備 OK
- 苦戦 / 設計判断必要 → 即 bloom-004-N で a-main-014 経由

## 制約遵守

- 動作変更なし（既存コードは触らない）
- 新規 npm install 禁止（一度きりのセットアップ完了）
- Bloom 独立認証独立性維持（dev では BloomGate バイパス、本番は Bloom 独自ロック解除）
- 設計判断・仕様変更なし

## CLAUDE.md §20-23 + §22-4/§22-8 反映確認

最新の CLAUDE.md には:
- §20 Claude 使用環境 + ChatGPT 連携
- §21 通常モード = デフォルト
- §22 引っ越し基準（モジュール 60-70%）+ §22-7 RTK 集計報告 + **§22-8 自律的 token チェック（bud-20 学び）**
- §23 メモリー main 判断ルール

git fetch --all + 再読込推奨。

完走 / 区切り報告は bloom-004-N（次番号 56）で。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. 東海林さん PowerShell 代行完了（14:00 頃）

```powershell
cd C:\garden\a-bloom-004
Remove-Item -Path node_modules -Force -Confirm:$false  # Y で続行
npm install
# 524 packages, 26s, 2 moderate vulnerabilities
```

→ a-bloom-004 が独立 node_modules を保持、junction 解除完了。

### 1-2. RTK passthrough 問題 解消見込み

main- No. 118 で確定した root cause:
- a-main の node_modules に vitest 未 install + junction 経由解決不可
- a-bloom-004 は AA 案で独立 node_modules → vitest binary 直接解決

→ Step 3 vitest 動作確認で確定。

---

## 2. dispatch counter

- a-main-014: main- No. 135 → 次は **136**
- a-bloom-004: bloom-004- No. 55 受領済 → 次 bloom-004-56

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 118（AA 案 + 東海林さん別 PowerShell GO）| ✅ → 完了 |
| **main- No. 135（本書、npm install 完了通知 + Step 3-5 GO）** | 🟢 投下中 |
