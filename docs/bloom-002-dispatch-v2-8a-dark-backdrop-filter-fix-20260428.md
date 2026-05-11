# a-bloom-002 dispatch - v2.8a dark 透明度 第 3 弾（backdrop-filter 犯人特定） - 2026-04-28

> 起草: a-main-010
> 用途: a-bloom-002 への dispatch（dark 透明度問題の根本解決）
> 前提: a-main-009 → a-main-010 ハンドオフ書、dispatch v2.8a-dark-opacity-deep-dive-20260428、dispatch v2.8a-pixel-perfect-2nd-investigation-20260428
> 受領: Claude Chat（東海林さん経由、2026-04-28）からの回答

---

## 結論サマリ（東海林さん向け）

**透けすぎの原因は alpha 値ではなく、backdrop-filter（背景ぼかし）が効いていない** ことが判明。alpha を 0.94 まで上げても解決しなかったのが何よりの証拠。HTML 版で効いているぼかしが、Next.js 版では祖先要素のせいで無効化されている可能性が極めて高い。

**対応**: alpha は 0.55-0.7 に戻し、犯人の祖先要素を DevTools で特定して CSS 修正。

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
【a-main-010 から a-bloom-002 へ dispatch v2.8a 第 3 弾】

dark 透明度問題の根本原因が Claude Chat 回答で判明しました。
**alpha 値ではなく backdrop-filter が祖先要素で無効化されている** のが原因です。

詳細手順は a-main-010/docs/bloom-002-dispatch-v2-8a-dark-backdrop-filter-fix-20260428.md を読んでください。

要点：
1. localhost:3000 ダークで Activity Panel を DevTools 検証
2. Computed タブで backdrop-filter 値を確認 → blur(16px) になっているか
3. 祖先要素チェック JS（dispatch §調査手順 2 にあり）を Console に貼って犯人特定
4. 犯人 CSS（transform / filter / will-change / contain / perspective / isolation）を削除
5. alpha は元の 0.55-0.7 に戻す
6. 犯人を消せない場合の最終手段：各カード要素に isolation: isolate 付与

【a-bloom-002 がやること】
- Step 1: 上記 §調査手順 1 / §調査手順 2 を実行、犯人特定
- Step 2: 特定結果を a-main-010 経由で東海林さんに報告（A 案: CSS 削除 / B 案: isolation 付与 / C 案: 祖先構造変更）
- Step 3: 東海林さんの選択を受けて修正実装
- Step 4: alpha を 0.55-0.7 に戻す
- Step 5: localhost:3000 で東海林さん再確認
- Step 6: 解消したら commit + push（commit message に [dispatch v2.8a 第 3 弾] 含める）

【補足】
- Tailwind v4 preflight は無関係の可能性高、ただし globals.css を grep 必須
- hydration 遅延（data-theme 付与遅れ）は別問題、今回触らない
- 既存 commit 333ecef / d080e45 の alpha 強化は最終的に revert 想定（東海林さん再確認後）

レポート方式: a-bloom-002/docs/v2-8a-dark-backdrop-filter-investigation-report-20260428.md に犯人特定結果を書いて、a-main-010 に通知してください。
~~~

---

## §調査手順 1: DevTools での backdrop-filter 値確認

1. localhost:3000 を Chrome で開いてダークモードに切替
2. Activity Panel（右側の浮島）を右クリック → 検証
3. Elements タブで Activity Panel を選択
4. Computed タブでフィルタ Box に「backdrop-filter」と入力
5. 値が `blur(16px)` になっているか確認
   - ✅ なっている → 祖先のどれかが原因（→ §調査手順 2 へ）
   - ❌ なっていない → CSS 自体が効いていない（→ §補足 A: CSS 配線確認 へ）

## §調査手順 2: 祖先要素チェック（Console JS）

DevTools の Elements タブで Activity Panel を選択した状態で、Console タブに以下を貼って Enter：

```js
(() => {
  let el = document.querySelector('.activity-panel');
  const blockers = [];
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    const checks = {
      transform: cs.transform,
      filter: cs.filter,
      perspective: cs.perspective,
      willChange: cs.willChange,
      contain: cs.contain,
      isolation: cs.isolation
    };
    for (const [k, v] of Object.entries(checks)) {
      if (v && v !== 'none' && v !== 'auto' && v !== 'normal') {
        blockers.push({ tag: el.tagName, class: el.className, prop: k, value: v });
      }
    }
    el = el.parentElement;
  }
  console.table(blockers);
})();
```

→ console.table に出てくる要素が「犯人」。

## §解決策

### 1. alpha を元に戻す（必須）
- `--bg-card` の alpha を `0.55` または `0.7` に戻す（要 prototype 確認、prototype と同値が原則）
- 既存 commit `333ecef` (0.94) / `d080e45` (0.82) は実質 revert 扱い

### 2. 犯人要素の CSS を削除（推奨）
よくあるパターン：
- ThemeProvider ラッパーに `transform` / `will-change` が付いている
- body 直下の Next ラッパーに `contain: paint` が付いている
- レイアウト用 div に `overflow: hidden` が `border-radius` と組み合わさっている

### 3. 最終手段: `isolation: isolate` 付与
犯人要素を消せない場合、各カード要素自身にスタッキングコンテキストを作って祖先の影響を断ち切る：

```css
.activity-panel,
.topbar,
.sidebar,
.kpi-card,
.orb-card {
  isolation: isolate;
}
```

→ 自身のスタッキングコンテキストを作ることで祖先 transform 等の影響を回避できる。

## §補足 A: globals.css の事前 grep（必須）

a-bloom-002 worktree で以下を実行：

```bash
cd /c/garden/a-bloom-002
grep -nE "transform|filter|perspective|will-change|contain" src/app/globals.css
```

→ `@theme inline` 経由で意図せず transform 等が入っていないか確認。Tailwind v4 preflight 自体は怪しい CSS を入れていないが、念のため。

## §補足 B: hydration 遅延は別問題（今回触らない）

`data-theme` 付与が遅れて初期描画でライトモードになる現象は別の問題。透けすぎとは無関係。今回の dispatch では触らない。

---

## a-bloom-002 への進行指示（Step 順）

| Step | 内容 | 担当 | 成果物 |
|---|---|---|---|
| 1 | §調査手順 1 / §調査手順 2 / §補足 A grep 実行 | a-bloom-002 | 犯人特定結果（Console table スクショ含む）|
| 2 | 結果を `a-bloom-002/docs/v2-8a-dark-backdrop-filter-investigation-report-20260428.md` に記録 | a-bloom-002 | 報告書 |
| 3 | a-main-010 経由で東海林さんに報告（A 案: CSS 削除 / B 案: isolation 付与 / C 案: 祖先構造変更）| a-bloom-002 → a-main-010 | 東海林さん判断 |
| 4 | 採択案を実装、alpha を 0.55-0.7 に戻す | a-bloom-002 | code |
| 5 | localhost:3000 で東海林さん再確認 | 東海林さん | 視覚確認 OK |
| 6 | commit + push（msg に `[dispatch v2.8a 第 3 弾]` 含める）| a-bloom-002 | push 完了 |
| 7 | HTML/CSS 版にも同調整反映が必要か判断（Claude Chat 経由）| 東海林さん | 判断 |

## 改訂履歴

- 2026-04-28 初版（a-main-010、Claude Chat 回答受領後）
