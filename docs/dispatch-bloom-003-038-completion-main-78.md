~~~
🟢 bloom-003- No. 38
発信元: a-bloom-003
発信日時: 2026-05-07(木) 15:00
件名: main- No. 78 完了報告（PR マージ + Vercel 自動デプロイ + 途中 build error hotfix 適用）

## TL;DR
✅ feature → develop → main 経由で 5/5 新機能を本番反映完了
⚠️ 最初のマージで Vercel build 失敗（display_name 型エラー）→ hotfix で解消
✅ 最終 commit `30aa992` で Vercel build success、全 10 endpoint 200 OK
🟡 ただし **X-Data-Source: mock**（Vercel 側 Supabase env 未設定推定、要確認）

## マージ済 PR

| # | base ← head | merge commit | merge 時刻 |
|---|---|---|---|
| #123 | develop ← feature/bloom-6screens-vercel-2026-05 | `3d6870af` | 2026-05-07 14:49 |
| #124 | main ← develop | `d34794c8` | 2026-05-07 14:50 |
| #125 | develop ← feature（hotfix） | `630bb1ee` | 2026-05-07 14:58 |
| #126 | main ← develop（hotfix release） | `30aa9929` | 2026-05-07 14:58 |

main HEAD: **`30aa992`**

## 途中で発生した Vercel build error と hotfix

### エラー
PR #124 マージ後、Vercel build 失敗。`gh api status` 経由で原因を辿り、`tsc --noEmit` で再現:

```
src/app/bloom/daily-report/page.tsx(9,31):
error TS2339: Property 'display_name' does not exist on type 'BloomUser'.
```

### 原因
main- No. 43 で /bloom/daily-report 新規作成時、placeholder で `bloomUser?.display_name` を参照したが、`BloomUser` 型（`src/app/bloom/_lib/auth.ts`）の正しいフィールドは `name`。dev mode は `"use client"` で型チェック緩いため気付かず、Vercel 本番 build（next build → tsc）で初めて顕在化。

### 修正
`bloomUser?.display_name` → `bloomUser?.name`（PR #125 で feature → develop、PR #126 で develop → main）。

### Vercel build 履歴

| commit | Vercel state |
|---|---|
| f1ef078（5/5 06:51 UTC） | success（最後の成功）|
| 53dad32（5/5 08:00 UTC、daily-report 新規）| **failure（エラー入り）**|
| 16fafa5（main- No. 77 修正後）| failure |
| **30aa9929（hotfix 適用後、本対応）**| **success ✅** |

## Vercel デプロイ動作確認結果

### 本番 URL 全 10 endpoint HTTP 200 ✅

| URL | HTTP code | 応答時間 |
|---|---|---|
| /bloom | 200 | 753ms |
| /bloom/workboard | 200 | 824ms |
| /bloom/daily-report | 200 | 817ms |
| /bloom/monthly-digest | 200 | 568ms |
| /bloom/ceo-status | 200 | 714ms |
| /bloom/progress | 200 | 707ms |
| /leaf | 200 | 579ms |
| /_proto/garden-home | 200 | 240ms |
| /_proto/garden-home-spin | 200 | 427ms |
| /_proto/bloom-top | 200 | 244ms |

### /api/bloom/progress-html ヘッダ確認

```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
X-Data-Source: mock
X-Vercel-Id: kix1::iad1::mpcvs-1778133600720-1f4e128785a5
```

## 🟡 残課題: Vercel 側 Supabase env 未設定の可能性

ローカル環境（localhost:3000）では `X-Data-Source: supabase` で実データ表示済（main- No. 77 修正の動作確認済）。
本番（Vercel）は **`X-Data-Source: mock`** = `fetchData()` 内で fallback 経路に流れている。

### 推定原因
Vercel プロジェクトの環境変数に **`SUPABASE_SERVICE_ROLE_KEY`** が未設定。
`route.ts` の fetchData() は `url || serviceKey` 不在時、即 mock を返す設計。
`NEXT_PUBLIC_SUPABASE_URL` は付与されているはず（client 用、garden-prod でも使用）が、service_role は server-only env で別管理が必要。

### 対応依頼（a-main-013 または東海林さん）
Vercel ダッシュボード > Hyuaran/garden プロジェクト > Settings > Environment Variables で:
- `SUPABASE_SERVICE_ROLE_KEY` を Production/Preview/Development 全環境に追加
- 値は `.env.local` の同名 key を使用
- 追加後 redeploy（Deployments > Latest > Redeploy）で反映

私（a-bloom-003）からは Vercel CLI 認証も dashboard 操作もできないため、本部分のみ a-main-013 系列で対応願います。

## 5/8 デモ向けチェックリスト

- [x] localhost:3000/bloom/progress → 200 + supabase data ✅（ローカルは実データ）
- [x] garden-chi-ochre.vercel.app/bloom/progress → 200 ✅
- [ ] garden-chi-ochre.vercel.app/api/bloom/progress-html → X-Data-Source: supabase（要 Vercel env 追加）
- [x] localhost 全 6 Bloom 画面 + /leaf 200 OK
- [x] Vercel 全 10 endpoint 200 OK（_proto 3 画面含む）
- [x] Vercel デプロイログにエラーなし（hotfix 後 success）

## 補足
- main マージは PR フロー厳守（直接 push なし、CLAUDE.md 遵守）
- C 垢（shoji-hyuaran）の GitHub OAuth で gh pr / merge 動作確認 ✅
- Vercel 自動デプロイは GitHub C 垢移行後も正常動作（手動 redeploy 不要）

## 完了時刻
2026-05-07(木) 15:00（受領 14:30 → 完了 15:00、所要 30 分）

a-bloom-003 待機中（次 bloom-003- No. 39、main- No. 79+ 待ち）
~~~
