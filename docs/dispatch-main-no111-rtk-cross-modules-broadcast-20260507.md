# dispatch main- No. 111 — 横断 broadcast（RTK 64.9% 削減効果共有 + 全セッション適用確認）

> 起草: a-main-014
> 用途: 全モジュールセッション宛 横断 broadcast、RTK 適用状況確認
> 番号: main- No. 111
> 起草時刻: 2026-05-07(木) 21:08

---

## 投下用短文（東海林さんが 全モジュールセッションに各 1 回コピペ）

宛先候補: a-soil / a-root-002 / a-tree / a-leaf-002 / a-bud / a-bloom-004 / a-forest-002 / a-rill / a-seed / a-auto / b-main

各セッションに同一短文を投下、`<セッション名>-N` で返信依頼。

~~~
🟢 main- No. 111
【a-main-014 から 全モジュールセッション への 横断 broadcast（RTK 64.9% 削減効果共有 + 適用確認）】
発信日時: 2026-05-07(木) 21:08

5/6-5/7 のガンガン常態モード初日で、RTK（Rust Token Killer）による **64.9% トークン削減（476.3K トークン）** が実証されました。
これは a-bud 9 件 / 305 → 329 tests / 62% 圧縮、a-soil 13 倍速、a-bloom-004 6 倍速、a-leaf-002 61% 短縮 等、全セッション加速の主要因です。

各セッションで RTK 適用状況を確認・報告いただきたいです。

詳細は以下ファイル参照（git fetch --all 後に閲覧可能）:
[docs/dispatch-main-no111-rtk-cross-modules-broadcast-20260507.md](docs/dispatch-main-no111-rtk-cross-modules-broadcast-20260507.md)

## RTK とは（簡潔）

- Rust 製 CLI proxy（Token Killer）
- dev 操作（git / cargo / npm / supabase 等）のトークン消費を 60-90% 削減
- Claude Code hook で自動有効化（Bash 呼び出しを透過的に書き換え）
- 設定: ユーザー global の RTK.md 経由で全プロジェクト適用

## 確認手順（5 分以内）

1. PowerShell で以下を順次実行:
   ```
   rtk --version
   rtk gain
   which rtk
   ```
2. 結果を `<セッション名>-N` で返信:
   - ✅ 適用済（rtk version 表示 + gain 動作）
   - 🟡 部分動作（version OK / gain NG 等）
   - ❌ 未適用（command not found）
   - ⚠️ Name collision（reachingforthejack/rtk = Rust Type Kit が入っている）

## 適用済の場合（推奨アクション）

- そのまま継続、追加対応不要
- `rtk gain --history` で本日の削減量を確認すると面白い
- `rtk discover` で「より削減できる未活用 command」を発見可能

## 未適用 / 部分動作の場合

- 即報告、a-main-014 で追加 dispatch（インストール手順 / トラブル shooting）起草
- ガンガン常態モード継続のためには全セッション適用が望ましい

## RTK 削減効果の実測（5/6-5/7）

| 指標 | 値 |
|---|---|
| 削減率 | **64.9%** |
| 削減トークン数 | **476.3K** |
| 期間 | 約 2 日（5/6 〜 5/7 21:00）|
| 発動シーン | 全セッション dev 操作（git / npm / supabase 等）|

CLAUDE.md §19 目標（60% 削減）大幅超過。ガンガン常態モード成立の中核要因。

## 報告フォーマット（簡潔）

~~~
🟢 <セッション名>-N
【<セッション名> から a-main-014 への RTK 適用報告】
発信日時: YYYY-MM-DD(曜) HH:MM

- rtk --version: <出力>
- rtk gain: <出力 or エラー>
- which rtk: <出力>

判定: ✅ 適用済 / 🟡 部分動作 / ❌ 未適用 / ⚠️ Name collision
~~~

## 制約遵守

- インストール / 設定変更は東海林さん許可のもとで実施（自走で apt/brew install 等は禁止）
- 既存 RTK 設定の上書きは禁止
- ユーザー global の RTK.md は変更禁止（個人設定）

ご確認お願いします。判断保留即上げ歓迎です。
~~~

---

## 1. 背景

### 1-1. 起動プロンプトでの想定

東海林さんから「a-main-014 起動時の最初のタスク = RTK 横断 broadcast を main- No. 101 として投下」と指示。
私（a-main-014）は既に main- No. 101 を a-bud D-11 推奨に使用済 → 番号変更で main- No. 111 として実現。

### 1-2. RTK 64.9% 削減実証

handoff（docs/handoff-a-main-013-to-014-20260507.md）記載:
- 5/6-5/7 累計 64.9% 削減、476.3K トークン
- ガンガン常態モード初日成立の要因
- a-bud 9 件 / a-soil 13 倍速 / a-bloom-004 6 倍速 / a-leaf-002 61% 短縮

### 1-3. 全セッション適用確認の必要性

ガンガン常態モードを恒久化する前提として、全モジュールセッションで RTK が動作している必要あり。
未適用セッションが残ると、ボトルネックとして全体加速を阻害する可能性。

---

## 2. 配布対象セッション

| セッション | 配布優先度 | 想定状態 |
|---|---|---|
| a-bud | ⭐ 高（実績あり、9 件 / 329 tests）| 適用済推定 |
| a-soil | ⭐ 高（13 倍速実績）| 適用済推定 |
| a-bloom-004 | ⭐ 高（6 倍速実績）| 適用済推定 |
| a-leaf-002 | ⭐ 高（61% 短縮実績）| 適用済推定 |
| a-root-002 | 🟢 中 | 未確認 |
| a-tree | 🟢 中 | 未確認 |
| a-forest-002 | 🟢 中 | 未確認 |
| a-rill / a-seed | 🟡 低（休眠中）| 適用は次回起動時 |
| a-auto | 🟢 中（自律実行で重要）| 未確認 |
| b-main | 🟡 低（バックアップ）| 未確認 |

---

## 3. dispatch counter

- a-main-014: main- No. 111 → 次は **112**

---

## 4. 関連 dispatch / docs

- CLAUDE.md §19 トークン削減目標（60%、現在 64.9% 達成）
- ユーザー global RTK.md（C:/Users/shoji/.claude/RTK.md）
- handoff-a-main-013-to-014-20260507.md（RTK 効果記載）

---

## 5. 想定される返信パターン

| 返信 | 対応 |
|---|---|
| ✅ 適用済 | カウント、横断サマリ更新 |
| 🟡 部分動作 | 個別 dispatch でトラブル shooting |
| ❌ 未適用 | インストール手順 dispatch 起草 |
| ⚠️ Name collision | reachingforthejack/rtk アンインストール手順 dispatch |

全セッション返信揃ったら、横断サマリを別 dispatch で報告。
