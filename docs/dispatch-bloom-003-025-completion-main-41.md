~~~
🟢 bloom-003- No. 25
発信元: a-bloom-003
発信日時: 2026-05-05(火) 15:14
件名: main- No. 41 完了報告（シリーズロゴ → spin / ログアウト → login ナビ統一）

## commit / push
- commit: `6c835a8` fix(bloom): シリーズロゴ → garden-home-spin / ログアウト → login [dispatch main- No.41]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（3879404..6c835a8）

## # A: src/app/bloom/_components/BloomTopbar.tsx (React 本番)
| 箇所 | before | after |
|---|---|---|
| brand `<a>` (line 93) | `href="/"` | `href="/_proto/garden-home-spin/"` |
| logout (line 282-297) | `<button onClick={...onLogout?.()}>` | `<a href="/_proto/login/" onClick={...onLogout?.()}>` |

logout 変更詳細: `<button>` → `<a>` に変更し `href="/_proto/login/"` 追加。class 名 `user-dropdown-item user-dropdown-item-logout` 維持。既存 onClick (`stopPropagation`, `setUserOpen(false)`, `onLogout?.()`) は全て温存。

## # B: public/_proto/bloom-top/index.html
| 箇所 | before | after |
|---|---|---|
| brand (line 52) | `href="../../000_GardenUI/index.html"` | `href="/_proto/garden-home-spin/"` |
| logout (line 155) | `href="#"` | `href="/_proto/login/"` |

## # C: public/_proto/ceostatus/index.html
| 箇所 | before | after |
|---|---|---|
| brand (line 52) | `href="../../000_GardenUI/index.html"` | `href="/_proto/garden-home-spin/"` |
| logout (line 155) | `href="#"` | `href="/_proto/login/"` |

## # D: public/_proto/garden-home/index.html
| 箇所 | before | after |
|---|---|---|
| brand (line 58) | `href="index.html"` | `href="/_proto/garden-home-spin/"` |
| logout (line 161) | `href="#"` | `href="/_proto/login/"` |

## legacy 保持ファイル一覧（削除禁止）
- src/app/bloom/_components/BloomTopbar.legacy-brand-logout-nav-20260505.tsx
- public/_proto/bloom-top/index.legacy-brand-logout-nav-20260505.html
- public/_proto/ceostatus/index.legacy-brand-logout-nav-20260505.html
- public/_proto/garden-home/index.legacy-brand-logout-nav-20260505.html

## 完了時刻
2026-05-05(火) 15:14（着手 15:08 → 完了 15:14、所要 6 分）

## 検証依頼
a-main-012 で Chrome MCP DOM 検証（全 4 画面 brand href = `/_proto/garden-home-spin/`、logout href = `/_proto/login/` 統一 + 実クリック遷移）お願いします。

a-bloom-003 待機中（次 bloom-003- No. 26）
~~~
