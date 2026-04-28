# a-bloom-002 dispatch v7 V7-D-fix2 + V7-E - ホバー修正 + 404 全解消（全完成方針）- 2026-04-27

> 起草: a-main-009
> 用途: 5/5 後道さんデモ向け Garden ホーム完全完成。ホバー演出修正 + 全 12 モジュール click → 何かしらの画面到達
> 前提: V7-D-fix（commit `7021195`）完了、ローカル commit のみで進行（48h GitHub block 中）

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】dispatch v7 V7-D-fix2 + V7-E - 全完成方針

▼ 経緯

東海林さんから「全部完成させる方向で」指示。5/5 後道さんデモまでに:
- ホバー演出を確実に表示
- 全 12 モジュール click で何らかの画面到達（404 なし）

▼ 大改修 2 段階

Step 1 (V7-D-fix2): ホバー演出修正（画面サイズ問題解消）
Step 2 (V7-E): 404 全解消（develop merge + Coming Soon ページ作成）

合計工数 0.7d、5/5 デモまで余裕。

▼ Step 1: V7-D-fix2 - ホバー演出修正（0.2d）

【原因】
v4 画像（1920x1080）を全画面 object-fit: cover で表示 → 画面比率が違うと画像が crop される。hit area の % は画面 % で計算されるため、画像 module 実位置とズレる。

【修正方針】
画像を aspect-ratio: 16/9 固定 container で表示 + hit area を画像 container 内 % で配置。

実装案:

```tsx
// page.tsx
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="relative min-h-screen w-screen flex items-center justify-center bg-cream">
      {/* 画像と hit area を同じ container に、aspect-ratio: 16/9 で固定 */}
      <div className="relative w-full max-w-[1920px] aspect-[16/9]">
        <Image
          src="/images/garden-home-bg-v2.png"
          alt="Garden Series ホーム画面"
          fill
          priority
          className="object-contain"
        />
        {/* hit areas は同 container 内で % 配置 → 画像と完全連動 */}
        <ModuleHitAreas role={user.role} />
      </div>
    </main>
  );
}
```

これで画面サイズに依らず hit area が画像 module 位置と完全一致。

▼ Step 2: V7-E - 404 全解消（0.5d）

▼ Step 2-A: develop merge（Bud / Leaf 取り込み）

```bash
cd /c/garden/a-bloom-002
git fetch origin develop
git merge origin/develop --no-edit
# conflict あれば解消（page.tsx 等の変更が衝突する可能性）
git status
```

期待: a-bloom-002 branch に Bud / Leaf 等のモジュール page.tsx が取り込まれる。
（develop の最新 = #85 a-bud Phase 0 認証 merge 済 = 6c31c4f）

conflict 解消方針:
- src/app/page.tsx → V7-D-fix2 の変更を優先（HEAD）
- 各モジュール page.tsx → develop 側を採用
- docs/effort-tracking.md → 両側マージ（先例参照）

▼ Step 2-B: 未実装 6 モジュール Coming Soon ページ作成

未実装ルート（develop merge 後も残る）:
- /seed
- /soil
- /sprout
- /fruit
- /rill
- /calendar

共通コンポーネント:

```tsx
// src/app/_components/ComingSoonPage.tsx
import Link from "next/link";

export interface ComingSoonProps {
  moduleName: string;
  nameJa: string;
  description: string;
  phase: string;
}

export function ComingSoonPage({ moduleName, nameJa, description, phase }: ComingSoonProps) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-cream p-8 text-center">
      <h1 className="text-4xl font-bold text-emerald-700 mb-4">
        {moduleName} <span className="text-2xl text-muted-foreground">/ {nameJa}</span>
      </h1>
      <p className="text-lg text-muted-foreground mb-2">{description}</p>
      <p className="text-base text-amber-700 mb-8">
        {phase} で実装予定です
      </p>
      <Link
        href="/"
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-colors"
      >
        🍃 ホームへ戻る
      </Link>
    </main>
  );
}
```

各 placeholder ページ:

```tsx
// src/app/seed/page.tsx
import { ComingSoonPage } from "@/app/_components/ComingSoonPage";
export default function SeedPage() {
  return <ComingSoonPage
    moduleName="Seed"
    nameJa="種"
    description="新商材・新事業の拡張枠"
    phase="Phase C"
  />;
}

// src/app/soil/page.tsx
export default function SoilPage() {
  return <ComingSoonPage
    moduleName="Soil"
    nameJa="土"
    description="DB 本体・大量データ基盤（リスト・コール履歴）"
    phase="Phase C"
  />;
}

// src/app/sprout/page.tsx
export default function SproutPage() {
  return <ComingSoonPage
    moduleName="Sprout"
    nameJa="新芽"
    description="採用→面接→内定→入社準備"
    phase="Phase B"
  />;
}

// src/app/fruit/page.tsx
export default function FruitPage() {
  return <ComingSoonPage
    moduleName="Fruit"
    nameJa="実"
    description="法人法的実体情報（番号系・許認可・登記簿）"
    phase="Phase B"
  />;
}

// src/app/rill/page.tsx
export default function RillPage() {
  return <ComingSoonPage
    moduleName="Rill"
    nameJa="川"
    description="Chatwork クローン自社開発"
    phase="Phase 最後（year-end 目標）"
  />;
}

// src/app/calendar/page.tsx
export default function CalendarPage() {
  return <ComingSoonPage
    moduleName="Calendar"
    nameJa="暦"
    description="営業予定・面接スロット・シフト・通知統合"
    phase="Phase B"
  />;
}
```

▼ Step 3: localhost 動作確認（東海林さん）

```
http://localhost:3002/
```

→ Ctrl+Shift+R で強制リロード

| # | 確認項目 | 期待 |
|---|---|---|
| 1 | 12 module hover | scale + ring 演出 全件表示 |
| 2 | Bloom click | /bloom (or /forest/login redirect で OK) |
| 3 | Forest click | /forest (login 画面) |
| 4 | Root click | /root (login 画面) |
| 5 | Tree click | /tree |
| 6 | Bud click | /bud (develop merge 後表示) |
| 7 | Leaf click | /leaf (develop merge 後表示) |
| 8 | Seed click | Coming Soon ページ |
| 9 | Soil click | Coming Soon ページ |
| 10 | Sprout click | Coming Soon ページ |
| 11 | Fruit click | Coming Soon ページ |
| 12 | Rill click | Coming Soon ページ |
| 13 | Calendar click | Coming Soon ページ |

▼ 完了基準

- [ ] V7-D-fix2: ホバー演出全 12 件で表示確認
- [ ] V7-E Step 2-A: develop merge 完了、Bud / Leaf 表示
- [ ] V7-E Step 2-B: 6 つの Coming Soon ページ作成、404 ゼロ
- [ ] 全テスト pass + TS / ESLint 0 errors
- [ ] localhost:3002 で東海林さん最終確認

▼ commit 単位（推奨）

1. fix(home): V7-D-fix2 - aspect-ratio 固定で hover 演出修正
2. merge: develop into feature/garden-common-ui-and-shoji-status (Bud/Leaf 取り込み)
3. feat(home): V7-E - 6 つの Coming Soon ページ + ComingSoonPage component

▼ 注意

- push 禁止（48h GitHub block 中、ローカル commit のみ）
- develop merge 後は a-main-009 へ SHA 共有
- conflict あれば慎重に解消（特に page.tsx 関連）
```

## 詳細 spec（a-bloom-002 が読む本文）

### Step 1 詳細: aspect-ratio 固定実装

**変更ファイル**: `src/app/page.tsx`

**変更前後の差分**:

```diff
- <main className="relative h-screen w-screen overflow-hidden">
-   <Image
-     src="/images/garden-home-bg-v2.png"
-     alt="..."
-     fill
-     priority
-     className="object-cover"
-   />
+ <main className="relative min-h-screen w-screen flex items-center justify-center bg-cream overflow-hidden">
+   <div className="relative w-full max-w-[1920px] aspect-[16/9]">
+     <Image
+       src="/images/garden-home-bg-v2.png"
+       alt="..."
+       fill
+       priority
+       className="object-contain"
+     />
      <ModuleHitAreas role={user.role} />
+   </div>
+ </main>
```

注意:
- `object-cover` → `object-contain`（画像全体表示、画像比率維持）
- `aspect-[16/9]` で container を画像と同比率に固定
- `bg-cream` で画像周囲の背景色を画像と整合（端の余白が違和感ない）

### Step 2-A 詳細: develop merge 手順

```bash
# 1. 最新化
cd /c/garden/a-bloom-002
git fetch origin develop

# 2. 現状確認
git status   # working tree clean のはず（dispatch v7 各 commit 済）
git log --oneline -3

# 3. merge 実行
git merge origin/develop --no-edit

# 4. conflict あれば
git status
# UU マークのファイルを Edit で解消
# 例: docs/effort-tracking.md → 両側保持（過去同様）
# 例: src/app/page.tsx → ours 採用（V7-D-fix2 維持）
git add <resolved files>
git -c core.editor=true commit --no-edit

# 5. 確認
git log --oneline -5
ls src/app/  # bud, leaf 等が増えているか
```

### Step 2-B 詳細: ComingSoonPage コンポーネント新規

**新規ファイル**: `src/app/_components/ComingSoonPage.tsx`（前述コード）

**6 つの placeholder page**: `src/app/{seed,soil,sprout,fruit,rill,calendar}/page.tsx`（前述コード）

各ページは `<ComingSoonPage>` を呼ぶだけのシンプル実装。

### Step 3: localhost 動作確認（東海林さん）

各 12 module を click → 何らかの画面に到達することを確認。

## 改訂履歴

- 2026-04-27 初版（a-main-009、5/5 デモ向け 全完成方針、ホバー修正 + 404 全解消統合 dispatch）
