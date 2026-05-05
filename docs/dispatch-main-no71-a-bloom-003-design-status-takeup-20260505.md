# main- No. 71 dispatch - a-bloom-003 設計状況 取りまとめ依頼 - 2026-05-05

> 起草: a-main-012
> 用途: Garden 開発進捗ページ /bloom/progress モジュールタブ「設計状況」実データ化、a-bloom-003 から Bloom モジュール現状取りまとめ
> 番号: main- No. 71
> 起草時刻: 2026-05-05(火) 22:38
> 緊急度: 🟢 5/9-5/12 取りまとめ、5/15 までに Root 集約

---

## 投下用短文（東海林さんが a-bloom-003 にコピペ）

~~~
🟢 main- No. 71
【a-main-012 から a-bloom-003 への dispatch（Bloom モジュール 設計状況 取りまとめ依頼）】
発信日時: 2026-05-05(火) 22:38

Garden 開発進捗ページ（/bloom/progress）モジュールタブ内の「設計状況」セクションを実データ化するため、a-bloom-003 セッションに Bloom モジュールの現状取りまとめをお願いします。

【背景】

5/8 デモで /bloom/progress 試作データ表示済（main- No. 60-61）。post-デモで 5/15 までに各モジュールの実データを Root テーブルに集約 + 表示する計画。

5 セッション（Bloom / Tree / Leaf / Root / Soil）から取りまとめ依頼、その他 7 module（Forest/Bud/Sprout/Calendar/Rill/Seed/Fruit）はプレースホルダーのみ。

【依頼内容】

`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-design-status\bloom.md` として下記テンプレで起草してください:

```markdown
# Garden Bloom 設計状況（2026-05-09 時点）

## 開発フェーズ
- 全体進捗: NN%
- 関連 Phase: A / B / C / D
- 状態: 未着手 / 設計中 / 実装中 / α運用 / β運用 / 本番運用

## 完成済機能（主要、3-5 件）
- 機能 A
- 機能 B
- 機能 C

## 進行中（直近、1-3 件）
- 作業 X（着手日: YYYY-MM-DD / 完了見込み: YYYY-MM-DD）
- 作業 Y

## 残課題（主要、3-5 件）
- 課題 1
- 課題 2

## 主要 spec / 設計書（path）
- docs/superpowers/specs/xxx.md
- docs/superpowers/specs/yyy.md

## 担当セッション
a-bloom-003

## 更新ルール
- 月次更新（前月分実績 + 当月予定）推奨
- 進捗 % 大幅変動時 + Phase 切替時 即更新
```

【期限】

5/9-5/12 のいずれかで起草完了（30〜45 分作業）。5/13 以降に a-root-002 が読み取り → Root テーブルに upsert → /bloom/progress で表示。

【完了報告フォーマット】

bloom-003- No. NN で:
- _chat_workspace/garden-design-status/bloom.md path 確認
- 5 セクション（phase / completed / in_progress / pending / spec_links）の記入完了確認
- 完了時刻

【参照可能なリソース】

- main- No. 38-61（dispatch 履歴、Bloom 6 画面実装の経緯）
- spec/forest-shiwakechou-design（Bud 移行関連）
- _chat_workspace/chat-spec-garden-bloom-design-system-20260505.md（世界観仕様書）

【dispatch counter】

a-main-012: 次 main- No. 72（a-tree 宛、同様の依頼）
a-bloom-003: bloom-003- No. NN で完了報告予定

工数見込み: 30〜45 分

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 22:38 初版（a-main-012、5 セッション設計状況取りまとめ第 1 弾）
