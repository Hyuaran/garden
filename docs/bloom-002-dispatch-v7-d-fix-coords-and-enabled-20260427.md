# a-bloom-002 dispatch v7 V7-D-fix - 座標微調整 + enabled 全 12 件化 - 2026-04-27

> 起草: a-main-009
> 用途: V7-D 実装後の動作確認で発見された 2 問題（座標ズレ / enabled 4 件のみ）の修正
> 前提: V7-D 実装済（commit `82b7223`、`a4fe66a`）、localhost:3002 で動作確認結果フィードバック反映

## 投下短文（東海林さんが a-bloom-002 にコピペ）

```
【a-main-009 から a-bloom-002 へ】dispatch v7 V7-D-fix - 座標微調整 + enabled 全 12 件化

▼ 経緯

V7-D 実装後 localhost:3002 で動作確認、東海林さんから 3 問題報告:

1. ホバー演出（scale + ring）が見えない
2. enabled 4 件（Bloom/Forest/Tree/Root）のみ click 可能、他 8 件 disabled
3. 座標ズレ:
   - Bloom/Forest/Tree/Root クリックできない
   - Seed クリックすると Tree のログイン画面に飛ぶ
   - Leaf クリックすると Root のログイン画面に飛ぶ

▼ 原因分析

1. **座標ズレ主因**: ModuleHitAreas の HIT_AREAS 座標（x=23/37/51/65%, y=43/58/73%）が実画像の module 位置と不一致
2. **enabled 4 件のみ**: a-bloom-002 が「実装済みルート」のみ enabled とした独自判断、東海林さん（super_admin）は全 12 件 click 可能であるべき
3. **ホバー演出見えない**: hit area が実画像 module 位置に重なっていないため、ホバー時に画像 module の上にカーソルがあっても hit area には当たっていない

▼ 修正 1: 座標更新

実画像（home-design-ideal-v4-final.png）を a-main-009 が読み込み視覚測定。新座標:

| Module | x% | y% | (旧 → 新) |
|---|---|---|---|
| Row 1 (canopy) y=53% | | | (旧 y=43) |
| Bloom | 18 | 53 | (旧 23, 43) |
| Fruit | 33 | 53 | (旧 37, 43) |
| Seed | 49 | 53 | (旧 51, 43) |
| Forest | 64 | 53 | (旧 65, 43) |
| Row 2 (ground) y=71% | | | (旧 y=58) |
| Bud | 18 | 71 | |
| Leaf | 33 | 71 | |
| Tree | 49 | 71 | |
| Sprout | 64 | 71 | |
| Row 3 (underground) y=88% | | | (旧 y=73) |
| Soil | 18 | 88 | |
| Root | 33 | 88 | |
| Rill | 49 | 88 | |
| Calendar | 64 | 88 | |

カードサイズ: width=13%, height=16%（旧 11%, 13%）

⚠️ object-fit: cover で画面比率により画像が crop される問題があるため、もし座標がそれでもズレるなら次の検討:
- Image fill → 固定 aspect-ratio container に変更
- 画像 1920x1080 を container 基準に、hit area も同 container 内で % 配置

▼ 修正 2: enabled 全 12 件化

東海林さんは super_admin role のため、全 12 module が click 可能であるべき。

ModuleHitAreas の filter ロジック修正:

```ts
// 旧: 「実装済みルート」のみ enabled の独自判断 → 削除
// 新: minRole で role filter のみ、disabled 概念削除（全 enabled）

return HIT_AREAS
  .filter((h) => isRoleAtLeast(role, h.minRole))
  .map((h) => (
    <Link key={h.id} href={h.href} ...>
      {/* 透明 hit area */}
    </Link>
  ));
```

未実装ルート（/seed, /soil, /sprout, /fruit, /rill, /calendar）も Link で OK（404 になっても 5/5 デモ後に実装）。

または、未実装ルートには href="#" + onClick で Toast 表示（「○○ モジュールは Phase X で実装予定」）の方が UX 良い。

▼ 修正 3: ホバー演出確認

修正 1 完了後、座標が正しくなれば自動的にホバー演出（scale-105 + ring-2）が見える。

念のため globals.css の .v7d-hit を確認 + Edge DevTools (F12) → Console / Elements で hover 時の class が当たっているか確認。

▼ 実装手順

1. ModuleHitAreas.tsx の HIT_AREAS 座標を上記値に更新
2. enabled filter から「実装済みルート」判定削除、role 判定のみに
3. localhost:3002 で東海林さん再確認
4. ズレあれば座標微調整
5. ローカル commit + SHA 報告

▼ 完了基準

- [ ] 12 module hit area が画像内モジュール位置と完全一致（hover 演出見える）
- [ ] super_admin で全 12 module click 可能
- [ ] Bloom/Forest/Tree/Root クリックで該当遷移
- [ ] Seed/Leaf 等の disabled 動作（Tree/Root のログインに飛ぶ問題）解消
- [ ] localhost:3002 動作確認 OK
- [ ] push 禁止（48h GitHub block 中、ローカル commit のみ）
```

## 詳細座標更新（参考、a-bloom-002 で TypeScript 直接編集）

```ts
const HIT_AREAS: HitArea[] = [
  // Row 1 (canopy) y=53%
  { id: "bloom", nameEn: "Bloom", description: "案件一覧・日報・KPI",
    href: "/bloom", x: 18, y: 53, w: 13, h: 16, minRole: "staff" },
  { id: "fruit", nameEn: "Fruit", description: "法人法的実体・登記",
    href: "/fruit", x: 33, y: 53, w: 13, h: 16, minRole: "manager" },
  { id: "seed", nameEn: "Seed", description: "新事業枠",
    href: "/seed", x: 49, y: 53, w: 13, h: 16, minRole: "manager" },
  { id: "forest", nameEn: "Forest", description: "全法人決算",
    href: "/forest", x: 64, y: 53, w: 13, h: 16, minRole: "manager" },

  // Row 2 (ground) y=71%
  { id: "bud", nameEn: "Bud", description: "経理・収支",
    href: "/bud", x: 18, y: 71, w: 13, h: 16, minRole: "staff" },
  { id: "leaf", nameEn: "Leaf", description: "商材・トスアップ",
    href: "/leaf", x: 33, y: 71, w: 13, h: 16, minRole: "staff" },
  { id: "tree", nameEn: "Tree", description: "架電アプリ",
    href: "/tree", x: 49, y: 71, w: 13, h: 16, minRole: "toss" },
  { id: "sprout", nameEn: "Sprout", description: "採用・入社",
    href: "/sprout", x: 64, y: 71, w: 13, h: 16, minRole: "staff" },

  // Row 3 (underground) y=88%
  { id: "soil", nameEn: "Soil", description: "DB・大量データ",
    href: "/soil", x: 18, y: 88, w: 13, h: 16, minRole: "staff" },
  { id: "root", nameEn: "Root", description: "組織・顧客・マスタ",
    href: "/root", x: 33, y: 88, w: 13, h: 16, minRole: "staff" },
  { id: "rill", nameEn: "Rill", description: "業務連絡・メッセージング",
    href: "/rill", x: 49, y: 88, w: 13, h: 16, minRole: "outsource" },
  { id: "calendar", nameEn: "Calendar", description: "営業予定・シフト",
    href: "/calendar", x: 64, y: 88, w: 13, h: 16, minRole: "staff" },
];
```

## 改訂履歴

- 2026-04-27 初版（a-main-009、V7-D 動作確認後の座標 + enabled 修正）
