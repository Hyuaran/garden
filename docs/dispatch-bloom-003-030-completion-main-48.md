~~~
🟢 bloom-003- No. 30
発信元: a-bloom-003
発信日時: 2026-05-05(火) 18:33
件名: main- No. 48 完了報告（Bloom 開発進捗 v29 取り込み /bloom/progress 新規 page）

## commit / push
- commit: `8ca36ad` feat(bloom): /bloom/progress 新規 (Garden 開発進捗 v29 取り込み) [dispatch main- No.48]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（6adeb3b..8ca36ad）

## 配置確認（HTML + 画像 14 + sidebar アイコン 1 = 計 16 ファイル）

### public/_proto/bloom-dev-progress/
| ファイル | サイズ |
|---|---|
| index.html (v29) | 277,375 bytes |
| images/decor/icon_work_office.png | (copy 元と同じ) |
| images/decor/icon_work_home.png | 〃 |
| images/decor/icon_work_irregular.png | 〃 |
| images/decor/progress_ring_000.png | 〃 |
| images/decor/progress_ring_010.png | 〃 |
| images/decor/progress_ring_020.png | 〃 |
| images/decor/progress_ring_030.png | 〃 |
| images/decor/progress_ring_040.png | 〃 |
| images/decor/progress_ring_050.png | 〃 |
| images/decor/progress_ring_060.png | 〃 |
| images/decor/progress_ring_070.png | 〃 |
| images/decor/progress_ring_080.png | 〃 |
| images/decor/progress_ring_090.png | 〃 |
| images/decor/progress_ring_100.png | 〃 |

### public/images/icons_bloom/
| ファイル | 用途 |
|---|---|
| bloom_progress.png | sidebar 用（progress_ring_050.png を rename copy） |

## /bloom/progress HTTP code（本セッション curl）

| URL | HTTP code |
|---|---|
| /bloom/progress | **200** ✅（0.97s） |
| /_proto/bloom-dev-progress/index.html | **200** ✅ |
| /_proto/bloom-dev-progress/images/decor/icon_work_office.png | **200** ✅ |
| /_proto/bloom-dev-progress/images/decor/progress_ring_050.png | **200** ✅ |
| /images/icons_bloom/bloom_progress.png | **200** ✅ |

## # 2 解決方針: BloomShell 配下に full-height iframe

ファイル: `src/app/bloom/progress/page.tsx`（新規）

```tsx
"use client";

export default function BloomProgressPage() {
  return (
    <iframe
      src="/_proto/bloom-dev-progress/index.html"
      style={{
        width: "100%",
        height: "100vh",
        border: "none",
        display: "block",
      }}
      title="Garden 開発進捗 v29"
    />
  );
}
```

→ /bloom Top と異なり BloomShell 配下のため、Garden Topbar/Sidebar 表示維持。
→ 他のサブナビ（workboard / monthly-digest 等）と同じ動線で「サイドバー → 開発進捗」遷移可能。

## # 3 サイドバー追加 before / after

修正対象: `src/app/bloom/_components/BloomSidebar.tsx`（line 65-70）

### before（4 件）
```ts
const NAV_PAGES: NavPage[] = [
  { href: "/bloom/workboard",       iconSrc: ..., label: "ワークボード" },
  { href: "/bloom/daily-report",    iconSrc: ..., label: "日報" },
  { href: "/bloom/monthly-digest",  iconSrc: ..., label: "月次まとめ" },
  { href: "/bloom/ceo-status",      iconSrc: ..., label: "経営状況" },
];
```

### after（5 件）
```ts
const NAV_PAGES: NavPage[] = [
  { href: "/bloom/workboard",       iconSrc: ..., label: "ワークボード" },
  { href: "/bloom/daily-report",    iconSrc: ..., label: "日報" },
  { href: "/bloom/monthly-digest",  iconSrc: ..., label: "月次まとめ" },
  { href: "/bloom/ceo-status",      iconSrc: ..., label: "経営状況" },
  { href: "/bloom/progress",        iconSrc: "/images/icons_bloom/bloom_progress.png",      label: "開発進捗" },
];
```

ラベル「開発進捗」採用根拠: v29 HTML の `<title>Garden 開発進捗 — 庭の育ち | Bloom (preview v3.1)</title>` と整合。

## legacy 保持ファイル一覧（削除禁止）
- src/app/bloom/_components/BloomSidebar.legacy-progress-link-add-20260505.tsx （新規）
- 他（page.tsx, bloom-dev-progress/, bloom_progress.png）は新規追加のため legacy 不要

（main- No. 41/42/44/45 で作成済 legacy 11 件も継続保持）

## 完了時刻
2026-05-05(火) 18:33（着手 18:29 → 完了 18:33、所要 4 分）

## 検証依頼
a-main-012 で Chrome MCP DOM/視覚検証お願いします:
1. /bloom/progress HTTP 200 + iframe 内 v29 HTML レンダリング
2. iframe 内画像表示確認（icon_work × 3、progress_ring 11 枚）
3. /bloom サイドバー「開発進捗」リンククリック → 遷移成功（active 状態確認可）
4. v29 タブ動作確認（履歴 / モジュール / 概要 等の claude.ai 仕様書 4 タブ）

## 既知の留意事項
- iframe 高さ 100vh は BloomShell の topbar 分（~64px）下に隠れる可能性あり。視覚 NG なら次 dispatch で `calc(100vh - 64px)` 等に調整可。
- v29 HTML 内冒頭に `<title>` 2 つ存在（v3 残骸 + v29 メイン）、iframe 配置のため親ページ title が優先表示で実害なし（dispatch 通り修正不要）。
- フォント Google Fonts 経由（ネット必須）、デモ環境ネット OK 前提。

a-bloom-003 待機中（次 bloom-003- No. 31、main- No. 49 待ち）
~~~
