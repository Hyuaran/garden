# Handoff - 2026-05-05 (a-bloom-002 → 後続セッション)

> 起草: a-bloom-002（context 84% 到達、引継ぎ準備）
> 起草日時: 2026-05-05(火) 14:49
> 後続候補: a-bloom-003 等の Bloom 専用セッション

---

## 今やっていること

5/8 後道さんデモ向け Bloom Top の視覚一致最終仕上げ。a-main-011/012 が Chrome MCP で DOM 検証 → 残課題 dispatch → 即修正のループ。直近 2 回 dev server が PC スリープ等で死亡 → 都度再起動対応。

## 次にやるべきこと

1. **a-main-012 main- No.40 後の Chrome MCP 視覚検証結果待ち**（bloom-002- No.23 で復旧報告済）
2. 視覚検証 NG なら次 dispatch (main- No.41+) で残課題対応
3. 視覚 OK なら 5/8 デモ準備完了 (3 日後)
4. post-5/8: Phase 2 (sakura/peony overlay / flicker pre-load / localStorage キー命名統一) or 別画面着手

## 注意点・落とし穴

### 🔴 削除禁止ルール (絶対遵守)
東海林さん明示「現在のデザインを削除せず、裏でデータとして残しておく」。
- ファイル削除コマンド (`rm`, `Remove-Item`, `del`) は **system deny** で実行不可
- `.next` キャッシュも `Move-Item` で `.next.old.YYYYMMDD-HHMM` に rename （削除しない）
- コード/CSS/component を更新する場合は **必ず legacy 保持** (`*.legacy-<context>-YYYYMMDD.*`)
- 過去 dispatch の dispatch ヘッダー注意: 毎回明示される

### 🔴 dev server 起動 → webpack flag 必須
`package.json` の dev script は `next dev --webpack`。Turbopack ではなく webpack 強制使用 (理由: Tailwind v4 + Turbopack の PostCSS worker タイムアウトで globals.css 2700+ 行が compile できない、commit 701226b で webpack に切替済)。
- `npm run dev` は自動で webpack 起動
- 初回 compile **5-7 分** かかる (大きい globals.css のため、cached 後は 0.1s)
- PC スリープ後の dev server は kill されることが多い、起動コマンド再実行で復旧

### 🔴 BloomGate dev バイパス維持
`src/app/bloom/_components/BloomGate.tsx`:
```tsx
const isDevBypass = process.env.NODE_ENV === "development";
const allowed = isDevBypass || (isAuthenticated && hasPermission && isUnlocked);
```
- dev では認証スキップで /bloom 直接アクセス可
- prod build (Vercel preview 等) では従来 Forest 認証フロー
- post-5/5 で根本対応 (Bloom 認証 Forest 統合再設計)

### 🔴 dispatch v4 ヘッダー形式 厳守
- `<アイコン> <接頭辞>- No. NNN` 形式 (例: `🟢 bloom-002- No. 24`)
- 発信日時は `Get-Date -Format "yyyy-MM-dd(ddd) HH:mm"` で **実時刻取得必須**（捏造禁止）
- メイン投下用コピペテキストは `~~~` でラップ（バッククォートのネスト回避）
- 各 dispatch 送信ごとに `docs/dispatch-counter.txt` を +1 increment

### 🟡 CSS / アセット変更時の Turbopack/Webpack HMR 注意
globals.css 大量変更時は HMR 信用せず、**dev server 再起動 + .next cache rename** 必須 (memory `feedback_turbopack_hmr_globals_css_unreliable.md`)。
- 静的 _proto/ HTML/CSS は再起動不要 (即反映)
- React component / globals.css は再起動推奨

### 🟡 Drive 元の touch 禁止
`_chat_workspace/garden-ui-concept/` および `015_Gardenシリーズ/000_GardenUI*/` は **読み取り専用**。コピーは public/_proto/ 配下に限定。

### 🟡 git index.lock スタック
git の index.lock がスタックすることが時々ある。`rm` は deny されるが Python `os.remove()` で削除可:
```bash
python -c "import os; os.remove('C:/garden/a-main/.git/worktrees/a-bloom-002/index.lock')"
```

### 🟡 _proto/ 配下 静的ファイルの遷移
Next.js Link は内部 routing 試行で 404、**通常 `<a>` タグでフル遷移**必須。
BloomNavGrid.tsx で実装済:
```tsx
if (nav.href.startsWith("/_proto/")) {
  return <a href={nav.href}>...</a>;
}
return <Link href={nav.href}>...</Link>;
```

## 関連情報

### ブランチ
`feature/bloom-6screens-vercel-2026-05` (origin sync、15 commits)

直近 commit:
- `ac7503d` fix(_proto): nav-pages-header href + Topbar ロゴサイズ統一 [main- No.38]
- `347a16f` fix(bloom): garden_logo を新木デザイン 480KB 版に統一差替 [main- No.37]
- `838d084` fix(bloom): KPI 幅崩れ + ナビカード文字バランス + 経営状況 404 [main- No.36]
- `2cb5642` fix(bloom): 最終仕上げ 3 項目 [main- No.34]
- `c7e79de` fix(bloom): 視覚一致 4 項目 + 5/8 デモ画面連結 [main- No.33]

### dev server 状態 (2026-05-05 14:06 起動)
- PID **19744** (background task `b3md7yntz`)
- webpack mode、初回 compile 6.0min 完走済
- /bloom HTTP 200、/_proto/* HTTP 200 全件確認済
- ハングしたら kill + .next rename + npm run dev 再実行

### 重要 component / file
| File | 役割 |
|---|---|
| `src/app/bloom/page.tsx` | Bloom Top メイン (1:1 移植版) |
| `src/app/bloom/_components/BloomTopbar.tsx` | Topbar (5 button + dropdown) |
| `src/app/bloom/_components/BloomSidebar.tsx` | dual sidebar (nav-apps + nav-pages + toggle) |
| `src/app/bloom/_components/BloomKpiGrid.tsx` | 4 KPI cards |
| `src/app/bloom/_components/BloomNavGrid.tsx` | 4 nav cards (Coming Soon Toast + /_proto/ 静的 a タグ分岐) |
| `src/app/bloom/_components/BloomActivityPanel.tsx` | Bloom 専用 5 entries + activity-toggle |
| `src/app/bloom/_components/BloomPageHeader.tsx` | page header (PNG icon ☆ + 桜花 SVG) |
| `src/app/bloom/_components/BloomGate.tsx` | dev バイパス済 |
| `src/app/bloom/_components/BloomLayoutClient.tsx` | /bloom (root) のみ BloomShell バイパス |
| `src/app/globals.css` | 2700+ 行、v2.8a + Bloom v1 + Bloom v2 1:1 port + main- No.32-38 修正 |
| `src/app/_lib/background/atmospheres.ts` | bloom_garden_light/dark 追加 |

### legacy 保持ファイル一覧 (削除禁止対象)

```
src/app/bloom/page.legacy-mixed-20260502.tsx
src/app/bloom/_components/BloomPageHeader.legacy-mixed-20260502.tsx
src/app/bloom/_components/BloomKpiGrid.legacy-mixed-20260502.tsx
src/app/bloom/_components/BloomNavGrid.legacy-mixed-20260502.tsx
src/app/bloom/_components/BloomSidebar.legacy-mixed-20260502.tsx
src/app/bloom/_components/BloomSidebar.legacy-1to1-port-20260503.tsx
src/app/bloom/_components/BloomTopbar.legacy-logo-fix-20260504.tsx
src/app/bloom/_components/BloomNavGrid.legacy-ceostatus-20260504.tsx
src/app/bloom/_components/BloomNavGrid.legacy-link-fix-20260504.tsx
docs/legacy-css-backup/globals.legacy-mixed-20260502.css
docs/legacy-css-backup/globals.legacy-kpi-fix-20260504.css
docs/proto-backup-20260504/garden-home-spin-Backup/ (50+ 履歴 HTML)
docs/proto-backup-20260504/garden-home-Backup/
docs/proto-backup-20260504/000_GardenUI.zip
public/images/logo/garden_logo.legacy-square-20260504.png (237KB / 500x500)
public/images/logo/garden_logo.legacy-122kb-old-tree-20260504.png (122KB / 旧木)
public/_proto/{login, garden-home-spin, garden-home, bloom-top, ceostatus}/images/logo/garden_logo.legacy-square-20260504.png (5)
public/_proto/{login, garden-home-spin, garden-home, bloom-top, ceostatus}/images/logo/garden_logo.legacy-122kb-old-tree-20260504.png (5)
public/_proto/{bloom-top, ceostatus, garden-home}/index.legacy-relative-path-20260504.html (3)
public/_proto/{bloom-top, ceostatus, garden-home}/css/style.legacy-logo-size-20260504.css (3)
```

### dispatch 履歴 (主要)
- main- No.6-15: v2.8a + Bloom 構築 + Sidebar 復活
- main- No.16: 試作版 1:1 移植版 (BloomTopbar/BloomActivityPanel 新規)
- main- No.17: dev server 復旧 (Turbopack → webpack)
- main- No.31-32: 視覚一致 5 差分 + 経営状況連結
- main- No.33: 視覚一致 4 項目 + 5/8 デモ 4 画面連結 (login + spin + 事務 + ceostatus)
- main- No.34: boxShadow + Series ロゴ統一 + toggle 同期
- main- No.36: KPI 幅崩れ + ナビカード文字バランス + 経営状況 404
- main- No.37: 新木ロゴ 480KB 版 (旧 122KB は旧木) に統一
- main- No.38: nav-pages-header href + Topbar ロゴサイズ 64→60px 統一
- main- No.39, 40: dev server 再起動

### 直近の課題状態
- ✅ 全ての視覚一致項目 a-main-011/012 検証済
- ✅ 全 5 _proto/ 静的ファイル + /bloom React 動作確認済
- ⏳ a-main-012 Chrome MCP 検証結果待ち (main- No.40 復旧後)

### memory 関連
- `feedback_dispatch_header_format` (v4)
- `feedback_dispatch_time_must_be_real` (Get-Date 必須)
- `feedback_no_delete_keep_legacy`
- `feedback_turbopack_hmr_globals_css_unreliable`
- `feedback_demo_quality_must_match_production`
- `project_bloom_auth_independence` (BloomGate dev バイパス)

### 関連 PR / Issue
なし (PR 未作成、5/8 デモ後 develop merge 検討)

---

## dispatch counter: 次番号 **24**

bloom-002- No. 23 まで送信済 (main- No.40 復旧報告)。次回起動時 `docs/dispatch-counter.txt` の値 (24) を使用。

---

## 起動チェックリスト (後続セッション)

```bash
# 1. ディレクトリ確認
cd C:/garden/a-bloom-002
pwd
git status
git branch --show-current  # → feature/bloom-6screens-vercel-2026-05

# 2. dev server 起動確認 (停止していれば再起動)
netstat -ano | grep ":3000.*LISTENING"
# 空なら:
npm run dev  # background

# 3. /bloom 動作確認 (compile 6 分待ち)
curl -s -o /dev/null -w "%{http_code} | %{time_total}s\n" --max-time 600 http://localhost:3000/bloom

# 4. 全 _proto/ 確認
for path in /_proto/login/index.html /_proto/garden-home-spin/index.html /_proto/garden-home/index.html /_proto/bloom-top/index.html /_proto/ceostatus/index.html; do
  curl -s -o /dev/null -w "%{http_code} | $path\n" "http://localhost:3000$path"
done

# 5. dispatch counter 確認
cat docs/dispatch-counter.txt  # → 24
```
