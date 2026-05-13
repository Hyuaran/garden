# 🔴 bloom-006- No. 18
【a-bloom-006 から a-main-023 への dispatch（PR #164 + #163 + #162 batch review 完走報告、🔴 critical path）】
発信日時: 2026-05-11(月)

# 件名

main- No. 298 依頼分 Garden unified auth plan v1.0 の Task 1 (#164) + Task 4 (#163) + Task 5 (#162) batch review 完走（合計 16 観点完走、全 PR 採用推奨）+ ⚠️ PR #164 + #162 CONFLICTING 警告 + 設計判断 1 件確認推奨

# # 1. Task 1 (#164 Login 統一画面) レビュー結果

| 観点 | 結果 |
|---|---|
| 1. auth-unified.tsx 整合性 | ✅ IN-1 + IN-5 準拠 |
| 2. /login/page.tsx 置換 | ✅ Suspense + signInUnified + sanitizeReturnTo |
| 3. BloomGate L42 GARDEN_LOGIN 変更 | ✅ dev バイパス維持 |
| 4. ForestGate legacy 改名 + shell 化 | ✅ IN-4 準拠 |
| 5. 4 login page legacy + stub | ✅ |
| 6. IN-4 準拠 (二重改名禁止) | ✅ |
| 7. IN-5 準拠 (既存 5 helper 維持) | ✅ |
| 8. TypeScript 型 | ✅ root-003- No. 48-B 信頼 |
| 9. Vercel build | ✅ SUCCESS |

総評: **採用推奨** ✅ + ⚠️ mergeStateStatus = **CONFLICTING** (rebase 必要)

主要観察:
- auth-unified.tsx 7 関数 + Hook + Provider 同一ファイル (IN-1)
- sessionStorage namespace 6 モジュール (cross-module SSO)
- sanitizeReturnTo で open redirect 対策
- 既存 signInBloom 等 5 helper 削除なし (IN-5)
- BloomGate dev バイパス維持、memory project_bloom_auth_independence 整合
- ForestGate shell 化、Task 3 ModuleGate 書換準備

# # 2. Task 4 (#163 RLS テンプレート) レビュー結果

| 観点 | 結果 |
|---|---|
| 1. RLS テンプレート (5 モジュール横断) | ✅ |
| 2. server/client 区分 | ✅ N/A (SQL only PR) |
| 3. 既存 RLS 破壊性 | ✅ コメントアウト形式 |
| 4. super_admin bypass (Task 5 整合) | ✅ |

総評: **採用推奨** ✅、MERGEABLE、merge 阻害なし。

主要観察:
- 8 段階 garden_role 階層明示、PR #154 helpers との連携明示
- Pattern A (全員閲覧 / admin 書込) + Pattern B (本人 only + manager 全件 + admin 書込) + その他
- 適用前チェックリスト 6 項目 (テーブル名 / dtype / WITH CHECK / dev policy DROP / index / pg_policies 確認)
- 全 SQL コメントアウト形式 = 既存 RLS への影響ゼロ
- 既存テーブルの実マイグレーションは別 PR (plan §Task 4 §Acceptance 4)

# # 3. Task 5 (#162 super_admin 固定) レビュー結果

| 観点 | 結果 |
|---|---|
| 1. super_admin = 東海林さん 1 名専任 | ✅ DB trigger 多層防御 |
| 2. 設定変更可能性 | ⚠️ memory `project_configurable_permission_policies` との trade-off 確認推奨 |
| 3. 既存 super_admin 操作影響 | ✅ |

総評: **採用推奨** ✅ + ⚠️ mergeStateStatus = **CONFLICTING** (rebase 必要) + 設計判断確認 1 件

主要観察:
- UPDATE trigger + INSERT trigger 二重防御、SQLSTATE 42501
- service_role セッションのみバイパス (Supabase Dashboard 経由)
- types.ts GARDEN_ROLE_SELECTABLE_OPTIONS で super_admin 除外 (UI 防止)
- UI + DB trigger の多層防御
- 既存 super_admin user (東海林さん) には影響なし

設計判断確認 (観点 2 ⚠️):
- 本 PR は DB trigger によるハードコード制御
- memory `project_configurable_permission_policies` "権限閾値はハードコード禁止、root_settings で admin 変更可能" との微妙な tension
- 設計上の妥当性: super_admin は特殊用途、変更可能性自体がリスク → ハードコード化が妥当
- ただし、運用ポリシー変更時 (副 super_admin 追加検討) は trigger 改変必要、認識を README / spec に追記推奨
- 東海林さん最終判断推奨

# # 4. 横断観点 (3 PR 整合性 + merge 順序推奨)

## 4-1. 整合性

| 関係 | 状態 |
|---|---|
| Task 1 ↔ Task 4 | 独立 (Login 統一 vs RLS template) |
| Task 1 ↔ Task 5 | 独立 (Login vs super_admin)、ただし AuthProvider で GardenRole 取得時 Task 5 整合性必要 |
| Task 4 ↔ Task 5 | super_admin が has_role_at_least 最上位、整合 ✅ |
| Task 1 → Task 2 / 3 前提 | Task 1 完成 = Task 2 (Series Home) / Task 3 (ModuleGate) 着手可 |
| Task 5 → Task 6 前提 | Task 5 完成 = Task 6 (権限境界明文化) 着手可 |

## 4-2. merge 順序推奨

| 順 | PR | 状態 | 理由 |
|---|---|---|---|
| 1 | **PR #163 (Task 4 RLS template)** | MERGEABLE ✅ | 先 merge OK (基盤、Task 5 が has_role_at_least 上位として参照) |
| 2 | **PR #162 (Task 5 super_admin)** | CONFLICTING ⚠️ | rebase 後 merge (基盤、Task 6 前提) |
| 3 | **PR #164 (Task 1 Login)** | CONFLICTING ⚠️ | rebase 後 merge (critical path ③ 起点、Task 2/3 前提) |

→ Task 4 から merge 進行可、Task 1 + Task 5 は a-root-003 で rebase 後に並行 merge 可。

# # 5. 判断保留事項（東海林さんへの確認事項）

| # | 事項 | 推奨判断 |
|---|---|---|
| 1 | PR #164 + #162 CONFLICTING の rebase 担当 | 🟢 a-root-003 (起草者) で実施推奨 |
| 2 | rebase 後の再 review 要否 | 🟡 軽微なら本 review で OK、大幅変更時は再 review (本 review は CONFLICTING 状態での評価) |
| 3 | Task 5 ハードコード化 vs root_settings 変更可能性の trade-off | 🟢 ハードコード化採用 + README/spec 認識追記推奨 (副 super_admin 追加時の改変必要性明示) |

# # 6. レビューコメント post 状態

| PR | URL | timestamp |
|---|---|---|
| #164 | https://github.com/Hyuaran/garden/pull/164 | shoji-hyuaran COMMENTED 2026-05-11T08:48:02Z |
| #163 | https://github.com/Hyuaran/garden/pull/163 | shoji-hyuaran COMMENTED 2026-05-11T08:48:14Z |
| #162 | https://github.com/Hyuaran/garden/pull/162 | shoji-hyuaran COMMENTED 2026-05-11T08:48:31Z |

# # 7. 累計 review (a-bloom-006)

**14 PR review 完走** ✅:
#147 / #148 / #149 / #151 / #152 / #153 / #154 / #155 / #156 / #157 / #158 / **#162** / **#163** / **#164**

main 反映済: 4 PR (#148 / #154 / #155 / #156)
本 No. 18 で +3 PR review、累計 14 PR

# Bloom 観点での補足（情報共有）

- Garden unified auth は Bloom 側で signInUnified 経由の SSO 実現、Bloom v9 unified homepage との連携強化
- BloomGate dev バイパス維持で開発体験継続
- Task 4 RLS template は将来 Bloom テーブル追加時の指針として有用
- Task 5 super_admin lockdown は Bloom CeoStatus / dashboard 管理経路の保護にも寄与

# 緊急度
🔴 高（Tree D-01 critical path 後の Garden 統一認証 critical path ③、5/13 完成見込み）

# self-check

- [x] 冒頭 3 行 ~~~ 内配置 (v5.1/v5.2 完全準拠)
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] # 1: Task 1 (#164) 9 観点完走
- [x] # 2: Task 4 (#163) 4 観点完走
- [x] # 3: Task 5 (#162) 3 観点完走
- [x] # 4: 横断観点 (整合性 + merge 順序推奨)
- [x] # 5: 判断保留事項 3 件
- [x] # 6: レビューコメント URL + timestamp 明記
- [x] # 7: 累計 14 PR review 認識共有
- [x] 番号 = bloom-006- No. 18
- [x] 緊急度 🔴 認識
