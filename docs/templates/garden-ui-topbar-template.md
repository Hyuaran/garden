# Garden UI 共通テンプレート: topbar（ヘッダー）

> 出典: `_chat_workspace/garden-forest/html_drafts/tab-1-dashboard.html` line 845-889（既稼働 Forest UI から抽出）
> 起草: a-main-020、2026-05-11 10:30
> 適用範囲: Garden 全モジュール共通候補（Bloom / Forest / Tree / Bud / Leaf / Root / Rill / Soil / Sprout / Calendar / Fruit / Seed）
> モジュール別カスタマイズ箇所: breadcrumb 文字 / user-info の権限表記 / page-context

## 構造（HTML、コピペベース）

```html
<header class="topbar">
 <a href="../../../015_Gardenシリーズ/000_GardenUI/index.html" class="topbar-brand" title="Garden Series ホームへ戻る" style="text-decoration:none;">
   <img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/logo/garden_logo.png" alt="Garden Series" class="topbar-brand-img" id="topbarBrandImg">
 </a>
 <div class="search-box">
   <span class="search-icon"><img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/header_icons/header_search.png" alt=""></span>
   <input type="text" placeholder="検索(法人、決算、KPI、納税、ヘルプなど)">
   <span class="search-shortcut">Ctrl+F</span>
 </div>
 <div class="topbar-info">
   <div class="info-item">
     <span class="info-icon"><img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/header_icons/header_calendar.png" alt=""></span>
     <span class="info-text">[日付]</span>
   </div>
   <div class="info-item">
     <span class="info-icon"><img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/header_icons/weather_01_sunny.png" alt="" id="weatherIcon"></span>
     <div class="info-text">
       <strong id="weatherTemp">[気温]</strong>
       <small id="weatherLabel">[天気]</small>
     </div>
   </div>
   <div class="info-item">
     <span class="status-dot"></span>
     <span class="info-text">すべてのシステム正常</span>
   </div>
   <button class="header-tool-btn theme-toggle" id="themeToggle" title="ライト/ダーク切替">
     <img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/theme_icons/theme_sun.png" alt="" id="themeToggleIcon">
   </button>
   <button class="header-tool-btn header-notify-btn" id="notifyBtn" title="通知">
     <img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/header_icons/header_bell.png" alt="">
     <span class="header-tool-badge" id="notifyBadge">[件数]</span>
   </button>
   <button class="header-tool-btn help-btn" id="helpBtn" title="ヘルプ・使い方ガイド">
     <img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/header_icons/D-02_help_simple.png" alt="">
   </button>
   <div class="user-area" id="userArea" tabindex="0">
     <div class="user-avatar"><img src="../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/avatar/avatar_shoji.png" alt="[氏名]"></div>
     <div class="user-info">
       <strong>[氏名]</strong>
       <small>[権限表記]</small>
     </div>
     <span class="user-arrow">⌄</span>
   </div>
 </div>
</header>
```

## モジュール別カスタマイズ表

| 箇所 | デフォルト（Forest 既稼働）| Bloom / Tree / 他モジュール |
|---|---|---|
| topbar-brand | Garden Series ロゴ → ホームへ | 共通（変更不要） |
| search-box placeholder | 「検索(法人、決算、KPI、納税、ヘルプなど)」 | モジュール固有検索対象に変更（例: Tree なら「検索(リスト、コール、案件、商材など)」） |
| info-item 日付 / 天気 / システム状態 | 共通 | 共通 |
| theme-toggle / notify-btn / help-btn | 共通 | 共通 |
| user-area | 東海林 美琴 / 正社員 / 全権管理者 | 動的（ログインユーザー）、本番では Bloom 統一認証から取得 |

## 注意事項

| # | 内容 |
|---|---|
| 1 | 共通 CSS は `06_CEOStatus/css/style.css` 経由で適用、本テンプレで CSS 重複定義しない |
| 2 | image 参照は `../../../015_Gardenシリーズ/000_GardenUI_bloom/06_CEOStatus/images/...` 相対パス、配置場所により ../ 階層数調整 |
| 3 | data-theme 切替は theme-toggle ボタン経由、Forest / Bloom 共通の theme observer 機構を踏襲 |
| 4 | search-box は Garden 横断検索（Phase D 以降実装）、本テンプレでは UI のみ |

## 改訂履歴

- 2026-05-11 10:30 v1 初版（a-main-020 起草、Forest UI シフト議論の共通テンプレート抽出第 1 弾、tab-1 既稼働から抽出）
