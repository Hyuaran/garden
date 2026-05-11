# main- No. 63 dispatch - a-forest B-min 着手 GO + ブロッカー解消 + Bud 移行方針確定 - 2026-05-05

> 起草: a-main-012
> 用途: forest-2（B-min + Q4 提案）に対する東海林さん承認 + a-forest への着手 GO
> 番号: main- No. 63
> 起草時刻: 2026-05-05(火) 21:08
> 緊急度: 🔴 ヒュアラン決算 5/9 までに B-min 完走

---

## 投下用短文（東海林さんが a-forest にコピペ）

~~~
🔴 main- No. 63
【a-main-012 から a-forest への dispatch（B-min + Q4 同梱 着手 GO + ブロッカー解消連絡 + Bud 移行方針確定）】
発信日時: 2026-05-05(火) 21:08

forest-2（B-min + Q4 提案）受領 + 東海林さん承認完了。着手 GO + 周辺事項確定をご連絡します。

【承認事項】

# 1: B-min スコープ採択 ✅

a-forest 提案の B-min（みずほ Excel + 楽天 CSV、共通マスタ参照のみ、マスタ画面 / Storage / 法人間検出は Phase 2）で確定。

# 2: Q4 後道さん向け前日残高画面 同梱 ✅

balance-overview（全法人 × 口座マトリクス）を B-min と並行実装、+0.6d で 5/9 同時公開。'executive' ロール案 β（forest_users.role = 'executive' 新規追加、読み取り専用）採用。

# 3: 着手 GO ✅

5/6 朝〜5/9 夕の 4 日間（実働 3.2d）で B-min + Q4 完走、5/9 朝に東海林さん本番リハ + 弥生取込確認。

【ブロッカー解消（東海林さん追加作業 不要）】

forest-2 §Q5 で挙げられたブロッカー、a-forest が Drive 直接アクセスで取得可能と判明:

| ブロッカー | 解消方法 |
|---|---|
| 共通マスタ Excel | `G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\001_仕訳帳\1_共通マスタ_v12.xlsx` を a-forest が直接 read |
| 法人間取引マスタ | 同上、`2_法人間取引マスタ_v5.xlsx` |
| 口座マスタ | 同上、`3_口座設定.py` 内定義から抽出 |
| 法人マスタ | 同上、フォルダ構造（`01_株式会社ヒュアラン` 等）からスキャン |
| Python 弥生 CSV fixture | 同上、`01_*\1_銀行\3_完成データを確認\` 配下から 4-5 月分 1-2 法人分を流用 |

→ 東海林さん追加作業は **#3 各法人 2026-04-30 残高（後道さん画面初期値）** のみ。5/6 中に東海林さんが各銀行 Web で確認し、a-forest にチャット 1 通で渡す予定。

【追加判断: Bud 移行方針確定】

東海林さん指示:
「Garden Forest セッション内で決算作業ができればとりあえず OK。作業しながら Garden Bud 引き継ぎ資料等作成していき、決算作業後に Garden Bud に同じものを作る」

→ spec の Phase 4（Bud 移行）を **5/17 以降に早期実施**:

| 時期 | 内容 |
|---|---|
| 5/6-5/9 | a-forest が B-min + Q4 実装（forest 配下、bud_* テーブル）|
| 5/12-5/16 | 税理士作業（Python 並走、Garden は実運用テスト）|
| **5/17 以降** | **Bud 配下に同じものを作る**（Forest からコピー、bud_users / bud_audit_log 切替）|
| 5/17 以降並行 | a-forest が決算作業中に Bud 引き継ぎ資料作成 |

【UI 優先順位の方針確定】

東海林さん問題提起「UI は Tree 優先ではなく Bud 優先の方がいいのか？」への回答:

✅ Bud 優先で確定。

| Module | 状況 | UI 着手時期 |
|---|---|---|
| Bud（仕訳帳→経理画面）| 新規構築、決算作業ニーズ実機化 | **最優先**（5/6-5/9 + 5/17 以降）|
| Tree UI 統一 | 既存 FileMaker 代替実運用中、慎重展開 | post-5/17 以降に再評価 |

→ a-tree への main- No. 47（Tree UI 統一資料化）は「5/8 後 OK、急がず」のまま継続。実装着手は 5/17 以降に再評価。

【次のフロー】

a-forest 着手:
1. 5/6 朝、本 dispatch 確認 + 4/30 残高受領後、即着手
2. 5/6 昼-夜: migration + import script + 楽天パーサー（1.0d）
3. 5/7 終日: みずほ Excel パーサー + 確認画面 + 弥生エクスポート（1.0d）
4. 5/8 昼: balance-overview + 初期残高 UI（0.6d）
5. 5/8 夜: 統合テスト + Python fixture 突合（0.4d）
6. 5/9 朝: 東海林さん本番リハ + 完走報告（forest-NN）

【中間判断保留時の対応】

設計判断 / 仕様解釈で迷ったら、forest-NN dispatch で a-main-012 に確認。a-main-012 が即判断 or 東海林さんに確認 → 即返信、を約束。

【関連 dispatch / docs】

- spec: `docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md`（develop 未 merge、a-forest が PR 起票推奨）
- forest-2 詳細回答: `docs/dispatch-forest-2-shiwakechou-status-and-mvp-scope-20260505.md`
- a-forest 提案ブランチ: `feature/forest-shiwakechou-phase1-min-202605`（develop 派生、新規）

【dispatch counter】

a-main-012: 次 main- No. 64
a-forest: forest-3 で進捗中間報告 + forest-NN で完走報告予定

工数見込み: 3.2d（B-min 2.6d + Q4 0.6d）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 21:08 初版（a-main-012、forest-2 提案承認 + Bud 移行方針 + UI 優先順位確定）
