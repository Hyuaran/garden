# dispatch main- No. 335 — 東海林さん向け Task 6 人間検証フェーズ 5 タスク dispatch (5/12 朝起床後実施)

> 起草: a-main-024
> 用途: a-root-003 Task 6 完成 (PR #169 admin merged 21:22:20 JST) + Chrome MCP は subagent 環境で直接実行不可、手動 E2E は東海林さん復帰後想定。5/12 朝起床後に順次実施する 5 タスクを今夜中にまとめて起票
> 番号: main- No. 335
> 起草時刻: 2026-05-11(月) 21:22（実時刻基準、powershell.exe Get-Date 取得）

---

## 投下用短文（東海林さんが 5/12 朝起床後に自分で読む用、コピペ不要）

~~~
🟡 main- No. 335
【a-main-024 から 東海林さんへの dispatch（Task 6 人間検証フェーズ 5 タスク、5/12 朝実施）】
発信日時: 2026-05-11(月) 21:22

# 件名
🟡 Task 6 完成 → Garden unified auth plan 6/6 = 100% 達成、人間検証フェーズ 5 タスク（テストアカウント 9001-9008 作成 + Chrome MCP S1-S13 + 96 マトリクス + Method C + パフォーマンス計測）。5/12 朝起床後に順次実施推奨。

# A. 前提情報
| 項目 | 値 |
|---|---|
| PR #169 状態 | ✅ MERGED 2026-05-11T12:22:20Z (mergeCommit 98bea87) |
| plan 全 6 Task | ✅ 全 merged 確定 (#162/#163/#164/#167/#168/#169) |
| シナリオ集 | docs/qa/unified-auth-test-scenarios-20260511.md (575 行、subagent 環境で完備済) |
| 検証範囲 | S1-S13 + 96 マトリクス + Method C クロス検証 + パフォーマンス |
| 環境 | garden-dev（本番ではない、テストアカウント作成 OK）|

# B. タスク 1: garden-dev テストアカウント 9001-9008 事前作成（plan §6 §0.1）
| 項目 | 内容 |
|---|---|
| 作成先 | Supabase Studio (garden-dev project = hhazivjdfsybupwlepja) → Auth → Users |
| アカウント 8 種 | 9001 super_admin / 9002 admin / 9003 manager / 9004 staff / 9005 cs / 9006 closer / 9007 toss / 9008 outsource |
| パスワード | 任意（東海林さん管理）|
| garden_role 設定 | root_employees テーブルで対応 user_id 行に garden_role 設定 |
| 想定時間 | 30-45 分（8 アカウント × 約 5 分）|

# C. タスク 2: Chrome MCP で S1-S13 実行 + 結果記録
| 項目 | 内容 |
|---|---|
| シナリオ | docs/qa/unified-auth-test-scenarios-20260511.md §5.2 S1-S13 |
| 主な内容 | S1 Login → Home / S2 各ロール表示 / S3 ModuleGate access-denied / S4 dev bypass / S5 logout / S6 セッション維持 / S7 invalid auth / S8 RLS / S9-S11 super_admin lockdown / S12 module 間 navigation / S13 セッション期限切れ |
| Chrome MCP 経路 | a-main-024 セッションから javascript_tool / browser_batch 経由実行可能（東海林さん指示で私が実行）|
| 結果記録 | unified-auth-test-scenarios-20260511.md §5.2 に ✅/⚠️/❌ 記録 |
| 想定時間 | 1.5-2h（13 シナリオ × 約 10 分）|

# D. タスク 3: 96 マトリクス検証 + §5.1 記録
| 項目 | 内容 |
|---|---|
| マトリクス | 8 ロール × 12 module = 96 セル |
| 検証内容 | 各 (ロール, module) で access 可否 + minRole 整合性 |
| 結果記録 | unified-auth-test-scenarios-20260511.md §5.1 に ✅/⚠️/❌ 記録 |
| 想定時間 | 1-1.5h（96 セル × 約 1 分、ロール別バッチ実施推奨）|

# E. タスク 4: Method C クロス検証 S9-S11（Supabase Studio 認証セッション切替）
| 項目 | 内容 |
|---|---|
| 対象 | PR #162 super_admin lockdown |
| 検証内容 | S9 super_admin 昇格 UI block (GARDEN_ROLE_SELECTABLE_OPTIONS 除外) / S10 super_admin 降格 UI block (authenticated UPDATE で 42501) / S11 service_role バイパス成功 (Dashboard 直 SQL UPDATE) |
| 手順 | Supabase Studio で SQL Editor → authenticated user として UPDATE 試行 → 42501 確認 + service_role で再試行 → 成功確認 |
| 想定時間 | 30 分 |

# F. タスク 5: パフォーマンス計測 §3 目標値クリア確認
| 項目 | 内容 |
|---|---|
| 目標値 | Login → Home 200ms 以内 / ModuleGate redirect 100ms 以内 |
| 計測経路 | Chrome MCP performance.now() or browser DevTools Network tab |
| 結果記録 | unified-auth-test-scenarios-20260511.md §3 に計測値記録 |
| 想定時間 | 30 分 |

# G. タスク合計時間
| タスク | 想定時間 |
|---|---|
| 1. テストアカウント | 30-45 分 |
| 2. S1-S13 | 1.5-2h |
| 3. 96 マトリクス | 1-1.5h |
| 4. Method C | 30 分 |
| 5. パフォーマンス | 30 分 |
| **合計** | **4-5h**（5/12 朝-午前で完走想定）|

# H. 実施順推奨
1. タスク 1（テストアカウント作成）= 全タスクの前提
2. タスク 4（Method C、S9-S11 単独）= 短時間で完走
3. タスク 5（パフォーマンス、Chrome MCP performance API）= 短時間で完走
4. タスク 2（S1-S13、Chrome MCP S1 から順次）
5. タスク 3（96 マトリクス、最後に統合実施）

# I. a-main-024 / a-root-003 支援可能内容
| 項目 | 担当 |
|---|---|
| Chrome MCP 経由実行（タスク 2 / 5）| a-main-024 が javascript_tool / browser_batch で実行可能、東海林さん指示で発動 |
| 結果記録の md 更新 | a-main-024 が反映 |
| Supabase Studio 経由実行（タスク 1 / 4）| 東海林さん主体、a-main-024 は markdown link + SQL 提示で支援 |
| エラー解消・判断仰ぎ | a-root-003 が即対応可能、main 経由 |

# J. 完走後のアクション
| 順 | 内容 |
|---|---|
| 1 | unified-auth-test-scenarios-20260511.md §3 / §5.1 / §5.2 結果記録完了 |
| 2 | 不具合発見時は dispatch を root-003 に投下（Phase B-5 修正 or hotfix PR）|
| 3 | 全合格時は完成記念 memory に「人間検証フェーズ完走」記録追加 |
| 4 | 5/13 後道さんデモ前準備 = Critical path ③ 完全準備完了 |

# K. 緊急度
🟡 通常（5/12 朝起床後実施、5/12 中完走推奨、5/13 デモ前マイルストーン依存）

# L. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] 起草時刻 = 実時刻 21:22（powershell.exe Get-Date 取得済）
- [x] 番号 = main- No. 335 (counter 335 → 336)
- [x] A 前提 / B-F タスク 1-5 / G 合計時間 / H 実施順 / I 支援 / J 完走後
- [x] 東海林さん向け = 投下先「東海林さん」明示、5/12 朝実施想定
~~~

---

## 詳細（参考、投下対象外）

### 連動
- root-003 No. 64 §J（人間検証 5 タスク、東海林さん復帰後実施）
- PR #169 admin merge (98bea87、2026-05-11T12:22:20Z)
- docs/qa/unified-auth-test-scenarios-20260511.md (575 行、Task 6 で起草)
- main- No. 333 / 333-rep / 333-rep-2 連動

### 投下方法
本 # 335 は東海林さん向け = 投下先「東海林さんが自分で読む」。コピペ不要、5/12 朝起床後に本ファイルを直接開いて順次実施。
