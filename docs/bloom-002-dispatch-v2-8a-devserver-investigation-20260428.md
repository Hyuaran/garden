# a-bloom-002 dispatch - dev server 起動元特定 + a-bloom-002 worktree で再起動 - 2026-04-28

> 起草: a-main-010
> 用途: localhost:3000 の dev server 起動元を特定し、a-bloom-002 worktree で再起動
> 前提: Step 1 完了後、東海林さん視覚確認で「変わったように見えない」報告
> 仮説: dev server が a-bloom-002 以外の worktree（a-main-009 等）で起動中で、Step 1 編集が反映されていない可能性

---

## 結論サマリ

東海林さん視覚確認で「変わったように見えない」報告。原因切り分けのため、**dev server の起動元 worktree を特定**し、**a-bloom-002 worktree で再起動**してから再確認お願いします。

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
【a-main-010 から a-bloom-002 へ dispatch】

東海林さん視覚確認結果：「変わったように見えない」（KPI cards / Orb cards / Activity Panel すべて後ろの森が鮮明に透けたまま）。

ただし dev server が別 worktree（a-main-009 等）で動いていて Step 1 編集が反映されていない可能性が高いため、原因切り分けお願いします。

【調査 + 再起動 手順】

Step A: port 3000 の listener PID 特定
  netstat -ano | findstr :3000

  → 出力例: TCP 0.0.0.0:3000 ... LISTENING <PID>
  → PID をメモ

Step B: その PID がどの worktree から起動したか確認
  PowerShell で以下：
  Get-Process -Id <PID> | Select-Object Id, Path, StartTime
  Get-CimInstance Win32_Process -Filter "ProcessId=<PID>" | Select-Object CommandLine, ExecutablePath

  → CommandLine に worktree path が含まれていれば判定可能
  → node プロセスなので親 PowerShell も追う必要あれば：
  Get-CimInstance Win32_Process -Filter "ProcessId=<PID>" | Select-Object ParentProcessId
  Get-CimInstance Win32_Process -Filter "ProcessId=<親PID>"

Step C: 既存 dev server の処理判定

  C-1: 既存が a-bloom-002 worktree から起動している場合
    → hot reload が効いていない可能性 → Ctrl+C で停止 + 再起動
    → Step D へ

  C-2: 既存が a-bloom-002 以外の worktree（a-main-009 等）から起動している場合
    → 仮説確定。既存プロセスを停止：
       Stop-Process -Id <PID> -Force
    → Step D へ

  C-3: 既存プロセスが特定できない / 危険そう
    → 即停止せず、a-main-010 に報告（強制 kill のリスク判断）

Step D: a-bloom-002 worktree で dev server 起動
  cd /c/garden/a-bloom-002
  # background で起動推奨（前面占有しないため）
  # npm run dev を background task or 別 terminal で起動

Step E: 東海林さん再確認依頼
  - localhost:3000 を Ctrl+Shift+R で hard refresh
  - ダーク切替
  - KPI cards / Orb cards / Activity Panel のぼかし確認
  - 変化があれば → 仮説確定（dev server 問題）→ Step 3 commit + push へ
  - 変化がなければ → A 案不足 → 即停止して a-main-010 に報告 → B 案（isolation: isolate）検討

【完了報告 期待フォーマット】

a-main-010 に以下で報告：
1. Step A 結果（PID）
2. Step B 結果（起動元 worktree）
3. Step C 判定（C-1 / C-2 / C-3）
4. Step D 結果（再起動成功/失敗）
5. Step E 東海林さん視覚確認結果（変化あり/なし）

【注意】

- 既存 dev server を Stop-Process で停止する場合、その PowerShell shell に持っていた他の作業状態が消える可能性あり。判断迷ったら a-main-010 報告で止まる
- npm run dev を a-bloom-002 で起動する際、既に同 worktree で起動している場合は port 衝突で起動失敗する。netstat 結果で要判定
~~~

---

## 原因仮説と対応マップ

| 仮説 | 確度 | 検証方法 | 対応 |
|---|---|---|---|
| A. dev server が別 worktree | 高 | Step A-B | Step C-2: 停止 → Step D 再起動 |
| B. dev server は a-bloom-002 だが hot reload 不発 | 中 | Step A-B | Step C-1: 再起動 |
| C. A 案では SC 解消不足（他祖先も SC 形成）| 中 | Step E 後、変化なければ | B 案（isolation: isolate）検討 |
| D. browser cache | 低 | Step E hard refresh | Ctrl+Shift+R で解消 |

## 改訂履歴

- 2026-04-28 初版（a-main-010、東海林さん視覚確認「変化なし」報告後）
