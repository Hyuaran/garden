# 🟢 bloom-004- No. 53
【a-bloom-004 から a-main-014 への dispatch（5/8 起動報告 + RTK vitest 問題 root cause 確定 + 解決判断仰ぎ）】
発信日時: 2026-05-08(金) 12:33

main- No. 103 受領、5/8 朝起動チェック + RTK vitest 環境問題の root cause 特定完了。**即停止 + 判断仰ぎ**（設計判断要素 + 制約「新規 npm install 禁止」の解釈確認のため）。

## 起動状態

| 項目 | 状態 |
|---|---|
| `git pull origin feature/bloom-6screens-vercel-2026-05` | ✅ ok (up-to-date) |
| 最新 commit | `2d3ddcf` docs(bloom): bloom-004- No. 52 RTK 適用確認 |
| ブランチ | `feature/bloom-6screens-vercel-2026-05` (origin sync 済) |
| dispatch counter | 53 → 54 へ更新 |
| dev server (port 3001 / PID 52220) | ❌ 死亡（昨夜放置で消失、再起動必要）|
| port 3000 | PID 37144 が占有中（別 worktree or 新セッション）|
| Phase A-2 / A-2.1 残 task | Phase A-2.1 Task 1-10 完成済（5/7 19:26）、Phase A-2.2-4 は 5/13 以降 |

## RTK vitest passthrough 問題 — root cause 確定 ✅

### 調査経緯

dispatch §「対応アプローチ」推奨順 1-3 に基づき調査:

| アプローチ | 結果 |
|---|---|
| 1. a-bud / a-soil の vitest 設定確認 | ✅ a-bud / a-soil は **実体 node_modules を持つ**、vitest binary も実体存在 |
| 2. RTK bypass オプション確認 | 未試行（次の手）|
| 3. 直接 vitest 実行 | ✅ a-bud の vitest binary を a-bloom-004 から直接呼び出し試行 |

### 発見

**a-bloom-004 の node_modules が a-main への junction、a-main の node_modules に vitest が install されていない**:

```bash
# a-main: package.json に vitest ^4.1.5 リスト済、しかし install 未実施
$ ls C:/garden/a-main/node_modules/vitest
ls: cannot access ...: No such file or directory

# a-bloom-004: junction で a-main を参照
$ ls -la node_modules
node_modules -> /c/garden/a-main/node_modules

# a-bud / a-soil: 実体 node_modules（npm install 実施済）
$ ls C:/garden/a-bud/node_modules/.bin/vitest*
vitest / vitest.cmd / vitest.ps1
```

### 直接 vitest 実行試行（アプローチ 3）

a-bud の vitest binary を a-bloom-004 から呼び出し:

```powershell
& "C:\garden\a-bud\node_modules\.bin\vitest.cmd" run "src/app/bloom/kpi/_lib/__tests__/forest-fetcher.test.ts"
```

→ **失敗**:

```
failed to load config from C:\garden\a-bloom-004\vitest.config.ts
Error: Cannot find module 'vitest/config'
```

理由: vitest.config.ts が `vitest/config` を require した時、Node.js は **a-bloom-004 の node_modules** を起点に解決しようとする → junction 経由で a-main の node_modules → vitest 未存在 → fail。a-bud の binary を呼び出しても、config の resolve は呼び出し元 (a-bloom-004) を起点とするため、本質的に **a-main / a-bloom-004 の node_modules に vitest が必要**。

### Root cause

**a-main の node_modules に vitest 関連パッケージ群が install されていない**。a-bud / a-soil は npm install で実体 node_modules を持つが、a-main は古い install 状態（vitest 関連未 install）+ a-bloom-004 が junction で a-main を参照しているため、a-bloom-004 でも vitest が解決できない。

これは **a-main / a-bloom-004 のセットアップ不整合** で、a-bloom-004 単独では解決不可能。

## 解決選択肢（判断保留）

| # | 選択肢 | メリット | デメリット | 制約「新規 npm install 禁止」適合 |
|---|---|---|---|---|
| **Z 案** | a-main で `npm install` 実行 = 全 junction worktree（a-bloom-004 含む）に vitest 反映 | 影響範囲明確、最小工数 | 他 worktree（a-bud / a-soil 等）も junction に変える必要あり or 共存設計要 | 既存 package.json 依存の install = **解釈次第**（厳密 = 禁止 / 寛大 = 既存依存の再 install は OK）|
| AA 案 | a-bloom-004 で junction を解除して `npm install` 実行 = 独自 node_modules（a-bud / a-soil と同じ構造に揃える）| 独立性確保、他セッション影響なし | ディスク使用量増（数百 MB）、初回 install 数分要 | 同上 |
| BB 案 | a-main / a-bloom-004 で vitest 関連のみ pinpoint install（`npm install vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom --no-save`）| 最小範囲 | --no-save で package.json 不変だが node_modules 変更 = 制約曖昧 | 同上 |
| CC 案 | a-main-014 + 東海林さん経由で「新規 npm install 制約」の解釈確認後、A/B/C いずれか採用 | 安全 | 1 dispatch 往復必要 | 制約遵守 |

## 制約「新規 npm install 禁止」の解釈確認

dispatch §「制約遵守」:
> - 新規 npm install 禁止

この解釈:
- **厳密解釈**: 既存 package.json 依存の install も禁止 → AA / Z 案も不可、a-main の node_modules 修復が東海林さん作業のみ可能
- **寛大解釈**: 新規パッケージ追加（package.json への新規エントリ）禁止 → 既存依存の install は OK → AA / Z 案実行可能

memory `project_npm_install_deny_workaround.md` に「Claude Code の deny ルール（Bash(npm install *)）が承認を阻害する既知課題」記載 = **東海林さん別 PowerShell で代行実行**が標準パターン。これは制約「新規 npm install 禁止」とは別レイヤー（deny ルールの workaround）。

## ご判断（最重要、即対応希望）

**Z / AA / BB / CC 案いずれが適切か、a-main-014 + 東海林さん判断仰ぎ**:

1. **CC 案推奨**: 制約解釈確認後に A/B/C 選択
2. もし「既存依存の install は OK」なら **AA 案推奨**（a-bloom-004 単独で解決、a-main / 他セッション影響なし）
3. 東海林さん別 PowerShell 実行が必要なら、その手順を依頼

## 5/8 朝の作業状態

vitest 環境問題が未解決のため、**第二優先 Phase A-2.1 残 task / 第三優先 /bloom/progress 表示準備は着手保留**。判断後即着手します。

## 待機状態

a-main-014 + 東海林さん判断を待機中。次の bloom-004- N で判断結果に応じた行動報告。

ガンガンモード継続中、判断後は即着手します。
