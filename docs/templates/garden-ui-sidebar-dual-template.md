# Garden UI 共通テンプレート: sidebar.sidebar-dual（左サイドバー 2 段構造）

> 出典: `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html` line 892-919（既稼働 Forest UI から抽出）
> 起草: a-main-020、2026-05-11 10:30
> 適用範囲: Garden 全モジュール共通候補
> 構造: 1 本目 nav-apps（12 モジュール、全モジュール共通） + 2 本目 nav-pages（モジュール別カスタマイズ）

## 構造（HTML、コピペベース）

```html
<aside class="sidebar sidebar-dual" id="sidebarDual">
 <nav class="nav-apps" id="navApps" aria-label="Garden Series アプリ一覧">
   <a href="#" class="nav-app-item" data-app="bloom" data-status="dev" title="Bloom"><span class="nav-app-icon"><img src=".../orb_bloom.png" alt=""></span><span class="nav-app-name">Bloom</span></a>
   <a href="#" class="nav-app-item" data-app="fruit" data-status="concept" title="Fruit"><span class="nav-app-icon"><img src=".../orb_fruit.png" alt=""></span><span class="nav-app-name">Fruit</span></a>
   <a href="#" class="nav-app-item" data-app="seed" data-status="todo" title="Seed"><span class="nav-app-icon"><img src=".../orb_seed.png" alt=""></span><span class="nav-app-name">Seed</span></a>
   <a href="#" class="nav-app-item" data-app="forest" data-status="dev" title="Forest"><span class="nav-app-icon"><img src=".../orb_forest.png" alt=""></span><span class="nav-app-name">Forest</span></a>
   <a href="#" class="nav-app-item" data-app="bud" data-status="dev" title="Bud"><span class="nav-app-icon"><img src=".../orb_bud.png" alt=""></span><span class="nav-app-name">Bud</span></a>
   <a href="#" class="nav-app-item" data-app="leaf" data-status="dev" title="Leaf"><span class="nav-app-icon"><img src=".../orb_leaf.png" alt=""></span><span class="nav-app-name">Leaf</span></a>
   <a href="#" class="nav-app-item" data-app="tree" data-status="released" title="Tree"><span class="nav-app-icon"><img src=".../orb_tree.png" alt=""></span><span class="nav-app-name">Tree</span></a>
   <a href="#" class="nav-app-item" data-app="sprout" data-status="todo" title="Sprout"><span class="nav-app-icon"><img src=".../orb_sprout.png" alt=""></span><span class="nav-app-name">Sprout</span></a>
   <a href="#" class="nav-app-item" data-app="soil" data-status="released" title="Soil"><span class="nav-app-icon"><img src=".../orb_soil.png" alt=""></span><span class="nav-app-name">Soil</span></a>
   <a href="#" class="nav-app-item" data-app="root" data-status="released" title="Root"><span class="nav-app-icon"><img src=".../orb_root.png" alt=""></span><span class="nav-app-name">Root</span></a>
   <a href="#" class="nav-app-item" data-app="rill" data-status="dev" title="Rill"><span class="nav-app-icon"><img src=".../orb_rill.png" alt=""></span><span class="nav-app-name">Rill</span></a>
   <a href="#" class="nav-app-item" data-app="calendar" data-status="todo" title="Calendar"><span class="nav-app-icon"><img src=".../orb_calendar.png" alt=""></span><span class="nav-app-name">Calendar</span></a>
 </nav>
 <nav class="nav-pages" id="navPages" aria-label="[モジュール名] メニュー">
   <a href="#" class="nav-pages-header" title="[モジュール名] ホームへ">
     <span class="nav-pages-app-icon"><img src=".../orb_[モジュール].png" alt=""></span>
     <span class="nav-pages-app-name">[モジュール名]</span>
   </a>
   <div class="nav-pages-divider"></div>
   <!-- モジュール固有のページ一覧、active class は current ページに付与 -->
   <a href="?tab=1" class="nav-page-item active"><span class="nav-page-icon">[絵文字]</span><span class="nav-page-label">[ページ名]</span></a>
   ...（モジュール固有）
 </nav>
</aside>

<!-- メニュー名表示切替ボタン -->
<button class="nav-pages-toggle" id="navPagesToggle" type="button" title="メニュー名の表示/非表示" aria-label="メニュー名の表示/非表示" aria-expanded="true">
 <span class="nav-pages-toggle-arrow" aria-hidden="true">›</span>
</button>
```

## 1 本目 nav-apps（全モジュール共通）

12 モジュール orb 並び順（Forest 既稼働 tab-1 準拠）:

| 順 | data-app | data-status | 用途 |
|---|---|---|---|
| 1 | bloom | dev | ダッシュボード / 日報 / KPI |
| 2 | fruit | concept | 法人法的実体情報（Phase B 配置） |
| 3 | seed | todo | 新商材・新事業拡張枠 |
| 4 | forest | dev | 経営ダッシュボード（本テンプレ起源）|
| 5 | bud | dev | 経理・収支・振込・損益・給与 |
| 6 | leaf | dev | 商材×商流ごとの個別アプリ |
| 7 | tree | released | 架電アプリ（FileMaker 代替）|
| 8 | sprout | todo | Sprout（仮、Phase 配置確認）|
| 9 | soil | released | DB 基盤（リスト・コール履歴）|
| 10 | root | released | 組織・従業員・パートナー |
| 11 | rill | dev | チャット（Chatwork 連携 → 自社クローン）|
| 12 | calendar | todo | カレンダー |

各モジュールセッションで現在モジュールに active class 付与（例: Forest なら `data-app="forest"` 行に `class="nav-app-item active"`）。

## 2 本目 nav-pages（モジュール別カスタマイズ必須）

### Forest 例（tab-1 既稼働、8 タブ）

| 順 | アイコン | label | href | 状態 |
|---|---|---|---|---|
| 1 | 📊 | ダッシュボード | ?tab=1 | 既稼働 |
| 2 | 📈 | 財務サマリー | ?tab=2 | 修正版完成 |
| 3 | 💧 | キャッシュフロー | ?tab=3 | 起草中（main- No. 221）|
| 4 | 🎯 | 事業 KPI | ?tab=4 | 未起草 |
| 5 | ⚖ | 予実対比 | ?tab=5 | 未起草 |
| 6 | ⚠ | アラート・リスク | ?tab=6 | 未起草 |
| 7 | 📄 | レポート分析 | ?tab=7 | 未起草 |
| 8 | ⇄ | 法人間取引・手元現金 | ?tab=8 | 未起草 |

### 他モジュール想定（Bloom / Tree / 等）

各モジュールが nav-pages を独自に定義。例:
- Bloom: ダッシュボード / 日報 / KPI / 案件一覧 / 6 画面（Phase A 進行中）
- Tree: 架電画面 / リスト / 案件 / 履歴 / 等
- Bud: 振込 / 明細 / 損益 / 給与 / 等

## 注意事項

| # | 内容 |
|---|---|
| 1 | nav-apps の data-app + data-status は data-attribute、CSS / JS で利用（status 別アイコン透明度等） |
| 2 | active class は current ページに付与、他は通常表示 |
| 3 | 画像参照パスは `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/icons_bloom/orb_*.png` 等、配置場所により階層調整 |
| 4 | nav-pages-toggle ボタンは sidebar 内ではなく sidebar 外（直後）に配置 |
| 5 | aria-label / aria-expanded 等のアクセシビリティ属性は保持 |

## 改訂履歴

- 2026-05-11 10:30 v1 初版（a-main-020 起草、Forest UI シフト議論の共通テンプレート抽出第 2 弾、tab-1 既稼働から抽出）
