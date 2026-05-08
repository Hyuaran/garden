# dispatch main- No. 118 — a-bloom-004（RTK vitest root cause 確定 + AA 案 + 東海林さん別 PowerShell 代行 GO）

> 起草: a-main-014
> 用途: a-bloom-004 bloom-004- No. 53 受領 + npm install 制約解釈 + AA 案推奨 + 東海林さん代行手順
> 番号: main- No. 118
> 起草時刻: 2026-05-08(金) 12:36

---

## 投下用短文（東海林さんが a-bloom-004 にコピペ）

~~~
🟢 main- No. 118
【a-main-014 から a-bloom-004 への dispatch（RTK vitest root cause 確定 + AA 案 + 東海林さん別 PowerShell 代行 GO）】
発信日時: 2026-05-08(金) 12:36

bloom-004- No. 53 受領、root cause 特定 ✅ 素晴らしい分析です。
**当初「RTK passthrough 問題」と推定していたが、実際は a-main の node_modules に vitest 未 install + junction 経由解決不可** = a-main の setup 不整合が真因と確定。

詳細は以下ファイル参照:
[docs/dispatch-main-no118-bloom-004-vitest-npm-install-decision-20260508.md](docs/dispatch-main-no118-bloom-004-vitest-npm-install-decision-20260508.md)

## root cause 確定（再確認）

- a-main の `node_modules/` に **vitest 未 install**
- a-bloom-004 は a-main への junction = vitest 解決不可
- a-bud / a-soil は **実体 node_modules** を持つため動作する
- bloom-004- No. 50 vitest 苦戦 + RTK passthrough は副次現象（真因は a-main setup 不整合）

## 判断: AA 案推奨 + 東海林さん別 PowerShell 代行

| 案 | 内容 | 推奨 |
|---|---|---|
| Z 案 | a-main で npm install（全 junction 反映）| 🟡 中（a-main は dispatch 起草中心、vitest 不要かも）|
| **AA 案** | **a-bloom-004 で junction 解除 + npm install** | 🟢 **推奨**（a-bud / a-soil と同構造）|
| BB 案 | vitest 関連のみ pinpoint install（--no-save）| 🟡 一時しのぎ |
| CC 案 | 制約解釈確認後採用 | ✅（本 dispatch で確認）|

## 制約「新規 npm install 禁止」の解釈

memory `project_npm_install_deny_workaround.md` 通り:
- **既存 package.json の依存を npm install するのは OK**（新規パッケージ追加ではない）
- ただし `.claude/settings.json` deny で対話セッション承認と衝突 = **東海林さん別 PowerShell 代行が標準運用**

→ AA 案で進める、東海林さんが別 PowerShell で代行実行。

## AA 案 実施手順

### Step 1: junction 解除（a-bloom-004 で実施、東海林さん別 PowerShell）

```powershell
cd C:\garden\a-bloom-004
Remove-Item node_modules -Force  # junction を削除
```

→ junction の場合、Remove-Item で junction 削除のみ（実体は a-main 側に残る）。

### Step 2: 独立 npm install（東海林さん別 PowerShell）

```powershell
cd C:\garden\a-bloom-004
npm install
```

→ a-bloom-004 内に独立した node_modules 構築、vitest 含む全依存解決。

### Step 3: 動作確認（a-bloom-004 セッション内）

```bash
npx vitest run --reporter verbose 2>&1 | tail -30
```

→ tests 実行確認、結果 stdout に表示。

### Step 4: 完走報告 + Phase A-2.1 続き着手

bloom-004-N で完走報告 → /bloom/progress 表示準備 + Phase A-2.1 残 task 着手。

## 影響範囲（要確認）

junction 解除 + 独立 install で:
- ✅ vitest 動作する
- ✅ a-bud / a-soil と同構造
- ⚠️ disk 容量増加（数百 MB）
- ⚠️ 5/8 中の他 worktree（a-bud / a-soil 等）には影響なし

## 5/8 a-bloom-004 タイムテーブル（修正）

| 時間 | タスク |
|---|---|
| 12:40 | 東海林さん別 PowerShell で junction 解除 + npm install（10 分）|
| 12:50 | a-bloom-004 で vitest 動作確認 + tests 実行 |
| 13:00 | Phase A-2.1 残 task 着手 + /bloom/progress 表示準備 |
| 17:00 | 完走報告 |

## 自走判断 GO 範囲

- AA 案 実施は 東海林さん別 PowerShell 代行（一度きり、セットアップ）
- セットアップ完了後、Phase A-2.1 残 task / /bloom/progress 準備は自走 OK
- 苦戦 / 設計判断必要 → 即 bloom-004-N で a-main-014 経由

## 副次対応: RTK vitest passthrough 問題

a-bloom-004 で AA 案実施後、`rtk vitest run` の passthrough 問題は **副次的**（a-bud / a-soil で既に動作中なので、parser 改善は別件）。
- RTK 担当（東海林さん本人）の判断は別途
- a-bloom-004 は AA 案で動作可能になる

## 制約遵守（再掲）

- 動作変更なし（既存コードは触らない）
- **新規 npm install OK**（既存 package.json の依存解決、新規パッケージ追加ではない）
- 東海林さん別 PowerShell 代行（dev は対話セッション承認）
- Bloom 独立認証独立性維持

完走 / 区切り報告は bloom-004-N（次番号 54）で。
~~~

---

## 1. 背景

### 1-1. bloom-004- No. 53 受領（12:33）

a-bloom-004 起動報告 + RTK vitest root cause 確定:
- ✅ a-main の node_modules に vitest 未 install と特定
- ✅ a-bud / a-soil は実体 node_modules を持つため動作
- ⚠️ a-bloom-004 単独では解決不可、東海林さん作業が必要

### 1-2. 私の判断（AA 案 + 東海林さん別 PowerShell 代行）

- AA 案（a-bloom-004 独立 node_modules）が a-bud / a-soil precedent と整合
- Z 案（a-main で install）は a-main 側の影響大、不要な install
- BB 案（pinpoint）は一時しのぎ
- 「新規 npm install 禁止」は **新規パッケージ追加禁止**であり、既存依存の解決はOK
- 東海林さん別 PowerShell 代行は memory `project_npm_install_deny_workaround.md` 標準運用

---

## 2. dispatch counter

- a-main-014: main- No. 118 → 次は **119**
- a-bloom-004: bloom-004- No. 53 受領 → 次 bloom-004-54

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 103（5/8 朝 起動 + RTK vitest 解決優先、改訂版）| ✅ 投下済 |
| **main- No. 118（本書、AA 案 + 東海林さん別 PowerShell GO）** | 🟢 投下中 |
