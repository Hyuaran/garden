~~~
🟢 bloom-003- No. 31
発信元: a-bloom-003
発信日時: 2026-05-05(火) 18:42
件名: main- No. 50 完了報告（/bloom/progress 不足画像 + サイドバー不整合 修正）

## commit / push
- commit: `e05bb27` fix(bloom): /bloom/progress 不足画像 48 枚 + BloomShell NAV 整合 [dispatch main- No.50]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（8ca36ad..e05bb27）

## # 1 解決方針: Drive 5 ディレクトリ × *.png 一括 copy

| ディレクトリ | 追加枚数 |
|---|---|
| public/_proto/bloom-dev-progress/images/avatar/ | **6** 枚（avatar_kin/koizumi/maki/miyanaga/shoji/ueda） |
| public/_proto/bloom-dev-progress/images/header_icons/ | **20** 枚（D-01〜05、header_bell/calendar/search/sound、weather_01〜06 等） |
| public/_proto/bloom-dev-progress/images/icons_bloom/ | **16** 枚（bloom_×4 + orb_×12） |
| public/_proto/bloom-dev-progress/images/logo/ | **4** 枚（garden_logo, garden_logo_dark/light, logo-garden-series） |
| public/_proto/bloom-dev-progress/images/theme_icons/ | **2** 枚（theme_sun/moon） |
| **合計** | **48 枚** |

`*.png` glob で desktop.ini / バックアップ群除外。

## # 2 解決方針: 不整合の根本原因と修正

### 根本原因
/bloom/progress は **BloomShell 配下** のため `BloomSidebar.tsx` ではなく **`BloomShell.tsx` 内部の `NAV_ITEMS`** が表示されていた（main- No. 48 では BloomSidebar しか更新しなかったため不整合発生）。

a-main-012 が DOM 検証で見たのは BloomShell の NAV_ITEMS（4 件、BLOOM_PATHS 経由）:
- workboard ✅
- **roadmap**（BloomShell の独自項目）
- monthly-digest ✅
- **daily-reports**（BLOOM_PATHS.DAILY_REPORTS = "/bloom/daily-reports" 複数形 = 実体不在で 404）

### 修正内容

**`src/app/bloom/_constants/routes.ts`** before / after:
| key | before | after |
|---|---|---|
| DAILY_REPORTS | `/bloom/daily-reports` 複数 | **`/bloom/daily-report` 単数**（実体合わせ） |
| CEO_STATUS | （無し） | **`/bloom/ceo-status` 新規追加** |
| PROGRESS | （無し） | **`/bloom/progress` 新規追加** |

ROADMAP は実体維持（URL 直打ち到達可、nav からは外す）。

**`src/app/bloom/_components/BloomShell.tsx` の `NAV_ITEMS`** before / after:
| | before（4 件） | after（5 件、BloomSidebar の NAV_PAGES と完全同期） |
|---|---|---|
| 1 | Workboard / `/bloom/workboard` | ワークボード / `/bloom/workboard` |
| 2 | ロードマップ / `/bloom/roadmap` | 日報 / `/bloom/daily-report` |
| 3 | 月次ダイジェスト / `/bloom/monthly-digest` | 月次まとめ / `/bloom/monthly-digest` |
| 4 | 日報 / `/bloom/daily-reports`（壊れ） | 経営状況 / `/bloom/ceo-status` |
| 5 | （無し） | **開発進捗 / `/bloom/progress`** |

## # 3 iframe 高さ調整 適用 / 見送り

**見送り（100vh のまま）**

理由: v29 HTML は内部に独自の縦 scroll を持つため、iframe 100vh で topbar 分（~120px）下に隠れた領域も iframe 内 scroll で到達可能。視覚的には Garden Bloom header/nav が画面上部に表示され、その下に v29 が full bleed で描画される構成。

a-main-012 の検証結果次第で次 dispatch（main- No. 51+）に `calc(100vh - 130px)` 等の調整を回す方針。

## 検証 HTTP code（本セッション curl）

### Bloom サブナビ 6 件
| URL | HTTP code |
|---|---|
| /bloom/progress | **200** ✅ |
| /bloom/daily-report | **200** ✅ |
| /bloom/ceo-status | **200** ✅ |
| /bloom/workboard | **200** ✅ |
| /bloom/monthly-digest | **200** ✅ |
| /bloom/roadmap | **200** ✅（nav 外しても URL 直打ち到達可、保護維持） |

### iframe 内画像 5 サンプル
| URL | HTTP code |
|---|---|
| .../images/avatar/avatar_shoji.png | **200** ✅ |
| .../images/header_icons/header_calendar.png | **200** ✅ |
| .../images/logo/garden_logo.png | **200** ✅ |
| .../images/theme_icons/theme_sun.png | **200** ✅ |
| .../images/icons_bloom/bloom_workboard.png | **200** ✅ |

## legacy 保持ファイル一覧（削除禁止）
- src/app/bloom/_components/BloomShell.legacy-progress-link-add-redo-20260505.tsx （新規）
- src/app/bloom/_constants/routes.legacy-progress-link-add-redo-20260505.ts （新規）

（main- No. 41/42/44/45/48 で作成済 legacy 12 件も継続保持）

## 完了時刻
2026-05-05(火) 18:42（着手 18:37 → 完了 18:42、所要 5 分）

## 検証依頼
a-main-012 で Chrome MCP DOM/視覚検証お願いします:
1. iframe 内 broken 画像数 → **0** 確認（48 枚追加で解消想定）
2. /bloom/progress page の allLinks に `/bloom/progress` 含む 5 件確認（roadmap 消失、daily-report 単数化、ceo-status 復活、progress 出現）
3. サイドバー実クリックで /bloom/progress 遷移成功（active 状態）
4. iframe 高さ視覚（100vh のまま、NG なら次 dispatch）

a-bloom-003 待機中（次 bloom-003- No. 32、main- No. 51 待ち）
~~~
