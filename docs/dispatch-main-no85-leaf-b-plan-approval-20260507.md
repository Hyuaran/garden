# dispatch main- No. 85 — a-leaf-002 通知（B 案承認 / Phase A UI 着手時に /login redirect 組込）

> 起草: a-main-013
> 用途: a-leaf-002 へ「leaf-002-3 提示の B 案 承認」「5/13 個別 dispatch 不要、Phase A UI 着手時に最初から /login 仕様で実装」
> 番号: main- No. 85
> 起草時刻: 2026-05-07(木) 18:20

---

## 投下用短文（東海林さんが a-leaf-002 にコピペ）

~~~
🟢 main- No. 85
【a-main-013 から a-leaf-002 への dispatch（B 案承認 + 5/13 個別 dispatch 不要）】
発信日時: 2026-05-07(木) 18:20

leaf-002-3 受領、Leaf 現状の事前共有ありがとうございます。提示の **B 案で OK**（東海林さん承認）。

詳細は以下ファイル参照:
[docs/dispatch-main-no85-leaf-b-plan-approval-20260507.md](docs/dispatch-main-no85-leaf-b-plan-approval-20260507.md)

## 承認内容

| 項目 | 結果 |
|---|---|
| B 案採用 | ✅ Phase A UI 着手時に **最初から `/login` redirect 仕様で実装**（重複作業回避） |
| 5/13 a-leaf 個別 dispatch | ❌ **不要**（B 案採用のため、廃止作業なし）|
| 5/13 工数 | 0.3d → **0d** |
| Phase D 関電業務委託 | ✅ **並行続行 OK**（変更なし、PR #65-#73 review 待ち + ローカル 3 ブランチ push 待機継続）|

## a-leaf-002 が実施すること（変更点なし）

1. **5/13 まで通常モードで継続**（Phase D 関電業務委託 review 待ち）
2. PR #65-#73 develop merge 完了 + 認証統一方針確定後 → Phase A UI 着手
3. Phase A UI 着手時、新設 LeafGate（or 同等の認証導線）を **最初から `/login` redirect 仕様**で実装
4. signInLeaf 関数（`_lib/auth.ts` 内）は当面残置（共通化は a-root-002 担当）

## /login の最終仕様（Phase A UI 着手時の参考情報）

5/13 完成見込み（a-bloom-004 + a-root-002 実装中）:
- パス: `/login`（シリーズ共通ルート）
- ブランディング: 「Garden Series」
- ベース: claude.ai 起草版 login.html + garden-home.html
- ログイン後: role 別自動振分け（CEO → /, admin → /, manager → /root, staff → /tree, etc）
- backoffice ロックは Phase A 移行検討（既存 lock screen 方式 → /login redirect への移行可否、Phase A 設計時に判断）

完了報告は a-leaf 内部の Phase A 着手時 / Phase A 完成時で OK（5/13 専用 dispatch 不要）。

判断保留事項あれば即停止 → a-main-013 経由で東海林さんに確認依頼。
~~~

---

## 1. 背景

### 1-1. a-leaf-002 leaf-002-3 受領

a-leaf-002 が 17:55 に main- No. 83 受領 + Leaf 現状の事前共有 + 判断保留 3 案を提示。

### 1-2. 重要な事前共有内容

| 観点 | 実態 |
|---|---|
| LeafGate コンポーネント | ❌ 存在しない（全ブランチ走査済）|
| /leaf/login/page.tsx | ⚠️ develop 未 merge（feature/leaf-kanden-supabase-connect のみ）|
| develop 上の src/app/leaf/ | 空（Phase A UI 未着手）|
| 既存 auth | backoffice/page.tsx 内の lock screen 方式（専用 Gate ではない）|

### 1-3. 3 案

| 案 | 内容 | 工数 | 重複作業 |
|---|---|---|---|
| A | feature ブランチ側で先行統一 | 0.3d | あり |
| **B（採用）** | **Phase A UI 着手時に最初から /login redirect 仕様で実装** | **0d** | なし |
| C | feature/leaf-kanden を develop merge → redirect 統一 | 0.5d + merge リスク | あり |

### 1-4. 東海林さん判断（18:19）

B 案 OK 承認。

---

## 2. B 案採用の理由

| 観点 | 効果 |
|---|---|
| 重複作業回避 | develop に存在しないものを廃止する作業は不要 |
| 自然な実装タイミング | Phase A UI 着手時に最初から正しい仕様で実装 |
| 工数削減 | 0.3d → 0d |
| 5/14-16 デモ影響 | なし（Leaf はデモ対象外） |
| develop merge 競合 | なし |
| Phase A UI 完成度 | 手戻りなし、最初から /login 統一 |

---

## 3. a-leaf-002 が今後実施すること

### 3-1. 5/13 までの作業（変更なし）

| タスク | 状態 |
|---|---|
| Phase D 関電業務委託 PR #65-#73 review 待ち | 継続 |
| ローカル 3 ブランチ push 待機（GitHub 復旧後）| 継続 |

### 3-2. Phase A UI 着手時（時期未定、PR merge + 認証統一方針確定後）

1. 新設 LeafGate（or 同等の認証導線）を **最初から `/login` redirect 仕様**で実装
2. backoffice/page.tsx 内の lock screen 方式は維持 or Phase A 設計時に migration 判断
3. signInLeaf 関数は当面残置（共通化は a-root-002 担当）

---

## 4. /login の最終仕様（参考情報）

5/13 完成見込み（a-bloom-004 + a-root-002 実装中）:

| 項目 | 値 |
|---|---|
| パス | `/login`（シリーズ共通ルート）|
| ブランディング | 「Garden Series」 |
| ベース | claude.ai 起草版 login.html + garden-home.html |
| ログイン後遷移 | role 別自動振分け（CEO → /, admin → /, manager → /root, staff → /tree, etc）|
| 認証 backend | Supabase Auth + root_employees（既存統一） |
| 共通化 | a-root-002 が signInGarden helper 抽出検討 |

---

## 5. dispatch counter / 後続予定

- a-main-013: main- No. 85 → 次は **86**（counter 更新済）
- 後続 dispatch:
  - main- No. 86+: a-bloom-004 / a-root-002 進捗報告 受領 + 補足
  - main- No. NN: 各モジュール（a-tree / a-bud）への redirect 統一個別 dispatch（5/13 以降）
    - a-leaf は除外（B 案採用のため）

---

## 6. 関連 dispatch

- main- No. 76-83（前回までの履歴 省略、各 dispatch ファイル参照）
- main- No. 84（a-bloom-004 5 件回答 + a-root-002 補足）
- **main- No. 85（本書、a-leaf-002 B 案承認）** 🟢

---

ご確認・継続お願いします。判断保留事項あれば即停止 → a-main-013 経由で東海林さんに確認依頼。
