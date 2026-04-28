# a-bloom-002 dispatch v7 V7-E 単独版 - 404 全解消（develop merge + Coming Soon）- 2026-04-27

> 起草: a-main-009
> 用途: V7-D-fix2 完了後、404 全解消の単独 dispatch（前 dispatch で本文末尾切れた問題への対応）
> 前提: V7-D-fix2 完了（commit `e2f7570`）、ローカル commit のみで進行（48h GitHub block 中）

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】dispatch v7 V7-E 単独版 - 404 全解消

▼ V7-D-fix2 完了確認 ✅（commit e2f7570）。引き続き V7-E 着手依頼。

▼ Step 2-A: develop merge（Bud / Leaf 取り込み）

cd /c/garden/a-bloom-002
git fetch origin develop
git status   # working tree clean のはず

# merge 実行
git merge origin/develop --no-edit

# conflict あれば解消
# - src/app/page.tsx → ours 採用（V7-D-fix2 維持）
# - docs/effort-tracking.md → 両側保持
# 解消後:
git add <resolved files>
git -c core.editor=true commit --no-edit

# 確認
ls src/app/   # bud, leaf 等が増えているか

▼ Step 2-B: 未実装 6 モジュール Coming Soon ページ作成

対象ルート: /seed, /soil, /sprout, /fruit, /rill, /calendar

新規ファイル 1: src/app/_components/ComingSoonPage.tsx

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
      <p className="text-base text-amber-700 mb-8">{phase} で実装予定です</p>
      <Link
        href="/"
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-colors"
      >
        ホームへ戻る
      </Link>
    </main>
  );
}

新規 6 ファイル: src/app/{seed,soil,sprout,fruit,rill,calendar}/page.tsx

各ファイルは ComingSoonPage を呼ぶだけ:

// src/app/seed/page.tsx
import { ComingSoonPage } from "@/app/_components/ComingSoonPage";
export default function SeedPage() {
  return <ComingSoonPage moduleName="Seed" nameJa="種" description="新商材・新事業の拡張枠" phase="Phase C" />;
}

// src/app/soil/page.tsx
import { ComingSoonPage } from "@/app/_components/ComingSoonPage";
export default function SoilPage() {
  return <ComingSoonPage moduleName="Soil" nameJa="土" description="DB 本体・大量データ基盤" phase="Phase C" />;
}

// src/app/sprout/page.tsx
import { ComingSoonPage } from "@/app/_components/ComingSoonPage";
export default function SproutPage() {
  return <ComingSoonPage moduleName="Sprout" nameJa="新芽" description="採用→面接→内定→入社準備" phase="Phase B" />;
}

// src/app/fruit/page.tsx
import { ComingSoonPage } from "@/app/_components/ComingSoonPage";
export default function FruitPage() {
  return <ComingSoonPage moduleName="Fruit" nameJa="実" description="法人法的実体情報（番号系・許認可・登記簿）" phase="Phase B" />;
}

// src/app/rill/page.tsx
import { ComingSoonPage } from "@/app/_components/ComingSoonPage";
export default function RillPage() {
  return <ComingSoonPage moduleName="Rill" nameJa="川" description="Chatwork クローン自社開発" phase="Phase 最後（year-end 目標）" />;
}

// src/app/calendar/page.tsx
import { ComingSoonPage } from "@/app/_components/ComingSoonPage";
export default function CalendarPage() {
  return <ComingSoonPage moduleName="Calendar" nameJa="暦" description="営業予定・面接スロット・シフト・通知統合" phase="Phase B" />;
}

▼ commit 単位（推奨）

1. merge: develop into feature/garden-common-ui-and-shoji-status (Bud/Leaf 取り込み)
2. feat(home): V7-E - 6 つの Coming Soon ページ + ComingSoonPage component

▼ 完了基準

- [ ] develop merge 完了、Bud / Leaf 表示確認
- [ ] 6 つの Coming Soon ページ作成、404 ゼロ
- [ ] 全テスト pass + TS / ESLint 0 errors
- [ ] localhost:3002 で東海林さん最終確認

▼ 注意

- push 禁止（48h GitHub block 中）
- conflict あれば慎重に解消
- 既存 6 モジュール（/bloom, /forest, /root, /tree, /bud, /leaf）は触らない
- ComingSoonPage の絵文字（🍃 等）は CLAUDE.md ルール「emoji 控えめ」配慮で削除済（テキスト「ホームへ戻る」のみ）
```

## 前 dispatch との差分

| 項目 | 前 dispatch（合体版）| 本 dispatch（単独版）|
|---|---|---|
| Step 1 ホバー修正 | 含む | 不要（既完了）|
| Step 2-A develop merge | 含む（簡略）| 含む（同等）|
| Step 2-B Coming Soon | 含む（コード末尾切れ）| **含む（コード完全版）** |
| 投下短文長さ | 長い（切れた）| 中程度 |

## 改訂履歴

- 2026-04-27 初版（a-main-009、V7-E のみ単独 dispatch、前 dispatch コード切れ問題対応）
