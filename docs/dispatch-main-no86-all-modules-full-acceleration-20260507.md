# dispatch main- No. 86 — 横断（全モジュールセッション）：認証統一以外も全前倒し / ガンガン進めていく / 判断保留即上げ

> 起草: a-main-013
> 用途: 全モジュールセッション宛 横断指示「認証統一以外の前倒し可能タスクも全着手 / 判断保留即上げ / 東海林さん負担無視で全速」
> 番号: main- No. 86
> 起草時刻: 2026-05-07(木) 18:26
> 緊急度: 🔴 重要（5/13 完成 + 全 Phase 前倒し）

---

## 投下用短文（東海林さんが各モジュールセッションにコピペ、宛先別 1 通）

### 共通文（全宛先で同文、宛先名のみ書き換え）

~~~
🔴 main- No. 86
【a-main-013 から a-XXXX への 横断指示（認証統一以外も全前倒し / ガンガン進める）】
発信日時: 2026-05-07(木) 18:26

5/8 デモ延期で生まれた時間（5/8-5/13 の 6 日間）を **全モジュール総前倒し**で活用します。

東海林さん明言:
「元々立てている予定も、前倒しできるものは全てする」
「私（東海林さん）に不可がかかるとかは全部無視してガンガン進める」

詳細は以下ファイル参照:
[docs/dispatch-main-no86-all-modules-full-acceleration-20260507.md](docs/dispatch-main-no86-all-modules-full-acceleration-20260507.md)

## 各モジュールがやってほしいこと

1. **認証統一作業（main- No. 83 / No. 84）を最優先で完走**
2. **その上で、自モジュールの handoff / wip / spec 残タスクで前倒し可能なものを全着手**
3. **判断保留が出たら即停止 → bloom-004- No. NN / root-002- No. NN / forest- No. NN 等で a-main-013 経由 東海林さんに上げる**
4. **東海林さん即回答 + 即進める**（負担気にせず判断仰ぐ）
5. **新規 npm install / 設計判断 / 仕様変更 / 本番影響操作は引き続き要承認**（ルール継続）

## 各モジュール 想定前倒しタスク（参考、自セッション判断で順次着手）

- **a-bloom-004**: 認証統一実装（5/8-10）+ Bloom Phase A-2 統合 KPI / Daily Report 本実装 / 残課題 5 件
- **a-root-002**: 認証 backend（5/9-12）+ Phase B 実装着手 / dev-inbox / B-08 / Phase B 6 ブランチ push
- **a-forest-002**: B-min 完走（5/9 朝）→ 認証統一（5/12）+ Forest v9 残機能 / 納税カレンダー / 決算書 ZIP / 派遣資産要件
- **a-tree**: 認証統一（5/13）+ D-03〜D-06 実装 / Track B Phase 1 / Tree UI 試作起草受領後の実装
- **a-bud**: 認証統一（5/13）+ Phase B 給与処理着手 / Phase D 残タスク / Bud UI v2 整理移送（5/9-）
- **a-leaf-002**: PR review 待ち + Phase A UI 着手準備 + spec v3.2 改訂 / TimeTree 移行 spec / OCR spec
- **a-soil**: PR #101 軽微 3 件 + Batch 16 基盤実装着手 / Phase B 実装着手 / コール履歴 335 万件 import 設計

## 進捗報告のお願い

- 区切りの良い節目で短文報告（counter ++ で）
- 完走報告は明確に「✅ XX 完成」と記載
- 判断保留は ⚠️ で即上げ

## 競合回避

- 各モジュールは自分の worktree / ブランチで作業
- 統合テスト時のみ a-main-013 経由で他モジュールと連携
- npm install 必要時は東海林さんに別 PowerShell 実行依頼

## 5/8-5/13 想定スケジュール

- 5/8 朝: 全モジュール起動 + 各自前倒しタスク着手
- 5/9 朝: a-forest-002 forest-9 完走 + a-root-002 spec 起草着手
- 5/10: a-bloom-004 認証統一 UI 完成
- 5/11-12: 各モジュール統合テスト
- 5/13: 全完成 + 後道さんデモ準備（5/14-16 想定）

ガンガン進めましょう。判断保留あれば即上げてください。
~~~

---

## 1. 背景

### 1-1. 5/8 デモ延期で生まれた 6 日間

5/8 後道さんデモ延期 → 5/14-16 想定で再設定。

5/8-5/13 の 6 日間で:
- Garden Series 統一認証ゲート 完成（main- No. 83 範囲）
- **+ 全モジュールの前倒し可能タスク 完走**

### 1-2. 東海林さん明言（18:25）

> 元々立てている予定も、前倒しできるものは全てする
> 私に不可がかかるとかは全部無視してガンガン進める

memory `feedback_maximize_auto_minimize_user.md`「auto フル使用 / 並列化 / 東海林さん作業最小化 / 議論せず即実行」と整合。

### 1-3. memory 関連

- `feedback_maximize_auto_minimize_user.md`: 議論せず即実行、判断 → 即実行の連鎖
- `feedback_quality_over_speed_priority.md`: 品質最優先（前倒しでも品質落とさない）
- `project_post_5_5_tasks.md`: post-5/5 タスク管理（5/5 後道さんデモ後 着手予定 → 前倒し化）
- CLAUDE.md §18 Garden 構築優先順位（Phase A → D）

---

## 2. 各モジュール 前倒し対象タスク（詳細）

### 2-1. a-bloom-004（最重要、認証統一 + Phase A-2）

| 期間 | タスク | 工数 |
|---|---|---|
| **5/7 夜** | claude.ai 起草版 login.html / garden-home.html → Next.js 化 本実装着手 | 0.3-0.5d |
| 5/8 朝 | 上記完走 + BloomGate redirect 変更 | 0.5d |
| 5/9-10 | a-root-002 と統合テスト | 0.5d |
| **+ 余力** | **Bloom Phase A-2 統合 KPI ダッシュボード**（残課題 5 件 #1）| 1.0d |
| **+ 余力** | **Daily Report 本実装**（残課題 5 件 #2、現在「準備中」表示）| 1.0d |
| **+ 余力** | **Bloom 認証 Forest 統合再設計**（残課題 5 件 #3、認証統一でカバー済の可能性）| 0.5d |

### 2-2. a-root-002（認証 backend + Phase B 残）

| 期間 | タスク | 工数 |
|---|---|---|
| 5/8 朝 | /login spec 起草（writing-plans skill）| 0.5d |
| 5/9 朝 | 認証統一 backend 実装着手（subagent-driven-development）| 1.0d |
| 5/10-11 | 統合テスト | 0.5d |
| 5/12 | signIn 共通化 + 既存 /[module]/login 即削除 | 0.5d |
| **+ 余力** | **Phase B 実装着手**（残課題 5 件、Kintone 確定 6 件 + 新規 spec 2 件）| 2.0d |
| **+ 余力** | **dev-inbox 実装**（B-08 関連）| 0.5d |
| **+ 余力** | **未 push 6 ブランチ push**（GitHub 復旧後）| 0.1d |

### 2-3. a-forest-002（B-min 完走 + 認証統一 + Forest 拡張）

| 期間 | タスク | 工数 |
|---|---|---|
| 5/8 朝 | B-min 残タスク（upload API + 4 月仕訳化 + 弥生 export/import + 確認画面）| 1.5d |
| 5/9 朝 | forest-9 B-min 完走報告 | — |
| 5/12 | Forest auth 統一作業（ForestGate redirect + /forest/login 廃止）| 0.3d |
| **+ 余力** | **Forest v9 残機能移植**（Phase 1-4 残）| 1.5d |
| **+ 余力** | **納税カレンダー**（v9 機能）| 0.5d |
| **+ 余力** | **決算書 ZIP**（v9 機能）| 0.5d |
| **+ 余力** | **派遣資産要件**（v9 機能）| 0.3d |

### 2-4. a-tree（認証統一 + Phase D + Track B）

| 期間 | タスク | 工数 |
|---|---|---|
| 5/13 | TreeAuthGate redirect + /tree/login 廃止 | 0.3d |
| **+ 余力** | **D-03〜D-06 実装**（Tree spec、α 版完走後の判断）| 1.5d |
| **+ 余力** | **Track B Phase 1**（既知の課題 4 件）| 0.5d |
| **+ 余力** | claude.ai Tree UI 試作起草 受領後の実装（main- No. NN 受領後）| 0.5d |

### 2-5. a-bud（認証統一 + Phase B + Bud UI v2 整理）

| 期間 | タスク | 工数 |
|---|---|---|
| 5/13 | Bud Gate redirect + /bud/login 廃止 | 0.3d |
| **+ 余力** | **Phase B 給与処理着手**（claude.ai Bud UI v2 ベース）| 2.0d |
| **+ 余力** | **Phase D 残タスク** | 0.5d |
| **+ 余力** | **Bud UI v2 整理移送**（_chat_workspace → 015_Gardenシリーズ）| 0.5d |

### 2-6. a-leaf-002（B 案待機 + spec 改訂 + OCR）

| 期間 | タスク | 工数 |
|---|---|---|
| 継続 | PR #65-#73 review 待ち（変更なし）| — |
| **+ 余力** | **spec v3.2 改訂**（残課題、B-min 後の見直し）| 0.5d |
| **+ 余力** | **TimeTree 移行 spec**（残課題）| 0.5d |
| **+ 余力** | **OCR spec**（残課題）| 0.5d |
| **+ 余力** | Phase A UI 設計（PR merge 後）| 1.0d |

### 2-7. a-soil（実装着手 + Batch 16）

| 期間 | タスク | 工数 |
|---|---|---|
| 継続 | PR #101 軽微 3 件 | 0.2d |
| **+ 余力** | **Batch 16 基盤実装着手**（5.25d、partitioning + 01-08）| 5.25d |
| **+ 余力** | **Phase B 実装着手**（8.5d、B-01〜B-07）| 8.5d |
| **+ 余力** | コール履歴 335 万件 import 設計 | 0.5d |
| 注意 | Phase B / Batch 16 は東海林さん指示待ちと記載されていたが、本 dispatch で「ガンガン進めて」承認 = 着手 OK |

---

## 3. 判断保留 即上げ ルール

### 3-1. 判断保留が出るパターン

- 設計判断（仕様変更含む）
- 新規 npm パッケージ追加（CLAUDE.md ルール）
- Supabase 本番データへの書込（CLAUDE.md ルール）
- kintone レコード追加 / 編集 / 削除（CLAUDE.md ルール）
- 外部 API 課金呼出（CLAUDE.md ルール）
- 後道さん向け UX 文言決定

### 3-2. 上げ方

各モジュールセッション → 自セッションカウンター（+1）で a-main-013 へ報告:
- 緊急度アイコン（🔴 / 🟡 / 🟢）+ 判断保留事項
- a-main-013 が東海林さんに即上げ
- 東海林さん即回答 → 私が回答 dispatch 起草 → 各モジュールへ配信

### 3-3. 即実行可能なもの（判断保留不要）

- 既存仕様の通り実装
- リファクタリング（動作変更なし）
- テストコード整備
- ドキュメント整備
- spec 起草（自モジュールの担当範囲）

---

## 4. 競合回避ルール

- 各モジュールは自分の worktree / ブランチで作業（CLAUDE.md「複数セッション運用」）
- 統合テスト時のみ a-main-013 経由で連携
- npm install 必要時は東海林さん別 PowerShell 実行（memory `project_npm_install_deny_workaround.md`）
- ブランチ命名: `feature/<module>-<topic>-<date>`
- commit 単位: 機能単位、conventional commit

---

## 5. 5/8-5/13 6 日間 全体スケジュール

| 日 | 主要マイルストーン |
|---|---|
| 5/7 夜 | a-bloom-004 本実装着手（認証統一 UI）|
| 5/8 朝 | 全モジュール起動 + 各自前倒し着手 / a-root-002 spec 起草 |
| 5/9 朝 | a-forest-002 forest-9 完走 / a-root-002 認証 backend 実装着手 |
| 5/10 | a-bloom-004 認証統一 UI 完成 / a-root-002 backend 進捗 |
| 5/11 | 各モジュール認証統一 redirect 適用開始 |
| 5/12 | a-forest-002 / a-tree / a-bud 認証統一適用 / 統合テスト着手 |
| 5/13 | 全 Garden 認証統一 完成 / Vercel デプロイ / **後道さんデモ準備完了** |
| 5/14-16 | 後道さんデモ実施（東海林さん日程調整）|

---

## 6. dispatch counter / 後続予定

- a-main-013: main- No. 86 → 次は **87**
- 後続:
  - 各モジュール進捗報告 受領（main- No. 87+ で随時補足）
  - 5/12-13 統合テスト指揮
  - 5/14-16 後道さんデモ最終調整

---

## 7. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 76-85 | 各種 進行中 / 完了 |
| **main- No. 86（本書）** | 🔴 投下中 |

---

ご確認・ガンガン着手お願いします。判断保留事項あれば即停止 → a-main-013 経由で東海林さんに即上げ → 即回答 → ガンガン継続。
