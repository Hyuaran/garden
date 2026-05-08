# dispatch main- No. 159 — a-forest-002 へ Forest 連携 spec 実装依頼（forest-corporations-mock-migration）

> 起草: a-main-015
> 用途: a-forest-002 への Forest 連携 spec 実装依頼（5/9 朝以降投下推奨）
> 番号: main- No. 159
> 起草時刻: 2026-05-09(土) 01:31

---

## 投下用短文（東海林さんが a-forest-002 にコピペ、5/9 朝以降推奨）

~~~
🟡 main- No. 159
【a-main-015 から a-forest-002 への dispatch（Forest 連携 spec 実装依頼、6 法人マッピング統合）】
発信日時: 2026-05-09(土) 01:31

# 件名
Forest 連携 spec 実装依頼 — 6 法人 mock を GARDEN_CORPORATIONS 経由参照に切替（5/13 統合テスト前推奨、a-bloom-005 起票 spec 採用）

# 背景
- bloom-005- No. 4（5/9 01:25）で 6 法人アイコン組込完了（A-D 4/4）
- D 案として a-bloom-005 が Forest 連携 spec を起票:
  `docs/specs/2026-05-09-forest-corporations-mock-migration.md`（約 200 行）
- 横断調整セッションの判断: a-forest-002 が実装担当（Forest ownership）

# 依頼内容

## 主タスク

a-bloom-005 が起票した spec に基づき、Forest 既存 fetcher の mock 6 法人参照を GARDEN_CORPORATIONS 経由に切替:

1. spec 精読: `docs/specs/2026-05-09-forest-corporations-mock-migration.md`
2. Forest 既存 mock の対象箇所特定（src/lib/forest-fetcher.ts 等）
3. GARDEN_CORPORATIONS 参照に切替（src/lib/garden-corporations.ts、a-bloom-005 で既定義）
4. legacy_id_map（LEGACY_FOREST_MOCK_ID_MAP）を活用して既存テスト互換性確保
5. 視覚的にも法人アイコン + カラーが Forest dashboard で表示されることを確認

## 副次タスク（spec 内）

- 本番 forest_corporations 6 法人 INSERT の migration 起票
  - migration ファイル: `supabase/migrations/2026-05-09-forest-corporations-seed.sql`
  - 6 法人マスタデータ（id / name / icon_path / color / role）

## 工数

- 主タスク: 0.3-0.5d（spec で見積）
- 副次タスク（migration）: 0.2d
- 合計: 0.5-0.7d

# 期日

5/12（月）まで着手推奨（5/13 統合テスト前）。
5/14-16 後道さんデモで Forest dashboard が「6 法人色 + アネモネアイコン」で動的に切り替わる姿を見せる。

# 並行作業

a-forest-002 は現在 B-min #2 4 月仕訳化 classifier 実装中。本タスクは:
- B-min #2 進行と並行可（別ブランチ or 別 commit）
- B-min #2 完走後に着手でも OK

実装ブランチ案: `feature/forest-corporations-mock-migration-20260509`（feature/forest-shiwakechou-phase1-min-202605 と独立）

# Vercel push 停止 整合（5/9 朝以降は解除予定）

- 5/9 09:00 JST 過ぎ a-main-015 が解除 broadcast 発信予定
- 解除後、本タスクの commit は通常 push 可
- push 時の Vercel preview deploy で Forest dashboard の 6 法人表示を視覚確認可能

# 完走報告フォーマット

```
🟢 forest-002-NN
【a-forest-002 から a-main-015 への完走報告】
発信日時: HH:MM
件名: Forest 6 法人 mock GARDEN_CORPORATIONS 切替完了

完了内容:
- 主タスク: src/lib/forest-fetcher.ts 切替（commit hash）
- 副次: migration 2026-05-09-forest-corporations-seed.sql（migration name）
- テスト: vitest XX tests green
- PR: #XXX（mergeable / open）

判断保留 (任意):
- 〇〇について
```

# 緊急度
🟡 中（5/12 着手推奨、5/13 統合テスト前必須）

# 関連 dispatch / spec
- main- No. 157（5/9 01:17）= a-bloom-005 へ 6 法人組込指示（4/4 完走）
- main- No. 158（5/9 01:31）= a-bloom-005 へ追加組込（hyuaran-group-hd.png）
- spec: docs/specs/2026-05-09-forest-corporations-mock-migration.md（a-bloom-005 起票、約 200 行）
- spec: docs/specs/2026-05-08-bloom-corporate-icons-chatgpt-prompt.md（KK 案 spec、確定マッピング掲載）
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 01:31
発信元: a-main-015
宛先: a-forest-002
緊急度: 🟡 中（5/12 着手推奨、5/9 朝以降投下、push 解除と並行）
