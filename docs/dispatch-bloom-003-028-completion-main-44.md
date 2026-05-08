~~~
🟢 bloom-003- No. 28
発信元: a-bloom-003
発信日時: 2026-05-05(火) 17:16
件名: main- No. 44 完了報告（/leaf 404 + bloom-top サブナビ壊れた相対 path 修正）

## commit / push
- commit: `04086e5` fix(leaf+_proto): /leaf placeholder + bloom-top サブナビ React URL 化 [dispatch main- No.44]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（53dad32..04086e5）

## # 5 解決方針: ComingSoonPage 既存 component で placeholder

ファイル: `src/app/leaf/page.tsx`

```tsx
import { ComingSoonPage } from "../_components/ComingSoonPage";

export default function LeafPage() {
  return (
    <ComingSoonPage
      moduleName="Leaf"
      nameJa="葉"
      description="商材×商流ごとの個別アプリ（約 30 テーブル）・トスアップ"
      phase="Phase B"
    />
  );
}
```

→ /seed と同じパターン採用、整合性あり。

## # 6 解決方針: bloom-top のサブナビ 4 件 × 2 = 8 箇所 href 置換

修正対象: `public/_proto/bloom-top/index.html`

| 出現箇所 | before | after |
|---|---|---|
| line 227 (nav-page-item) | `../03_Workboard/index.html` | `/bloom/workboard` |
| line 231 (nav-page-item) | `../04_DailyReport/index.html` | `/bloom/daily-report` |
| line 235 (nav-page-item) | `../05_MonthlyDigest/index.html` | `/bloom/monthly-digest` |
| line 239 (nav-page-item) | `../06_CEOStatus/index.html` | `/bloom/ceo-status` |
| line 371 (bloom-nav-card) | `../03_Workboard/index.html` | `/bloom/workboard` |
| line 381 (bloom-nav-card) | `../04_DailyReport/index.html` | `/bloom/daily-report` |
| line 391 (bloom-nav-card) | `../05_MonthlyDigest/index.html` | `/bloom/monthly-digest` |
| line 401 (bloom-nav-card) | `../06_CEOStatus/index.html` | `/bloom/ceo-status` |

`replace_all` で 4 unique path を一括置換 → 計 8 箇所更新。

## 横断 grep の追加発見
`grep -rn '\.\./0[1-9]_' public/_proto/` 実行結果:
- active な対象は `bloom-top/index.html` の 8 箇所のみ
- 他の active proto（ceostatus / garden-home / garden-home-spin / login）に同パターン無し
- legacy-* 5 ファイル群（保持対象のため未編集）にのみ残存（main- No.41/42 で作成した過去版を含む、削除禁止ルール遵守）

## 検証 HTTP code（本セッション curl）

| URL | HTTP code |
|---|---|
| /leaf | **200** ✅ |

bloom-top の grep 結果（修正後）:
- `../0X_*` パターン: **0 件**（active 内）
- `/bloom/workboard|daily-report|monthly-digest|ceo-status`: **8 件出現**

## legacy 保持ファイル一覧（削除禁止）
- public/_proto/bloom-top/index.legacy-subnav-fix-20260505.html （新規）
- src/app/leaf/page.tsx は新規ファイルなので legacy 不要

（main- No. 41/42 で作成済 legacy 8 件も継続保持）

## 完了時刻
2026-05-05(火) 17:16（着手 17:13 → 完了 17:16、所要 3 分）

## 検証依頼
a-main-012 で Chrome MCP DOM/視覚検証お願いします:
1. /leaf HTTP 200 + ComingSoonPage レンダリング（"Leaf / 葉 / Phase B" 表示）
2. /_proto/bloom-top/ の uniqueHrefs から `../03_..._06_*` 消失、`/bloom/workboard|daily-report|monthly-digest|ceo-status` 4 件出現
3. 任意で 1〜2 サブナビリンク実クリック → React 本番遷移確認

a-bloom-003 待機中（次 bloom-003- No. 29、main- No. 45 の garden-home orb / spin bubble dead-link 整理待ち）
~~~
