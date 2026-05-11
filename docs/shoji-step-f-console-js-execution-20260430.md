# 東海林さん操作: Console JS 実行依頼（v2.8a 第 3 弾 祖先 SC 調査）

> 目的: a-bloom-002 が静的解析で犯人候補を絞り尽くした。残る可能性は Tailwind preflight / flex item SC / ブラウザキャッシュ等。決定打として **Console JS で祖先要素を全列挙** + **self の backdrop-filter 値確認** が必要
> 所要時間: 5 分
> 操作: コピペ + Enter + 出力コピーのみ

---

## 操作手順（5 ステップ）

### Step 1: localhost:3000 をダーク状態で開く（既に開いていれば OK）

### Step 2: F12 キーを押して開発者ツールを開く

### Step 3: 上部タブから「**Console**」をクリック

### Step 4: 下記の Console JS を **全選択コピー** → Console 入力欄に貼り付け → **Enter**

```js
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
```

### Step 5: 出力結果（JSON）を **全選択コピー** → 私（a-main-010）に貼り戻す

---

## 出力例（参考）

```json
{
  ".kpi-card_self_backdropFilter": "blur(8px)",
  ".kpi-card_blockers": [
    { "tag": "DIV", "class": "...", "prop": "transform", "value": "translateZ(0)" }
  ],
  ".orb-card_self_backdropFilter": "blur(8px)",
  ".orb-card_blockers": [...],
  ".activity-panel_self_backdropFilter": "blur(8px)",
  ".activity-panel_blockers": [...]
}
```

→ この JSON が来たら、a-bloom-002 が即解析して **真の犯人特定** + **対応案実装** に進みます。

---

## 結果別 想定対応

| 出力パターン | 解釈 | 次の対応 |
|---|---|---|
| `_self_backdropFilter: "none"` | CSS 配線レベルで blur が効いていない | 別調査（CSS 上書き元特定）|
| `_self_backdropFilter: "blur(8px)"` + `_blockers: []` | 仕様上は効くはず、Chrome バグ疑い | B 案（isolation: isolate）試行 |
| `_blockers` に共通要素（複数 selector で出る）| その要素が真の犯人 | A 案延長: その CSS を削除 |
| `_blockers` に Tailwind preflight or 外部由来要素 | コード側で削除困難 | B 案（isolation: isolate）|

---

## トラブル時

| 症状 | 対処 |
|---|---|
| Console に貼って Enter しても何も出ない | `Ctrl+L` で Console クリア → 再度貼り付け |
| `Uncaught SyntaxError` 等のエラー | コピー範囲を再確認、上の ``` 行は含めずコード本体のみ |
| 出力が一瞬で消える | Console の右側スクロールで遡って取得、or `result` と入力して Enter で再表示 |
| F12 が効かない | 右上「︙」メニュー → その他のツール → デベロッパー ツール |

---

## 改訂履歴

- 2026-04-30 初版（a-main-010、a-bloom-002 Step F 依頼を受けて）
