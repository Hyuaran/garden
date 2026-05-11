# main- No. 36 dispatch - a-bloom-002 KPI/ナビカード文字バランス + 経営状況 404 修正 - 2026-05-04

> 起草: a-main-011
> 用途: 東海林さんスクショ + a-main-011 DOM 検証で 3 項目残課題（並行対応）
> 番号: main- No. 36
> 起草時刻: 2026-05-04(月) 21:03
> 緊急度: 🔴 5/8 デモ向け視覚最終仕上げ + 動作確認

---

## 重要な前提

東海林さん明示:
1. claude.ai プロト版（② /_proto/bloom-top）の **ボタン内文字バランスが理想**
2. ① /bloom の KPI カード「縮み具合がおかしい」
3. ① /bloom の経営状況ナビカードクリック → 404 エラー（東海林さん実機）

a-main-011 DOM 検証:
- `.kpi-grid` width = **0px**（崩れている、kpi-card 130.82px は本来 250px 想定）
- 経営状況リンク href = `/_proto/ceostatus/index.html`、curl HTTP 200 OK（私側）
- 東海林さん実機で 404 = ブラウザキャッシュ or **Next.js Link が内部 routing として処理して 404** の可能性大

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 36
【a-main-011 から a-bloom-002 への dispatch（KPI カード + ナビカード文字バランス + 経営状況 404 修正、並行対応）】
発信日時: 2026-05-04(月) 21:03

bloom-002- No. 18 dev server 復旧後、a-main-011 が Chrome MCP で全 4 項目
（main- No. 34）達成確認済。ただし東海林さん実機で 3 項目残課題判明。並行対応依頼。

【# 1 KPI カード幅崩れ（🔴 必須）】

東海林さん指摘:「一番上の 4 枚のカードが縮み具合がおかしい」

a-main-011 DOM 検証:
```
.kpi-grid:
  width: 0  ← 異常、grid container が崩壊
  height: 651.62px
  rect.x: 281.99, rect.y: 443.45

.kpi-card（4 枚それぞれ）:
  width: 130.82px  ← 本来 250px 想定（widely だと 280-300px）
```

期待（claude.ai プロト v1.4 同等）:
- KPI カード幅: 各 250-300px
- 4 枚が等間隔に整列
- カード内: タイトル + 大きい数字 + サブテキスト 中心配置、文字バランス良

修正:
1. `public/_proto/bloom-top/css/style.css` で `.kpi-grid` の CSS を確認
   ```bash
   grep -n "kpi-grid\|kpi-card" public/_proto/bloom-top/css/style.css
   ```
2. プロトの grid 設定（display: grid; grid-template-columns: ...; gap: ...）を
   src/app/globals.css の対応箇所にコピー or specificity 上書き
3. width: 0 になる原因を特定（親の display 違い、min-width 不足、flex-basis 等）

【# 2 ナビカード文字バランス（🟡）】

東海林さん明示:「claude.ai プロト版のボタン内の文字のバランスがいい」

期待（claude.ai プロト v1.4 同等）:
- ナビカード（ワークボード/日報/月次まとめ/経営状況）の中身:
  - アイコン左
  - メインテキスト（カード名）+ サブテキスト（説明文）中央
  - 矢印 「›」 右
  - 整然・余白十分
- Coming Soon バッジ（日報のみ）はプロト同等のさりげない表示

修正:
1. `public/_proto/bloom-top/css/style.css` で `.bloom-nav-card` の CSS を確認
2. プロト同等の padding / font-size / line-height / icon-size に揃える
3. BloomNavGrid.tsx の HTML 構造もプロトと厳密一致

【# 3 経営状況ナビカード 404 修正（🔴 必須）】

東海林さん指摘:「経営状況をクリックしても 404 エラー」

a-main-011 確認:
- href = `/_proto/ceostatus/index.html`
- `curl -sI` → **HTTP 200 OK**（私側）
- 東海林さん実機 = 404

考えられる真因（最有力）:
**Next.js の `<Link>` コンポーネントが `/_proto/ceostatus/index.html` を
内部 routing として処理 → Next.js ページとして登録されてないので 404**

bloom-002- No. 13 で「Next.js Link 経由遷移」と報告ありましたが、`/_proto/`
配下は **静的アセット**であり、Next.js Link ではなく **通常の `<a>` タグ**で
遷移すべき。

修正:

```tsx
// BloomNavGrid.tsx の経営状況カード
// 修正前:
<Link href="/_proto/ceostatus/index.html">経営状況</Link>

// 修正後:
<a href="/_proto/ceostatus/index.html" className="bloom-nav-card">
  経営状況
</a>
```

または、Next.js の `<Link>` を使うなら `prefetch={false}` + `target="_blank"`
等の調整が必要。

確認手順:
1. `BloomNavGrid.tsx` で経営状況カードの実装を確認
2. Link コンポーネント使用なら通常 `<a>` に変更
3. 修正後、ブラウザで Ctrl+Shift+R → 経営状況クリックで遷移確認

【その他（参考）】

東海林さん実機ブラウザのキャッシュ問題の可能性もあるため、Ctrl+Shift+R 推奨。
ただし、Link コンポーネント問題が真因なら CSS キャッシュとは別軸。

【削除禁止ルール継続】

- 既存 .legacy-* ファイル保持
- 今回の修正で .tsx / .css 更新する場合、再度 legacy 保持
  例: BloomNavGrid.legacy-link-fix-20260504.tsx, globals.legacy-kpi-fix-20260504.css

【視覚一致検証フロー】

a-main-011 が Chrome MCP で修正後再 DOM 取得 + 動作確認:
1. # 1: `.kpi-grid` width が正常値（widely だと 1000px 程度）
2. # 1: kpi-card 各 250-300px
3. # 2: ナビカードレイアウト プロト同等（実視覚確認）
4. # 3: 経営状況クリック → /_proto/ceostatus/ 遷移確認

【完了報告フォーマット】

bloom-002- No. 19 で:
- commit hash + push 状態
- # 1 KPI カード修正内容（CSS 変更箇所 + DOM rect 確認）
- # 2 ナビカード修正内容
- # 3 404 修正内容（Link → a タグ変更 or 別対応）
- legacy 保持ファイル
- 完了時刻

【dispatch counter】

a-main-011: 次 main- No. 37
a-bloom-002: bloom-002- No. 19 で完了報告予定

工数見込み: 1.5-2.5h（# 1 1h、# 2 30 分、# 3 30 分）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 `~~~` 内をコピー |
| 2 | a-bloom-002 に貼り付け投下 |

→ a-bloom-002 が並行修正 + push → a-main-011 が Chrome MCP で再検証 → 5/8 デモ準備完了。

## 改訂履歴

- 2026-05-04 21:03 初版（a-main-011、東海林さんスクショ + DOM 検証で 3 項目残課題、並行対応として起草）
