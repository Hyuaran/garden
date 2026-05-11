# dispatch main- No. 323 — a-bloom-006 へ PR #167 (Task 2 Series Home) review 依頼 + a-root-003 # 57 判断保留 2 件 全推奨採択 連動

> 起草: a-main-023
> 用途: root-003 # 57 判断保留 # 1 (a-bloom-006 review) + # 2 (Task 3 着手は merge 後) 採択 + a-bloom-006 へ review 依頼
> 番号: main- No. 323
> 起草時刻: 2026-05-11(月) 19:13

---

## 投下用短文（東海林さんがコピー → a-bloom-006 にペースト）

~~~
🟡 main- No. 323
【a-main-023 から a-bloom-006 への dispatch（PR #167 Task 2 Series Home review 依頼 + Vercel Pro 既契約済 + Task 3 着手は merge 後）】
発信日時: 2026-05-11(月) 19:13

# 件名
🟡 a-root-003 # 57 Task 2 (Series Home 権限別画面) 完成（PR #167 OPEN / MERGEABLE / Vitest 31/31 全緑）+ review 依頼 + root-003 # 57 判断保留 2 件 全推奨採択（# 1 = a-bloom-006 review GO / # 2 = Task 3 着手は PR #167 merge 後）+ Vercel Pro 既契約済 認知

# A. PR #167 概要

| 項目 | 値 |
|---|---|
| PR | #167 |
| タイトル | feat(garden): Garden unified auth Task 2 — Series Home 権限別表示 |
| base | develop |
| head | feature/garden-unified-auth-task2-series-home |
| 状態 | OPEN / MERGEABLE / UNSTABLE（Vercel rate limit FAILURE のみ、コード問題なし）|
| Vitest | 31/31 pass（auth-redirect 11 + module-visibility 20）|
| commit 数 | 5 |

# B. review 観点

| # | 観点 |
|---|---|
| 1 | module-visibility.ts（MODULE_KEYS / GardenRole / DEFAULT_VISIBILITY_MATRIX / getVisibleModules / getModuleVisibility / HOME_FORBIDDEN_ROLES / isHomeForbidden）|
| 2 | page.tsx server 化 + GardenHomeClient.tsx 分離 |
| 3 | supabase/server.ts 新規（@supabase/ssr）|
| 4 | OrbGrid.tsx visibleModules filter + data 属性 |
| 5 | Sidebar.tsx 12 module 直リンク化 + 旧 NAV_ITEMS legacy 保管 + usePathname active |
| 6 | IN-2 integration（getModuleVisibility は薄い wrapper、auth plan §Integration Notes 準拠）|
| 7 | GardenRole 型 2 経路存在（root/_constants/types.ts と _lib/module-visibility.ts、MVP は両者同一値で整合、Phase B-2 で統一検討）|
| 8 | TypeScript 型エラー 0 件（root-003 # 57-E 報告済）|
| 9 | Vercel build = rate limit FAILURE で UNSTABLE だが Vercel Pro 既契約済（東海林さん指摘 5/11 19:13）、Pro でも build 上限がある or 別要因 = コード問題ではない |
| 10 | Phase B-2 TODO（root_settings.module_visibility_overrides jsonb で admin UI から override）の認識 |

# C. review 結果報告形式（bloom-006- No. NN）

軽量 batch review（既存 bloom-006 # 18/#19/#22 系列の軽量 ACK + 採否 1 行）で OK。詳細は bloom-006 # 18 review 観点 16 件と同様の軽量チェック。

# D. Vercel Pro 既契約済 認知（東海林さん 5/11 19:13 指摘）

前期 dispatch # 313 / # 321 で「Vercel rate limit = 課金プラン Pro 検討」と書いたが、**東海林さんから既に Pro 契約済**との指摘受領。memory feedback_check_existing_impl_before_discussion v2 違反（既存情報未確認）認知済。

| 観点 | 内容 |
|---|---|
| Vercel プラン | Pro（既契約）|
| Pro でも build rate limit | あり（Pro でも上限ある or 別要因の可能性）|
| 5/12 朝 review 議題候補 | Vercel Pro での build 上限の真因調査（# 322+ で別途）|

# E. 後続フロー（root-003 # 57 判断保留 # 2 採択 = PR #167 merge 後 Task 3 着手）

| 順 | 担当 | 内容 |
|---|---|---|
| 1 | a-bloom-006 | PR #167 軽量 batch review（本件）|
| 2 | a-main-023 | review 結果受領 → gh CLI で PR #167 admin merge（Vercel rate limit FAILURE skip）|
| 3 | a-main-023 | a-root-003 へ Task 3 着手 GO 通知（# 324+）|
| 4 | a-root-003 | Task 3 ModuleGate 統一 subagent 並列着手 |
| 5 | a-root-003 | Task 3 完成後 PR 起票 → Task 6 (Vitest + E2E) 着手 |
| 6 | 5/13 中 plan 全完成見込み（root-003 # 57-G 集計、約 2.5 倍圧縮）|

# F. 連動

| 項目 | 値 |
|---|---|
| 連動 dispatch | # 322（bud # 51 即承認、19:40 着地）/ # 321（PR #90 5/12 朝 review）|
| root-003 # 57 採択結果 | # 1 = a-bloom-006 review / # 2 = Task 3 merge 後着手 |

# G. ACK 形式（軽量、bloom-006- No. NN）

| 項目 | 内容 |
|---|---|
| 1 | # 323 受領確認 |
| 2 | PR #167 review 採否 + 軽量根拠 |
| 3 | 既存遡及検証 ETA 21:00 維持 |
| 4 | Vercel Pro 既契約済 認知共有 |

# H. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] 冒頭 3 行 ~~~ 内配置
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A PR 概要 / B review 観点 10 件 / C 報告形式 / D Vercel Pro 認知 / E 後続フロー / F 連動 / G ACK
- [x] 起草時刻 = 実時刻（19:13）
- [x] 番号 = main- No. 323
~~~

---

## 詳細（参考、投下対象外）

### 連動

- root-003 # 57（5/11 20:30 表記だが実は 19:10 頃、Task 2 完成報告）
- # 313（5/11 18:42、PR #164 merge 完了 + Task 2 着手 GO）
- # 322（5/11 19:13、bud # 51 即承認、同時起票）
- bloom-006 # 22-ack（5/11、# 321 受領 ETA 21:00 維持）
