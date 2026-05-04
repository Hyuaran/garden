# a-bloom-002 dispatch - 祖先 SC 追加犯人特定 + B 案実装準備 - 2026-04-28

> 起草: a-main-010
> 用途: A 案では SC 解消不足、追加犯人を Console JS で特定 → B 案 (isolation: isolate) or 追加 CSS 修正実装
> 前提: dev server 再起動後の東海林さん再確認で「変わらないような」報告（alpha は 0.55 に正しく反映、ぼかし依然不発）
> 結論: A 案単独では不足、他祖先要素も SC 形成中

---

## 結論サマリ

A 案（`.garden-v28a-main` z-index 削除）では祖先 SC 解消が不足。alpha は正しく 0.55 に戻ったが backdrop-filter は依然無効。**追加の祖先 SC 形成元を Console JS で特定**し、対応します。

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
【a-main-010 から a-bloom-002 へ dispatch】

A 案では足りませんでした。alpha は 0.55 に正しく反映されているがぼかし依然不発。
追加の祖先 SC 形成元を Console JS で特定します。

【Step F: 東海林さんに Console JS 貼り付けて実行してもらう】

東海林さん依頼短文（a-bloom-002 が a-main-010 経由で東海林さんに依頼）：

  1. localhost:3000 ダーク状態で F12 押して開発者ツール開く
  2. Console タブをクリック
  3. 以下の JS を全選択コピー → Console に貼って Enter

  (() => {
    const targets = ['.kpi-card', '.orb-card', '.activity-panel'];
    const result = {};
    for (const sel of targets) {
      let el = document.querySelector(sel);
      if (!el) { result[sel] = 'NOT FOUND'; continue; }
      const blockers = [];
      const cs0 = getComputedStyle(el);
      result[sel + '_self_backdropFilter'] = cs0.backdropFilter || cs0.webkitBackdropFilter;
      while (el && el !== document.documentElement) {
        const cs = getComputedStyle(el);
        const checks = {
          transform: cs.transform,
          filter: cs.filter,
          perspective: cs.perspective,
          willChange: cs.willChange,
          contain: cs.contain,
          isolation: cs.isolation,
          mixBlendMode: cs.mixBlendMode,
          opacity: cs.opacity !== '1' ? cs.opacity : null
        };
        for (const [k, v] of Object.entries(checks)) {
          if (v && v !== 'none' && v !== 'auto' && v !== 'normal' && v !== null) {
            blockers.push({ tag: el.tagName, class: (el.className || '').toString().slice(0, 80), prop: k, value: v });
          }
        }
        el = el.parentElement;
      }
      result[sel + '_blockers'] = blockers;
    }
    console.log(JSON.stringify(result, null, 2));
    return result;
  })();

  4. 出力結果を全選択 → コピー → a-main-010 に貼って渡す

【Step G: 結果分析と対応案】

a-bloom-002 が結果を分析：
  - .kpi-card_self_backdropFilter が "none" → CSS 配線問題 → 別調査
  - .kpi-card_self_backdropFilter が "blur(8px)" → SC 形成元あり、blockers から犯人特定
  - blockers に共通する要素（複数 selector で出る）が真の犯人

【Step H: B 案 (isolation: isolate) 検討前の追加 A 案】

犯人が判明したら、その要素の SC 形成 CSS を削除（A 案の延長）。
削除できない場合（外部依存 / Tailwind preflight 等）→ B 案 (isolation: isolate) に進む。

【Step I: B 案実装（A 案延長で解決しない場合）】

src/app/globals.css に以下追加：

  .activity-panel,
  .topbar,
  .sidebar,
  .kpi-card,
  .orb-card {
    isolation: isolate;
  }

→ 各カード自身に SC を作って祖先影響を断ち切る。

【完了報告 期待フォーマット】

a-main-010 に以下で報告：
1. Step F 結果（東海林さん受領後、JSON 出力をそのまま渡す）
2. Step G 分析結果（self_backdropFilter 値 + 犯人候補 list）
3. Step H or I のどちらに進むか判断
4. 実装後の Step E 再確認（東海林さん再依頼）
~~~

---

## 詳細手順

### Step F: Console JS（祖先全列挙 + self backdrop-filter 値確認）

東海林さんが Console に貼って Enter するだけ。出力を a-main-010 に貼って戻す。

### Step G: 分析パターン

| `_self_backdropFilter` 値 | 解釈 | 次手 |
|---|---|---|
| `none` または空 | CSS 自体が要素に届いていない（配線問題）| Tailwind utility / globals.css 競合確認 |
| `blur(8px)` | CSS は届いている、祖先が SC 形成して効果無効化 | blockers list から共通犯人特定 → 削除 or isolation |

`blockers` list の中で、**3 selector（`.kpi-card`, `.orb-card`, `.activity-panel`）すべてに共通して出る要素**が真の犯人。

### Step H/I 分岐

- 犯人が globals.css 内の Garden 自製 CSS → 削除（A 案延長）
- 犯人が Tailwind preflight / Provider ラッパー / 外部依存 → 削除困難 → B 案 (`isolation: isolate`) で各 card の SC を強制形成

## 改訂履歴

- 2026-04-28 初版（a-main-010、A 案不足判定後）
