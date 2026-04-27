# 自律実行レポート - a-auto - 2026-04-27 01:00 - タスク H: cross-ui-04/06/01 大改訂（盆栽ビュー仕様化）

## 結果サマリ

GW 中の「動く本物 = 図 2 盆栽中心ビュー」を実装可能にするため、3 つの cross-ui spec を大改訂。
**後道さん UX 採用ゲート**の決定的制約を反映。

## ブランチ
- `feature/cross-ui-godo-redesign-20260427-auto`（base: `origin/feature/cross-ui-design-specs-batch10-auto`）
- commit: `44910da`（本タスク）+ cherry-pick 2 件（M-1/M-2/M-4 + 8-role 既存維持）

## 改訂内容

### cross-ui-01-layout-theme.md（578 行 / +255）
- **業務システム → 業務 OS 世界観演出**にトーン格上げ
- 12 モジュール（Sprout / Calendar 追加）+ 12 ブランドカラー定義
- ShojiStatusWidget 3 案（A 既存 / B 盆栽の右下 / C 月の隣）
- Header 透過度 0.85 など世界観調和の指針追加

### cross-ui-04-time-theme.md（593 行 / +480）
- **抽象風景 15 枚 → 盆栽 / 樹木中心 5+ パターン × 時間帯**に再定義
- 朝 / 昼 / 夕 / 夜 / ランダム（春桜 / 夏濃緑 / 秋紅葉 / 冬雪）
- WebP 推奨、Cache-Control: max-age=86400
- **`<BackgroundLayer>` 独立化** — props で imagePath 受取、layout 影響なし
- 後道さんが画像変更要望 → 差し替え容易

### cross-ui-06-access-routing.md（704 行 / +590）
- **9 アイコン グリッド → 盆栽中心ビュー + 12 モジュール立体配置**に全面再定義
- 12 モジュール固有 hover 演出（葉が揺れる / 月が瞬く / 川が流れる 等）
- **完全分離アーキテクチャ**（BackgroundLayer / ModuleLayer）
- 8-role アクセス制御（既存 §4.3 維持、outsource 含む）

## 12 モジュール立体配置

```
       Calendar             Forest         (左上 -35%/-30%, 右上 +35%/-30%)
        (暦)                  (森)
   Rill          ┌─────┐         Bud      (左 -45%/-5%, 右 +45%/-5%)
   (川)          │ 盆栽 │         (蕾)
                 │     │
   Tree          │     │         Bloom    (左 -25%/+5%, 右 +25%/+5%)
   (木)          └─────┘         (花)
       Soil                       Leaf     (左下 -35%/+25%, 右下 +35%/+25%)
       (土)                        (葉)
       Root      Seed     Sprout            (中下行)
       (根)      (種)      (芽)
                Fruit                       (中央枝先)
                (実)
```

各モジュールの位置に「世界観としての意味」が付与（土は根を支える、Tree は幹そのもの、Bud は咲く前の蕾、等）。

## 完全分離アーキテクチャ実装方針

### 2 layer 構造
- `<BackgroundLayer imagePath={...} fallbackPath={...} overlayDark={...} />` — 背景画像のみ責務、UI-04 から URL 受取
- `<ModuleLayer>` 内に `<ModulePin module="..." position={{x,y}} />` を 12 個配置 — 抽象座標（中央からの %）

### 差し替えシナリオ
- 後道さん「画像変えて」 → `imagePath` のみ差替、layout 不変
- 「桜のバリエーション追加」 → BackgroundLayer の画像追加のみ
- 「配置が窮屈」 → ModuleLayer の `position` のみ調整、画像不変

### 座標系
- (0,0) = 画面中央 = 盆栽位置
- x = +右 / -左、y = +下 / -上
- 画面 % 換算（レスポンシブ時も座標維持）

## ShojiStatusWidget 3 案併記

| 案 | 配置 | 世界観 | 視認性 | 業務効率 |
|---|---|---|---|---|
| A（既存）| ヘッダー右端 | △ | ◎ | ◎ |
| B（新案）| 盆栽の右下に控えめ（ホーム画面のみ）| ◎ | △ | △ |
| C（新案）| 月 / 太陽（時間帯）の隣 | ◎ | ◯ | ◯ |

両立案: ホーム盆栽ビューでは案 B / 各アプリ内ヘッダーは案 A。判断は東海林さんに委ねる。

## subagent 稼働
- 稼働時間: 637,437 ms（約 10.6 分）
- tool uses: 35
- 使用トークン: 124,561

## push 状態
GitHub アカウント suspend 継続中（HTTP 403）、ローカル commit のみ。

## 関連
- broadcast: `docs/broadcast-202604270100/summary.md`
- ペア: タスク I（画像生成プロンプト）
