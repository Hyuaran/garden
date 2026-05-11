# dispatch main- No. 107 — a-tree（5/8 金曜朝 起動 + Phase D-02 続き GO）

> 起草: a-main-014（先行起草、5/8 朝投下用）
> 用途: a-tree 5/8 金曜朝起動指示 + Phase D-02 implementation 続き
> 番号: main- No. 107
> 起草時刻: 2026-05-07(木) 20:43

---

## 投下用短文（東海林さんが a-tree にコピペ、5/8 金曜朝に投下）

~~~
🟢 main- No. 107
【a-main-014 から a-tree への dispatch（5/8 金曜朝 起動 + Phase D-02 続き + 既知の課題対応）】
発信日時: 2026-05-08(金) 朝 投下用

おはようございます。5/7 木曜 既知の課題調査 + tree-7/8/9 受領ありがとうございました。

詳細は以下ファイル参照:
[docs/dispatch-main-no107-tree-friday-morning-startup-20260508.md](docs/dispatch-main-no107-tree-friday-morning-startup-20260508.md)

## 起動報告依頼

1. `git pull origin feature/tree-phase-d-02-implementation-20260427`
2. 状態報告:
   - PR #109 / #110 消失問題（C 垢移行で発生）の代替 PR 進捗
   - tree-7/8/9 で確認した既知の課題リスト

## 5/8 金曜本日の優先タスク

### 第一優先: 代替 PR 発行（A 案承認済、想定 0.3d）

PR #109/#110 消失 → 新規 PR 発行依頼済（main- No. 90、a-tree A 案承認）。
未発行であれば 5/8 朝で発行。

### 第二優先: Phase D-02 implementation 続き（想定 1.0-2.0d）

ブランチ: feature/tree-phase-d-02-implementation-20260427
Phase D plan v3（70 task、Tree 特例 §17 完備）に基づき、未着手 task を順次実施。

### 第三優先: tree.md design-status 起草（想定 0.2d）

bloom.md / tree.md / leaf.md / root.md / soil.md は 5/5 完成済（_chat_workspace/garden-design-status/）。
最新進捗反映が必要なら更新版起草。

## 自走判断 GO 範囲

- 代替 PR 発行 即実施 OK
- Phase D-02 残 task 連続着手 OK
- TDD 厳守、既存パターン踏襲
- 苦戦 / 設計判断必要 → 即 tree-N で a-main-014 経由
- Tree 特例（§17 現場慎重展開）は本番投入時のみ、開発段階は通常進行 OK
- 5/14-16 後道さんデモには Tree は出さない（Bloom + 全体ダッシュボード中心）

## Tree のリリース戦略（リマインド）

CLAUDE.md §18 Phase D: Tree は最後着手 + 最慎重展開。
- §16 7 種テスト完走必須
- §17 1 人 → 2-3 人 → 半数 → 全員（FileMaker 切替）
- 失敗許されない、コールセンター主力業務

開発段階の今は通常進行 OK。本番投入時のみ慎重モード切替。

## 制約遵守

- 動作変更なし（既存コードは触らない）
- 新規 npm install 禁止
- Supabase 本番データ操作禁止
- FileMaker 既存データ操作禁止
- 設計判断・仕様変更なし
- main / develop 直 push なし

完走 / 区切り報告は tree-N（次番号 10）で。
~~~

---

## 1. 背景

5/8 金曜朝の a-tree 起動指示。Thursday の tree-7/8/9 受領を受けて、PR 代替 + Phase D-02 続き。

### 1-1. Thursday 夜の状態

既知の課題調査 + tree-7/8/9 受領。PR #109/#110 消失代替を依頼済（main- No. 90）。

### 1-2. 5/8 金曜の本命

代替 PR 発行 + Phase D-02 implementation 続き。

---

## 2. dispatch counter

- a-main-014: main- No. 107 → 次は **108**

---

## 3. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 90（PR 代替 A 案承認）| ✅ 受領済 |
| 直近: tree-9（既知の課題調査）| ✅ 受領済 |
| **main- No. 107（本書、5/8 金曜朝 起動 + Phase D-02 続き）** | 🔵 5/8 金曜朝 投下予定 |
