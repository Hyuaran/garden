# a-bloom-002 dispatch - Step K CSS 配線レベル調査（Turbopack/Tailwind/specificity） - 2026-05-01

> 起草: a-main-010
> 用途: Step J A 案で祖先 SC + self transform は完全解消したが、_self_backdropFilter が依然 "none"。CSS 配線レベルの真因調査
> 前提: Step J A 案実装済（@keyframes fadeUp から transform 削除）、Console JS 出力で blockers 空 + self none 確認

---

## 状況サマリ

### Console JS 出力（東海林さん再実行、2026-05-01）

```json
{
  ".kpi-card_self_backdropFilter": "none",
  ".kpi-card_blockers": [],
  ".orb-card_self_backdropFilter": "none",
  ".orb-card_blockers": [],
  ".activity-panel_self_backdropFilter": "none",
  ".activity-panel_blockers": []
}
```

### 重要発見

| # | 発見 | 解釈 |
|---|---|---|
| 1 | `_blockers: []` 全 3 selector | ✅ **Step J A 案成功** = 祖先 SC + self transform 完全解消 |
| 2 | `_self_backdropFilter: "none"` 依然継続 | ❌ それでも CSS が "none" 判定 = **CSS 配線レベルに真因** |

→ a-bloom-002 の compositor layer 仮説（Step J 時点）は **外れ**。真因は別。

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
【a-main-010 から a-bloom-002 へ Step K CSS 配線調査依頼】

東海林さん Console JS 再実行結果：

  ".kpi-card_self_backdropFilter": "none",
  ".kpi-card_blockers": [],
  ".orb-card_self_backdropFilter": "none",
  ".orb-card_blockers": [],
  ".activity-panel_self_backdropFilter": "none",
  ".activity-panel_blockers": []

【判明事実】
1. blockers 全空 → Step J A 案成功、祖先 SC + self transform 完全解消
2. _self_backdropFilter: "none" 依然 → CSS 配線レベルに真因（compositor 仮説外れ）

【新仮説（優先順）】

仮説 A: Turbopack hot reload バグ（CSS 編集が bundle に反映されていない） — 最有力
仮説 B: Tailwind v4 preflight の再精査漏れ（@layer base 以外で reset）
仮説 C: CSS specificity 競合（別 rule が backdrop-filter: none を勝ちで設定）
仮説 D: inline style で上書き（page.tsx で style={{ backdropFilter: 'none' }} 等）
仮説 E: Chrome の backdrop-filter 機能無効（chrome://flags 等）— 極低

【Step K 実施手順】

Step K-1: dev server 完全再起動 + Turbopack キャッシュクリア（仮説 A 検証）
  cd /c/garden/a-bloom-002
  # 既存 dev server 停止（task ID b5s4ukj5a）
  Stop-Process -Id 9380 -Force  # PID 9380 (current)
  # Turbopack キャッシュクリア
  Remove-Item -Recurse -Force .next  # build cache
  # 再起動
  npm run dev  # background

Step K-2: Tailwind v4 全 layer 精査（仮説 B 検証）
  grep -rn "backdrop" node_modules/tailwindcss/ 2>/dev/null | head -30
  # 特に @layer base 以外（utilities / components / theme）も確認
  # @import で chained file も追跡

Step K-3: CSS specificity 競合確認（仮説 C 検証）
  # globals.css 全件で backdrop-filter, backdrop-blur 含む rule 列挙
  grep -nE "backdrop" src/app/globals.css

  # 最終 compiled CSS bundle 確認（Turbopack 出力）
  ls -la .next/static/css/
  # 各 CSS ファイル内の backdrop-filter 箇所確認

Step K-4: inline style 確認（仮説 D 検証）
  grep -rnE "backdropFilter|backdrop-filter" src/app/page.tsx src/app/_components/ 2>/dev/null
  # ThemeProvider 等で動的 style がないか確認

Step K-5: 別 selector で backdrop-filter test（仮説 E 検証）
  # globals.css に test rule 一時追加:
  body { backdrop-filter: blur(20px) !important; }
  # body の Computed が "blur(20px)" になるか確認 → ならない場合 Chrome 機能無効

【完了報告期待】
1. Step K-1 後の Console JS 再実行結果（_self_backdropFilter 値変化したか）
2. Step K-2-K-5 の調査結果
3. 真因確定 + 対応案実装
4. 東海林さん再確認 → OK なら commit + push

【補足】
- Step K-1（dev server 再起動）が解決すれば 1 分で完了
- それでもダメなら K-2 以降の体系的調査
- 5/5 デモで Next.js 版を出す方針継続中、ぼかし完璧復活が最優先
~~~

---

## 詳細手順（参考）

### Step K-1: dev server 完全再起動

```powershell
# PID 確認
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id, StartTime

# 停止
Stop-Process -Id 9380 -Force

# キャッシュクリア
Remove-Item -Recurse -Force .next

# 再起動（background）
npm run dev
```

### Step K-2: Tailwind v4 全精査

```bash
grep -rn "backdrop" node_modules/tailwindcss/ 2>/dev/null

# 特に確認すべきファイル:
# - node_modules/tailwindcss/dist/*.css
# - node_modules/tailwindcss/preflight.css
# - node_modules/tailwindcss/index.css（@import 全追跡）
# - node_modules/tailwindcss/theme.css
# - node_modules/tailwindcss/utilities.css

# tailwind.config / postcss.config も確認
cat tailwind.config.* 2>/dev/null
cat postcss.config.* 2>/dev/null
```

### Step K-3: 最終 compiled CSS 確認

```bash
ls -la .next/static/css/
# 各 CSS file 内 backdrop-filter 検索
for f in .next/static/css/*.css; do
  echo "=== $f ==="
  grep -n "backdrop" "$f"
done
```

### Step K-4: inline style 確認

```bash
grep -rnE "backdropFilter|backdrop-filter|backdrop-blur" src/ 2>/dev/null
```

### Step K-5: body での backdrop-filter test

`globals.css` に一時追加:
```css
/* TEST: 削除予定 */
body { backdrop-filter: blur(20px) !important; }
```

→ Console JS で `getComputedStyle(document.body).backdropFilter` 値確認:
- `"blur(20px)"` → backdrop-filter は機能している、別の理由で `.kpi-card` だけ無効化
- `"none"` → Chrome 機能レベルで無効化

## Step K 後の Step L

- Step K で真因特定 + 対応 → 東海林さん再確認 → commit + push
- それでも解決しなければ Step L: HTML 構造変更 / 別ライブラリ等の根本対応

## 改訂履歴

- 2026-05-01 初版（a-main-010、Console JS 出力で compositor 仮説外れ判明後）
