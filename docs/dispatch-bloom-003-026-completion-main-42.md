~~~
🟢 bloom-003- No. 26
発信元: a-bloom-003
発信日時: 2026-05-05(火) 15:51
件名: main- No. 42 完了報告（href trailing slash → /index.html で 404 回避）

## commit / push
- commit: `f1ef078` fix(bloom): href trailing slash → /index.html で 404 回避 [dispatch main- No.42]
- push: origin/feature/bloom-6screens-vercel-2026-05 ✅（6c835a8..f1ef078）

## 全 8 箇所 before / after

### # A: src/app/bloom/_components/BloomTopbar.tsx
| 箇所 | before | after |
|---|---|---|
| brand (line 93) | `/_proto/garden-home-spin/` | `/_proto/garden-home-spin/index.html` |
| logout (line 283) | `/_proto/login/` | `/_proto/login/index.html` |

### # B: public/_proto/bloom-top/index.html
| 箇所 | before | after |
|---|---|---|
| brand (line 52) | `/_proto/garden-home-spin/` | `/_proto/garden-home-spin/index.html` |
| logout (line 155) | `/_proto/login/` | `/_proto/login/index.html` |

### # C: public/_proto/ceostatus/index.html
| 箇所 | before | after |
|---|---|---|
| brand (line 52) | `/_proto/garden-home-spin/` | `/_proto/garden-home-spin/index.html` |
| logout (line 155) | `/_proto/login/` | `/_proto/login/index.html` |

### # D: public/_proto/garden-home/index.html
| 箇所 | before | after |
|---|---|---|
| brand (line 58) | `/_proto/garden-home-spin/` | `/_proto/garden-home-spin/index.html` |
| logout (line 161) | `/_proto/login/` | `/_proto/login/index.html` |

## 新規 legacy 保持ファイル一覧（削除禁止）
- src/app/bloom/_components/BloomTopbar.legacy-href-trailing-slash-fix-20260505.tsx
- public/_proto/bloom-top/index.legacy-href-trailing-slash-fix-20260505.html
- public/_proto/ceostatus/index.legacy-href-trailing-slash-fix-20260505.html
- public/_proto/garden-home/index.legacy-href-trailing-slash-fix-20260505.html

（main- No. 41 で作成済 legacy 4 件も継続保持中）

## 完了時刻
2026-05-05(火) 15:51（着手 15:20 → 完了 15:51、所要 31 分）

## 検証依頼
a-main-012 で Chrome MCP DOM 検証お願いします:
1. 全 4 画面の brand href = `/_proto/garden-home-spin/index.html` 統一
2. 全 4 画面の logout href = `/_proto/login/index.html` 統一
3. /bloom で brand 実クリック → spin 画面到達
4. /bloom で logout 実クリック → login 画面到達

a-bloom-003 待機中（次 bloom-003- No. 27）
~~~
