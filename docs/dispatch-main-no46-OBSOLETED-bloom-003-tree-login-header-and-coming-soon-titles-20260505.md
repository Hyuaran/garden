# main- No. 46 dispatch（予約・post-デモ用） - a-bloom-003 /tree/login ヘッダー + ComingSoonPage title 差別化 - 2026-05-05

> 起草: a-main-012
> 用途: 5/8 デモ向け 12 module 巡回検証で検出した 🟢 細部観察事項 2 件、5/9 以降の **post-デモ対応**として予約起草
> 番号: main- No. 46（**予約**、5/9 以降の投下用）
> 起草時刻: 2026-05-05(火) 17:46
> 緊急度: 🟢 低（post-デモ、デモ品質には影響なし）

---

## ⚠️ 投下タイミング注意

**5/8 デモ完了まで投下しない**。デモ後（5/9 以降）に東海林さんが a-bloom-003 にコピペ投下する想定。

5/8 デモ向けの 🔴🟡 重要修正（main- No. 38〜45）は完走済み。本 dispatch は仕上げ・統一感向上のための細部修正。

---

## 投下用短文（5/9 以降に東海林さんが a-bloom-003 にコピペ）

~~~
🟢 main- No. 46
【a-main-012 から a-bloom-003 への dispatch（/tree/login ヘッダー + ComingSoonPage title 差別化、post-デモ統一感向上）】
発信日時: （投下時に実時刻を東海林さん or a-main-NNN が再記入）

5/8 デモ向け 12 module 巡回検証で検出した 🟢 細部観察事項。post-デモ統一感向上として対応依頼。

【検出した観察事項】

# 2: /tree/login のヘッダーが "Garden" のみ（他 module と差別化不足）

12 module 巡回検証時の比較:

| URL | 実遷移先 | title | header (h1/h2/h3) |
|---|---|---|---|
| /forest | /forest/login | Garden | **Garden Forest** |
| /bud | /bud/login | Garden-Bud — 経理・収支 | **Garden-Bud** |
| /tree | /tree/login | Garden | **Garden** ❌（他と整合せず）|
| /root | /root/login | Garden Root — マスタ管理 | **Garden Root** |

→ /tree/login だけ header と title が "Garden" 単独で、他の login 画面と統一感欠落。

修正案: /tree/login の header を `Garden Tree` or `Garden-Tree — 架電管理` 等の module 名つきに変更。
title も `Garden Tree — 架電管理` 等の module 名つきが望ましい（他 login 画面と整合）。

# 3: ComingSoonPage 系 7 module の title が全て "Garden"（差別化なし）

| URL | title | header |
|---|---|---|
| /fruit | Garden | Fruit/ 実 |
| /seed | Garden | Seed/ 種 |
| /leaf | Garden | Leaf/ 葉 |
| /sprout | Garden | Sprout/ 新芽 |
| /soil | Garden | Soil/ 土 |
| /rill | Garden | Rill/ 川 |
| /calendar | Garden | Calendar/ 暦 |

→ 全部 title="Garden" で、ブラウザタブで区別不能。header は差別化されているのに title だけ統一感なし。

修正案: ComingSoonPage コンポーネントが受け取る `moduleName` / `nameJa` を title に組込み:
```tsx
// src/app/_components/ComingSoonPage.tsx 内 等
export function ComingSoonPage({ moduleName, nameJa, ... }) {
  return (
    <>
      <title>{`${moduleName}/${nameJa} — Garden`}</title>
      ...
    </>
  );
}
```

または各 page.tsx で `metadata.title` を export:
```tsx
// src/app/fruit/page.tsx 等
export const metadata = { title: 'Fruit/ 実 — Garden' };
```

→ ブラウザタブで区別可能 + 後道さんがタブ複数開いたとき迷わない。

【修正対象（推定）】

- src/app/_components/ComingSoonPage.tsx（or 同等）
- src/app/tree/login/page.tsx（or 同等の Tree login 画面）

【検証フロー（a-main-NNN が実施）】

修正後 push 受領 → Chrome MCP で:
1. /tree/login のページソース確認、title が `Garden Tree` 系に変更されている
2. /fruit, /seed, /leaf, /sprout, /soil, /rill, /calendar の各 title が module 名入りに変更されている
3. ブラウザタブで区別可能（同時複数開いて目視確認）

【削除禁止ルール】

修正対象ファイルは legacy 保持:
- src/app/_components/ComingSoonPage.legacy-title-fix-{投下日}.tsx
- src/app/tree/login/page.legacy-header-fix-{投下日}.tsx
- 各 module page.tsx を編集する場合も同様

【完了報告フォーマット】

bloom-003- No. NN で:
- commit hash + push 状態
- # 2 修正内容 + before/after
- # 3 修正内容 + 影響を受ける 7 page.tsx の title 変更
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-NNN: 次 main- No. NN+1
a-bloom-003: bloom-003- No. NN で完了報告予定

工数見込み: 30 分（ComingSoonPage 改修 + tree/login ヘッダー修正）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 17:46 初版（a-main-012、5/8 デモ向け 12 module 巡回検証 🟢 細部観察事項、**post-デモ予約**）

## 付記: 投下時の実時刻記入

5/9 以降に投下する際、東海林さん or a-main-NNN は冒頭の `発信日時:` を実時刻に書き換えること。番号も次セッションのカウンターに合わせて再採番（NN を実値に）。
