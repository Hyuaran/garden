# a-bloom-002 dispatch v7 V7-D - 12 モジュールアイコン + KPI 4 つ目修正 - 2026-04-27

> 起草: a-main-009
> 用途: V7-A/B/C に続く V7-D。ChatGPT で生成した 12 モジュール水彩アイコン適用 + KPI 4 つ目（架電状況）表示バグ修正
> 前提: V7-A 完了（SHA `ababd29`）、画像 12 個配置済（`public/images/module-icons/{module}.png`）

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】dispatch v7 V7-D - 12 モジュールアイコン水彩刷新 + KPI 4 つ目バグ修正

▼ 経緯
- localhost:3002 で動作確認 → ChatGPT 理想画面と差分 5 点指摘
- 東海林さんが ChatGPT で 12 モジュール水彩アイコンを個別生成（12 個揃い）
- a-main-009 が public/images/module-icons/{module}.png に配置済（12 ファイル）
- 5/5 後道さんデモ用に「全く同じ」見た目を実現
- 注: GitHub push 48h block 中、ローカル commit のみで進行

▼ 配置済 画像（即使用可）

public/images/module-icons/
- soil.png       (DB・大量データ、鉱石 / 苔モチーフ)
- root.png       (組織・顧客・マスタ、根モチーフ)
- tree.png       (架電アプリ、盆栽モチーフ)
- leaf.png       (商材・トスアップ、葉モチーフ)
- bud.png        (経理・収支、蕾モチーフ)
- bloom.png      (案件一覧・KPI、花モチーフ)
- seed.png       (新事業枠、種モチーフ)
- forest.png     (全法人決算、森モチーフ)
- rill.png       (Chatwork クローン、川モチーフ)
- fruit.png      (法人法的実体、実モチーフ)
- sprout.png     (採用・入社、新芽モチーフ)
- calendar.png   (営業予定・シフト、暦モチーフ)

▼ 大改修 2 ポイント概要

1. **ModuleSlot を画像差替対応**: 既存の CSS ボタニカルモチーフ → public/images/module-icons/{module}.png 表示
2. **KPI 4 つ目（架電状況）バグ修正**: super_admin に表示されない問題を確認・修正

▼ 詳細 spec ファイル

`docs/bloom-002-dispatch-v7-d-module-icons-and-kpi-fix-20260427.md` を参照（このファイル）。下部「## 詳細 spec」セクション読込。

▼ 期待結果

- branch: feature/garden-common-ui-and-shoji-status（既存継続）
- ローカル commit のみ（push は GitHub 復旧後 a-main-009 が一括対応）
- 各 step 完了で a-main-009 に SHA 共有

▼ 完了基準

- [ ] ModuleSlot に画像表示、12 モジュール 全表示確認
- [ ] KPI 4 つ目（架電状況）super_admin で表示
- [ ] localhost:3002 で動作確認（東海林さん側）
- [ ] 全テスト pass + TS / ESLint 0 errors
```

---

## 詳細 spec

### Step 1: ModuleSlot 画像差替対応（0.3d）

**現状**: `src/app/_components/ModuleSlot.tsx`（or 同等のコンポーネント）が CSS でボタニカルモチーフを描画

**変更後**: 各モジュールの画像（`public/images/module-icons/{module}.png`）を `next/image` で表示

**実装例**:

```tsx
// src/app/_lib/modules.ts または同等
export type ModuleId =
  | "soil" | "root" | "tree" | "leaf" | "bud" | "bloom"
  | "seed" | "forest" | "rill" | "fruit" | "sprout" | "calendar";

export interface ModuleConfig {
  id: ModuleId;
  nameEn: string;        // "Soil"
  nameJa: string;        // "土"
  description: string;   // "DB・大量データ基盤"
  href: string;          // "/soil"
  iconPath: string;      // "/images/module-icons/soil.png"
  layer: "canopy" | "ground" | "underground";
  minRole: Role;
}

export const MODULES: ModuleConfig[] = [
  {
    id: "bloom",
    nameEn: "Bloom",
    nameJa: "花",
    description: "案件一覧・日報・KPI・ダッシュボード",
    href: "/bloom",
    iconPath: "/images/module-icons/bloom.png",
    layer: "canopy",
    minRole: "staff",
  },
  // ... 12 件分
];
```

**ModuleSlot 表示**:

```tsx
import Image from "next/image";

export function ModuleSlot({ module, role }: Props) {
  if (!isVisible(module, role)) return <DisabledSlot />;

  return (
    <Link href={module.href} className="...">
      <div className="aspect-square ... rounded-xl bg-white/85 backdrop-blur-sm">
        <Image
          src={module.iconPath}
          alt={module.nameEn}
          width={120}
          height={120}
          className="object-contain"
        />
        <div className="text-lg font-semibold">{module.nameEn}</div>
        <div className="text-xs text-muted-foreground">{module.description}</div>
      </div>
    </Link>
  );
}
```

**配置順**（CLAUDE.md 1-12 順 + 3 layer 縦階層を反映）:

```
Row 1 (canopy/樹冠):  Bloom    | Fruit    | Seed     | Forest
Row 2 (地上):          Bud      | Leaf     | Tree     | Sprout
Row 3 (地下):          Soil     | Root     | Rill     | Calendar
```

### Step 2: KPI 4 つ目（架電状況）バグ修正（0.2d）

**バグ症状**: localhost:3002 で確認時、KPI カードが 3 つしか表示されない（売上 / 入金予定 / 未処理タスク のみ、架電状況が抜け）

**確認ポイント**:

1. `src/app/_lib/kpi-fetchers.ts`（or 同等）の `KPI_CARDS` 定義に **架電状況** が含まれているか
2. role filter が `manager / staff / closer / cs` のみに制限されているなら、**super_admin / admin** も表示対象に追加
3. `src/app/_components/KpiCard.tsx`（or 同等）の visible 判定ロジックを修正

**期待表示**（super_admin / admin / manager で 4 KPI 全表示）:

| カード | モック値 | role |
|---|---|---|
| 売上（今月）| ¥12,680,000（+12.5%）| super_admin / admin / manager |
| 入金予定（今月）| ¥8,450,000（+8.3%）| super_admin / admin / manager |
| **架電状況（今日）** | **68%（34/50 件）** | **super_admin / admin / manager / staff / closer / cs** |
| 未処理タスク | 24 件（期限超過 5 件）| 全 role（自分担当のみ）|

→ super_admin / admin は **全 4 カード表示**、staff 以下は role 別 fil タリング維持。

### Step 3: テスト追加（0.2d）

- ModuleSlot 画像表示テスト（12 モジュール各画像 src 確認）
- KPI super_admin で 4 カード表示テスト
- 既存テスト維持

### Step 4: localhost 動作確認（東海林さん）

```
http://localhost:3002/
```

確認項目:

| # | 項目 | 期待 |
|---|---|---|
| 1 | 12 モジュールカード | 各画像（soil.png 等）表示 |
| 2 | カード hover | scale + ring 演出 |
| 3 | カードクリック | 該当モジュール遷移 |
| 4 | KPI カード数 | **4 つ表示**（架電状況含む）|
| 5 | 全体感 | ChatGPT 理想画面 と概ね一致 |

### 実装上の注意

- 画像は `public/images/module-icons/{module}.png` に既配置済（cp 不要、即使用可）
- `next/image` の最適化で自動 WebP 変換（速度向上）
- 既存テスト 727+ 全 pass 維持
- TypeScript / ESLint 0 errors
- commit メッセージ: `feat(home): dispatch v7 group D - 12 module icons + KPI 4 fix`
- **push 禁止**（48h GitHub block 中、ローカル commit のみ）

### 完了報告先

各 step 完了で a-main-009 に SHA + localhost 動作確認結果共有。

## 改訂履歴

- 2026-04-27 初版（a-main-009、ChatGPT 12 モジュール水彩アイコン適用 + KPI 4 つ目バグ修正、push block 中ローカル commit only）
