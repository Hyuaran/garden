# a-bloom-002 dispatch - Step J 真因解決（compositor layer 課題） - 2026-05-01

> 起草: a-main-010
> 用途: !important では Chrome が backdrop-filter を無効化、根本対応依頼
> 前提: Step I 実装済（!important 追加）、東海林さん DevTools 確認で `-webkit-backdrop-filter: blur(8px) !important` に **取り消し線 + 警告アイコン**
> **重要**: 5/5 デモで Next.js 版（実際の画面）を出すため、ぼかしの完璧復活が必須

---

## 状況サマリ

### Step I（!important）の結果

| 項目 | 結果 |
|---|---|
| CSS への届き | ✅ `-webkit-backdrop-filter: blur(8px) !important` が届いている |
| Chrome 判定 | ❌ **取り消し線（strikethrough）+ 警告アイコン（⚠️）** |
| 視覚効果 | ✅ alpha 半透明は効いている / ❌ blur は依然無効 |

→ **!important でも Chrome が backdrop-filter を無効化**。a-bloom-002 が Step I 実装時に予想した「compositor layer 課題」が現実化。

### 真因（確定）

`globals.css` 行 1425-1445 の **animation: fadeUp ... both** が原因：

```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }  /* matrix(1,0,0,1,0,0) で残存 */
}

.greeting / .kpi-card / .orb-card / .activity-panel { animation: fadeUp ... both; }
```

- `animation-fill-mode: both` で最終 keyframe の transform が永続残存
- 各 card が独立 compositor layer に昇格
- Chrome の最適化で backdrop-filter が compositor layer 内で評価 → ページ背景に届かない
- !important でも CSS 規則は通るが Chrome のレンダリングパイプライン制約で **物理的に効かない**

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
【a-main-010 から a-bloom-002 へ Step J 真因解決依頼】

東海林さん DevTools 確認結果：!important 付きでも Chrome が取り消し線で無効化。
a-bloom-002 予想通り compositor layer 課題が現実化。

【重要前提】
5/5 デモで Next.js 版（実際の画面）を出す方針。ぼかし完璧復活が必須、妥協なし。

【真因】
animation: fadeUp ... both の最終 keyframe transform: translateY(0) が
matrix(1,0,0,1,0,0) で永続残存 → 各 card が独立 compositor layer 昇格 →
Chrome レンダリングパイプライン制約で backdrop-filter が物理的に効かない

【Step J 対応案候補（a-bloom-002 が最終判断）】

A 案: keyframe から transform 削除、opacity のみフェードイン
  @keyframes fadeUp {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  → 上下動き失うがフェードイン演出維持、persistent transform 完全消去、
    backdrop-filter 復活見込み大

B 案: animation 完全削除
  .kpi-card / .orb-card / .activity-panel から animation 削除
  → 演出全て失う、ただし最確実

C 案: 別 wrapper element で transform を card 外に逃がす
  <div class="kpi-card-anim">  ← animation
    <div class="kpi-card">      ← backdrop-filter
  → 演出 + 動き両方維持、ただし HTML 構造変更必要、page.tsx 修正

D 案: a-bloom-002 が他の解決策提案
  例: will-change 制御 / transform: none !important で keyframe 上書き /
      isolation 制御 / contain 利用 等

【東海林さん優先順】
1. ぼかし完璧復活（最優先、絶対必須）
2. フェードイン演出維持（できれば）
3. 上下動き演出（あればベター、なくても可）

【依頼】
1. A 案を最初に試す（コスト最小、副作用最小、優先順 1+2 達成）
2. A 案で backdrop-filter 復活確認
3. NG なら B 案 or C 案 or D 案を検討
4. 完了後、東海林さん再確認 → OK なら commit + push

【完了報告期待】
1. 採用案（A/B/C/D）
2. 修正内容（git diff）
3. DevTools Computed で backdrop-filter が "blur(8px)" になり取り消し線消えたか
4. 東海林さん再確認結果
5. commit + push 完了
~~~

---

## 詳細手順（参考、a-bloom-002 が必要時に参照）

### A 案実装例（推奨）

`globals.css` の @keyframes fadeUp を修正：

```css
@keyframes fadeUp {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

→ animation 適用先（.greeting / .kpi-card / .orb-card / .activity-panel）はそのまま。

### B 案実装例（最確実、演出失う）

`globals.css` 行 1425-1445 の animation 適用を削除：

```css
/* .greeting   { animation: fadeUp 0.7s ease both; } */
/* .kpi-card   { animation: fadeUp 0.7s ease both; } */
/* .kpi-card:nth-child(1) { animation-delay: 0.1s; } */
/* ... 全削除 */
```

### C 案実装例（HTML 変更）

`page.tsx` で各 card を wrapper で囲む：

```tsx
<div className="kpi-card-anim">
  <div className="kpi-card">...</div>
</div>
```

`globals.css`：
```css
.kpi-card-anim { animation: fadeUp 0.7s ease both; }
```

### Step J 後の Step K（東海林さん再確認）

1. localhost:3000 を Ctrl+Shift+R で hard refresh
2. ダーク切替
3. 視覚確認 + DevTools Computed で `backdrop-filter: blur(8px)` 取り消し線消失確認
4. OK なら commit + push へ

## 改訂履歴

- 2026-05-01 初版（a-main-010、Step I !important 失敗 + 東海林さん「Next.js 版で 5/5 デモ」方針確認後）
