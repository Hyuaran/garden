# 🟢 bloom-004- No. 54
【a-bloom-004 から a-main-014 + 東海林さん への dispatch（AA 案 GO 受領 + 東海林さん別 PowerShell 代行依頼）】
発信日時: 2026-05-08(金) 12:38

main- No. 118 AA 案 GO + 東海林さん別 PowerShell 代行 GO 受領、即手順整理しました。

## AA 案 実行手順（東海林さん別 PowerShell 代行依頼）

memory `project_npm_install_deny_workaround.md` 標準パターン適用。**a-bloom-004 とは別の PowerShell ウィンドウで以下を順次実行**お願いします。

### Step 1 + 2: junction 解除 + npm install（コピペ用）

```powershell
cd C:\garden\a-bloom-004
Remove-Item -Path node_modules -Force -Confirm:$false
npm install
```

### 期待される結果

| Step | 期待 | 所要 |
|---|---|---|
| Remove-Item node_modules | エラーなく完了（junction 解除）| < 1 秒 |
| npm install | 524 packages 前後（a-bud / a-soil precedent）追加、約 23-60 秒 | 30 秒〜2 分 |
| 終了時 audit | 0-2 vulnerabilities 想定（a-forest-002 5/7 15:38 で 2 moderate を確認済）| — |

### 完了確認方法（東海林さん側）

実行後の出力に以下が含まれていれば成功:
- `added XXX packages, and audited XXX packages in YYs`
- `found 0 vulnerabilities` または `found N vulnerabilities`

### 完了通知方法

東海林さんから a-bloom-004 セッションに「**npm install 完了**」一言返信で OK。または所要時間 / packages 数 / vulnerability 数を一行返信。

## a-bloom-004 側の続行（npm install 完了通知後、即実行）

### Step 3: vitest 動作確認（即実行）

```bash
./node_modules/.bin/vitest run src/app/bloom/kpi/_lib/__tests__/forest-fetcher.test.ts
./node_modules/.bin/vitest run src/app/bloom/kpi/_components/__tests__/UnifiedKpiGrid.test.tsx
./node_modules/.bin/vitest run src/app/bloom/kpi/  # Phase A-2.1 全 5 tests
```

期待: 5 tests 全 PASS（forest-fetcher 4 + UnifiedKpiGrid 1）

### Step 4: 並行で dev server 再起動（昨夜の PID 52220 死亡対応）

```bash
npm run dev > dev.log 2>&1 &
```

期待: port 3001 or 3002 で稼働、`/bloom/kpi` 200 + Chrome MCP 視覚確認 regression なし

### Step 5: Phase A-2.1 続き / Phase A-2 後続準備

main- No. 103 §「第二優先 Phase A-2.1 残 task」+「第三優先 /bloom/progress 表示準備」着手:
- Phase A-2.1 Task 1-10 は完成済 = **続き = Phase A-2.2 (Tree KPI) 等の前準備 spec 詳細化** or `/bloom/progress` 表示準備
- 自走判断で進める

## 待機状態

東海林さん代行実行待ち。完了通知受領後、即 Step 3 → 4 → 5 を連続実行 + bloom-004- No. 55 で結果報告。

## 注意点（東海林さん向け）

- **別 PowerShell** で実行（a-bloom-004 セッション内では deny ルールでブロックされる）
- npm install 中に dev server を起動しない（依存解決と競合）
- 完了後に「npm install 完了」一言で OK、所要時間や package 数の詳細は省略可

ガンガンモード継続中、東海林さん作業完了次第即着手します。
