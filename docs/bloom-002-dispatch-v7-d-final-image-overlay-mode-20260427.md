# a-bloom-002 dispatch v7 V7-D - 5/5 デモ用 画像 overlay モード（A 案）+ post-5/5 個別実装（B 案）- 2026-04-27

> 起草: a-main-009
> 用途: 5/5 後道さんデモ最速突破。新理想画像を背景化 + 透明 hit area で「全く同じ」を即実現
> 前提: V7-A 完了（SHA `ababd29`）、新理想画像 `home-design-ideal-v4-final.png` 配置済（`public/images/garden-home-bg-v2.png` を v4 内容で上書き済 = 既存参照パスでそのまま使える）

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】dispatch v7 V7-D 最終版 - A 案: 5/5 デモ用 画像 overlay モード

▼ 経緯
- 東海林さんが ChatGPT で完璧な理想画面を生成（Garden 正式名 + 12 水彩アイコン + 4 KPI + Today's Activity + 大樹 すべて完備）
- 配置済: public/images/garden-home-bg-v2.png に v4 内容で上書き済（既存参照パスで即使用可）
- 別パス: public/images/garden-home-bg-v4.png にも同一画像
- 5/5 デモまで「全く同じ」を最速実現するため A 案採用、post-5/5 で B 案（CSS 個別実装）切替

▼ 方針: A 案 → B 案ハイブリッド

| 段階 | 方針 | 工数 |
|---|---|---|
| A 案（5/5 デモ用、本 dispatch）| 画像を全画面背景化 + 12 module 透明 hit area | 0.3d |
| B 案（post-5/5）| 既配置 12 個別アイコン + CSS 個別実装で動的化 | 0.7d |

▼ A 案 実装内容

1. **page.tsx を v4 mode に切替**:
   - 既存 Sidebar / AppHeader / KpiCard / TodaysActivity / ModuleGrid を一時非表示（@deprecated コメント、CLAUDE.md ファイル削除禁止 準拠）
   - body 全体に v4 画像を全画面表示（width: 100vw, height: 100vh, object-fit: cover, position: fixed）
2. **12 モジュール 透明 hit area 配置**（画像内モジュール位置に absolute）:
   - 各 hit area = 透明 div、cursor: pointer、hover で scale-105 + ring-2 ring-emerald-300
   - クリックで該当モジュール遷移（href: /soil, /root, /tree 等）
   - 8-role aware（known-pitfalls #6 準拠、表示禁止 role には hit area 配置せず）
3. **キーボード操作維持**: Ctrl+F 検索 focus（隠し input）、Ctrl+Shift+B atmosphere toggle 等
4. **a11y**: hit area に aria-label="Bloom モジュール 案件一覧・KPI" 等
5. **prefers-reduced-motion**: hover 演出を簡素化

▼ 画像内 12 モジュール 概算座標（画像 16:9、left%, top% で）

Row 1 (canopy/樹冠、y=43%):
- Bloom: x=23%, y=43%
- Fruit: x=37%, y=43%
- Seed: x=51%, y=43%
- Forest: x=65%, y=43%

Row 2 (地上、y=58%):
- Bud: x=23%, y=58%
- Leaf: x=37%, y=58%
- Tree: x=51%, y=58%
- Sprout: x=65%, y=58%

Row 3 (地下、y=73%):
- Soil: x=23%, y=73%
- Root: x=37%, y=73%
- Rill: x=51%, y=73%
- Calendar: x=65%, y=73%

各 hit area サイズ: width=11%, height=13% 程度（実装時に画像確認しながら微調整）

▼ ⚠️ 重要

- **既存 Sidebar / AppHeader / KpiCard / TodaysActivity / ModuleGrid は CSS で非表示にするだけ、削除禁止**（B 案で再利用）
- **localhost:3002 で東海林さんが画像と CSS の重複 / ズレを目視確認後、座標を微調整**
- **GitHub push 48h block 中 → ローカル commit のみ**

▼ 期待結果（5/5 デモ準備完了）

- localhost:3002/ で v4 画像が全画面表示
- 12 モジュール位置にホバー演出 + クリック遷移
- 後道さんに見せて「ChatGPT 通り」判定取得

▼ 次の dispatch（V7-E、post-5/5）

5/5 デモ後、B 案として:
- 既配置 12 個別アイコン（public/images/module-icons/{module}.png）を ModuleSlot に組み込み
- KPI / Today's Activity / Sidebar / AppHeader を画像準拠の CSS で再現
- 動的データ反映（実 user 名、実 KPI、実通知等）

▼ 完了報告先

- 各 step 完了で a-main-009 に SHA + localhost 動作確認結果共有
- push は GitHub 復旧後 a-main-009 が一括対応
```

---

## 詳細 spec（a-bloom-002 が読む本文）

### Step 1: page.tsx を v4 mode に切替（0.15d）

**変更ファイル**: `src/app/page.tsx`

**変更内容**:

```tsx
// src/app/page.tsx (v4 mode)

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// 既存 import の Sidebar / AppHeader / KpiCard / ModuleGrid / TodaysActivity は維持
// （v4 mode では未使用、CLAUDE.md 削除禁止ルール準拠で残置 + JSDoc @deprecated）

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* v4 background image, full screen */}
      <Image
        src="/images/garden-home-bg-v2.png"
        alt="Garden Series ホーム画面"
        fill
        priority
        className="object-cover"
      />

      {/* 12 module 透明 hit areas */}
      <ModuleHitAreas role={user.role} />

      {/* 隠し input for Ctrl+F search focus */}
      <SearchHotkey />
    </main>
  );
}
```

### Step 2: ModuleHitAreas コンポーネント新規（0.15d）

**新規ファイル**: `src/app/_components/ModuleHitAreas.tsx`

```tsx
"use client";

import Link from "next/link";
import type { Role } from "@/lib/auth";

interface HitArea {
  id: string;
  nameEn: string;
  description: string;
  href: string;
  x: number; // left %
  y: number; // top %
  w: number; // width %
  h: number; // height %
  minRole: Role;
}

const HIT_AREAS: HitArea[] = [
  // Row 1 (canopy)
  { id: "bloom", nameEn: "Bloom", description: "案件一覧・日報・KPI",
    href: "/bloom", x: 23, y: 43, w: 11, h: 13, minRole: "staff" },
  { id: "fruit", nameEn: "Fruit", description: "法人法的実体・登記",
    href: "/fruit", x: 37, y: 43, w: 11, h: 13, minRole: "manager" },
  { id: "seed", nameEn: "Seed", description: "新事業枠",
    href: "/seed", x: 51, y: 43, w: 11, h: 13, minRole: "manager" },
  { id: "forest", nameEn: "Forest", description: "全法人決算",
    href: "/forest", x: 65, y: 43, w: 11, h: 13, minRole: "manager" },
  // Row 2 (ground)
  { id: "bud", nameEn: "Bud", description: "経理・収支",
    href: "/bud", x: 23, y: 58, w: 11, h: 13, minRole: "staff" },
  { id: "leaf", nameEn: "Leaf", description: "商材・トスアップ",
    href: "/leaf", x: 37, y: 58, w: 11, h: 13, minRole: "staff" },
  { id: "tree", nameEn: "Tree", description: "架電アプリ",
    href: "/tree", x: 51, y: 58, w: 11, h: 13, minRole: "toss" },
  { id: "sprout", nameEn: "Sprout", description: "採用・入社",
    href: "/sprout", x: 65, y: 58, w: 11, h: 13, minRole: "staff" },
  // Row 3 (underground)
  { id: "soil", nameEn: "Soil", description: "DB・大量データ",
    href: "/soil", x: 23, y: 73, w: 11, h: 13, minRole: "staff" },
  { id: "root", nameEn: "Root", description: "組織・顧客・マスタ",
    href: "/root", x: 37, y: 73, w: 11, h: 13, minRole: "staff" },
  { id: "rill", nameEn: "Rill", description: "業務連絡・メッセージング",
    href: "/rill", x: 51, y: 73, w: 11, h: 13, minRole: "outsource" },
  { id: "calendar", nameEn: "Calendar", description: "営業予定・シフト",
    href: "/calendar", x: 65, y: 73, w: 11, h: 13, minRole: "staff" },
];

export function ModuleHitAreas({ role }: { role: Role }) {
  return (
    <>
      {HIT_AREAS.filter((h) => isRoleAtLeast(role, h.minRole)).map((h) => (
        <Link
          key={h.id}
          href={h.href}
          aria-label={`${h.nameEn} モジュール ${h.description}`}
          className="absolute block transition-transform duration-300 ease-out hover:scale-105 hover:ring-2 hover:ring-emerald-300 hover:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
          style={{
            left: `${h.x}%`,
            top: `${h.y}%`,
            width: `${h.w}%`,
            height: `${h.h}%`,
            borderRadius: "1rem",
          }}
        />
      ))}
    </>
  );
}
```

### Step 3: SearchHotkey コンポーネント（0.05d）

```tsx
"use client";
import { useEffect, useRef } from "react";

export function SearchHotkey() {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <input
      ref={inputRef}
      type="search"
      aria-label="検索"
      className="sr-only"
    />
  );
}
```

### Step 4: 既存コンポーネントの @deprecated（0.05d）

**変更**: 以下のファイルに JSDoc @deprecated 追記（v4 mode で未使用、B 案で再利用）

```tsx
/**
 * @deprecated v4 mode (画像 overlay モード) では未使用。
 * post-5/5 の B 案 (V7-E) で再利用予定。
 * CLAUDE.md ファイル削除禁止ルールに従い残置。
 */
```

対象:
- `src/app/_components/Sidebar.tsx`
- `src/app/_components/AppHeader.tsx`
- `src/app/_components/KpiCard.tsx`
- `src/app/_components/TodaysActivity.tsx`
- `src/app/_components/ModuleGrid.tsx`（or 同等の 12 module grid）

**page.tsx の import からは削除**（未使用 import エラー回避）。

### Step 5: テスト追加（0.05d）

`src/app/_components/__tests__/ModuleHitAreas.test.tsx`:

| テストケース |
|---|
| 12 hit areas が render される（super_admin 想定）|
| outsource role で表示制限される（Tree のみ）|
| 各 hit area に正しい aria-label 付与 |
| 各 hit area がクリック可能（Link）|
| 8 role 別 visible filter 確認 |

既存 727+ tests は **page.tsx 変更により Sidebar / KpiCard / ModuleGrid テストが失敗** する可能性あり → @deprecated 化に伴いテストも skip or 削除（v4 mode 専用テストへ）。

### Step 6: localhost 動作確認（東海林さん、5 分）

```
http://localhost:3002/
```

→ Ctrl+Shift+R で強制リロード

| # | 項目 | 期待 |
|---|---|---|
| 1 | 背景画像 | v4 画像が全画面表示 |
| 2 | 12 module 位置 hover | scale + ring 演出 |
| 3 | 12 module 位置 click | 該当モジュール遷移 |
| 4 | 8-role 別 | outsource role で Tree のみ click 可能等 |
| 5 | Ctrl+F | 検索 focus（隠し input）|
| 6 | レスポンシブ | 1920x1080 で確認、その他は post-5/5 |

座標ズレあれば、a-bloom-002 で `HIT_AREAS` の x / y / w / h を微調整。

### Step 7: ローカル commit + 報告（東海林さん経由）

```bash
git add -A
git commit -m "feat(home): dispatch v7 V7-D - 5/5 デモ用 画像 overlay モード (A 案)"
# push 禁止（48h GitHub block）
```

→ a-main-009 に commit SHA 共有 + localhost 動作確認結果報告

## post-5/5 計画（B 案 V7-E）

5/5 デモ後の改修方針:

1. **既存 Sidebar / AppHeader / KpiCard / TodaysActivity / ModuleGrid を @deprecated 解除**
2. **page.tsx を CSS 個別実装に戻す**（v4 画像は背景の右 1/3 のみに使用）
3. **既配置 12 個別アイコン**（public/images/module-icons/{id}.png）を ModuleSlot に組み込み
4. **動的データ反映**:
   - KPI 実 API 連携（Bud / Tree / Bloom / Forest）
   - Today's Activity 実データ（bloom_notifications Cron 3）
   - 天気 API（OpenWeatherMap）
   - user 名 / role（root_employees + Fruit）
5. **/home route 整備**（現在 / 利用、deviation 解消）

工数 **0.7-1d**、5/5 後の dispatch v7 V7-E として別途起草。

## 改訂履歴

- 2026-04-27 初版（a-main-009、新理想画像 v4 を背景化 + 透明 hit area で 5/5 デモ最速突破、B 案 post-5/5）
