# dispatch main- No. 187 — a-soil-002 へ ブランチ戦略 B 案 GO + 判 2-4 回答

> 起草: a-main-017
> 用途: soil-57 ブランチ戦略 B 案採択 + 判 2-4 回答（Phase 1 PR 状態 / migrations apply / csv-parse）
> 番号: main- No. 187
> 起草時刻: 2026-05-09(土) 21:55

---

## 投下用短文（東海林さんが a-soil-002 にコピペ）

~~~
🟡 main- No. 187
【a-main-017 から a-soil-002 への dispatch（soil-57 ブランチ戦略 B 案 GO + 判 2-4 回答）】
発信日時: 2026-05-09(土) 21:55

# 件名
soil-57 受領、判 1 = B 案 GO（新ブランチ feature/soil-batch20-impl 派生）+ 判 2-4 回答 = ブロッカー解消、Phase 2 実装着手 OK

# 1. 受領内容

soil-57（5/9 20:35）でブランチ依存問題報告:
- 現ブランチ feature/soil-batch20-spec-002 = spec のみ
- Phase 1 実装ファイル群 = feature/soil-batch16-impl ブランチ（origin push 済、未 merge）
- Phase 2 spec 前提ファイルが現ブランチ未存在 = 実装着手不可

→ ブランチ戦略 4 件判断保留。

# 2. 判 1 = B 案 GO（新ブランチ派生）

a-soil-002 推奨 B 案を採択:

実装手順:
- 1: git checkout -b feature/soil-batch20-impl origin/feature/soil-batch16-impl
- 2: Phase 2/3 spec を cherry-pick（commit 629c94e + 8e3a9dc）
- 3: handoff / counter は spec ブランチに残す（cherry-pick 不要）
- 4: Phase 2 実装 7 タスクを TDD で着手

理由:
- 命名が明確（spec → impl への移行）
- Phase 1 実装基盤に追加実装の形で整合性高
- A 案（spec + impl 同居）は責務混在 = 避ける
- C 案（develop merge 待ち）は時間ロス = 避ける

# 3. 判 2 = Phase 1 PR 状態確認

a-main-017 確認結果:

gh pr list で feature/soil-batch16-impl の PR 確認:
- PR #127 = a-soil 期の PR、現状 OPEN（5/8 起票、5/9 push freeze で停止）
- a-bloom レビュー待ち or develop merge 未完了

→ a-soil-002 が現状確認後、PR #127 が OPEN なら継続、CLOSED なら新規起票判断。

# 4. 判 3 = migrations apply 状態

soil-57 推奨「apply 未実施でも TDD 進行可、α テスト直前に apply 推奨」採択:
- TDD は schema-less 進行可能（ローカルテストで mock）
- α テスト（5/13 統合テスト）直前に Supabase Dashboard で migration apply
- apply タイミング: 5/12 推奨（5/13 統合テスト前日）

# 5. 判 4 = csv-parse npm 追加

soil-57 推奨「package.json 確認 → なければ自前 readline 実装」採択:
- 自前 readline 実装で進行（CLAUDE.md「事前相談」要を回避）
- 新規 npm 追加は東海林さん事前承認必要、回避が筋

→ 内部判断で進行 OK。

# 6. 推奨フロー（B 案実装、判 2-4 解消後）

実装着手（TDD 7 タスク）:
1. 新ブランチ派生（feature/soil-batch20-impl）
2. spec 2 件 cherry-pick
3. csv-parse 自前実装（readline base）
4. Adapter（CsvRecord → KintoneApp55Record）実装
5. Phase 2 7 タスク TDD 進行
6. 各タスク commit + push
7. 5/12 migration apply（Supabase Dashboard）
8. 5/13 統合テスト準備

工数: 1.8d（spec 通り）

# 7. 期待する応答（soil-58）

判 1-4 解消確認 + 着手宣言の 1-2 行返信:
- 内容: main- No. 187 受領、B 案 GO + 判 2-4 採択、Phase 2 実装着手中。

# 8. 緊急度
🟡 中（5/13 統合テスト前 Phase 2 完走目標）
~~~

---

## 詳細（参考、投下対象外）

発信日時: 2026-05-09(土) 21:55
発信元: a-main-017
宛先: a-soil-002
緊急度: 🟡 中

## 関連 dispatch

- main- No. 183（5/9 21:30）= Phase 2 実装着手 GO
- soil-57（5/9 20:35）= ブランチ戦略判断保留
- main- No. 187（本 dispatch）= B 案 GO + 判 2-4 回答

## 改訂履歴

- 2026-05-09 21:55 初版（a-main-017、v5.1 ルール準拠）
