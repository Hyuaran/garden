# dispatch main- No. 83 — 横断周知（全モジュールセッション宛）：5/8 後道さんデモ延期 + Garden 統一認証ゲート 着手

> 起草: a-main-013
> 用途: 全モジュールセッション宛 横断周知（5/8 デモ延期 + Garden Series 統一認証ゲート 本格着手 + 各モジュール役割分担）
> 番号: main- No. 83
> 起草時刻: 2026-05-07(木) 17:48
> 緊急度: 🔴 重要（5/13 完成、5/14-16 後道さんデモ調整）

---

## 投下用短文（東海林さんが各モジュールセッションにコピペ、宛先別 1 通ずつ）

### 投下先 A: a-bloom-004（最優先、login 実装担当）

~~~
🔴 main- No. 83
【a-main-013 から a-bloom-004 への 横断 dispatch（5/8 デモ延期 + Garden 統一認証ゲート 本格着手）】
発信日時: 2026-05-07(木) 17:48

5/8 後道さんデモは Garden シリーズ全体の認証統一が必要なため延期します（後道さんが「Garden Forest」表示で混乱を防ぐため）。最短再設定：5/13-16 想定。

詳細・claude.ai 起草資産・各モジュール役割分担は以下ファイル参照:
[docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md](docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md)

a-bloom-004 が main 実装担当（最優先）:
1. claude.ai 起草版採用: _chat_workspace/garden-ui-concept/login.html + garden-home.html を Next.js 化
2. a-bloom-004 既存 /login/page.tsx は **破棄**（claude.ai 起草版に完全置換）
3. パス: `/login`（シリーズ共通ルート）+ `/`（garden-home、ログイン後 Top）
4. 既存 BloomGate の redirect 先を `/login` に変更
5. legacy 保持: `route.legacy-bloom-original-login-20260507.tsx` 等で旧版併存

5/8 朝着手 → 5/10 完成想定（コア実装）。各モジュール側の redirect 統一は a-root-002 / a-forest-002 / a-tree 等が並行対応（main- No. 84+ で個別 dispatch 予定）。

完了報告は bloom-004- No. NN（次番号）で。
~~~

### 投下先 B: a-root-002（認証 backend 中心、最優先）

~~~
🔴 main- No. 83
【a-main-013 から a-root-002 への 横断 dispatch（5/8 デモ延期 + Garden 統一認証ゲート 本格着手）】
発信日時: 2026-05-07(木) 17:48

5/8 後道さんデモは認証統一が必要なため延期します。最短再設定：5/13-16 想定。

詳細は以下ファイル参照:
[docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md](docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md)

a-root-002 が認証 backend 中心（a-bloom-004 と並行）:
1. RootGate の redirect 先を `/login` に統一（既存 `/root/login` は廃止）
2. role 別自動振分けロジック実装（CEO → /, admin → /, manager → /root, staff → /tree, etc）
3. signInRoot / signInBloom / signInForest / signInTree の共通化検討（時間あれば）
4. root_employees テーブルに必要なフィールド追加（既に充足の場合は確認のみ）

5/9 朝着手 → 5/12 完成想定。a-bloom-004 の login 実装と密に連携してください。

完了報告は root-002- No. NN（次番号）で。
~~~

### 投下先 C: a-forest-002（B-min 並行、redirect 統一のみ）

~~~
🟡 main- No. 83
【a-main-013 から a-forest-002 への 横断 dispatch（5/8 デモ延期 + Garden 統一認証ゲート + B-min 並行継続）】
発信日時: 2026-05-07(木) 17:48

5/8 後道さんデモは認証統一が必要なため延期します。最短再設定：5/13-16 想定。

a-forest-002 は B-min 仕訳帳作業を **並行継続 OK**（認証層と独立）。認証統一に関する変更は以下のみ:

1. ForestGate の redirect 先を `/login` に変更（既存 `/forest/login` は廃止）
2. `/forest/login/page.tsx` は legacy 保持で削除（route.legacy-forest-login-20260507.tsx）
3. signInForest 関数は当面残置（共通化は a-root-002 が担当）

5/12 朝着手予定（B-min 完走後）。それまでは forest-9 完走報告（5/9 朝想定）を最優先で。

詳細: [docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md](docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md)
~~~

### 投下先 D: a-tree / a-leaf / a-bud / a-rill 等（後続、redirect 統一のみ）

~~~
🟢 main- No. 83
【a-main-013 から a-XXXX への 横断 dispatch（5/8 デモ延期 + Garden 統一認証ゲート 後続対応）】
発信日時: 2026-05-07(木) 17:48

5/8 後道さんデモは認証統一が必要なため延期します。最短再設定：5/13-16 想定。

a-XXXX は **5/13 以降の対応**で OK（a-bloom-004 + a-root-002 のコア実装完了後）:

1. TreeAuthGate / Bud Gate / Leaf Gate / RillGate の redirect 先を `/login` に変更
2. `/[module]/login/page.tsx` は legacy 保持で削除
3. signInXXX 関数は当面残置

5/14-16 デモ前に各モジュール側の redirect 統一を完了。

詳細: [docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md](docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md)

5/13 以降の dispatch を待つ形で OK（main- No. 84+ で個別投下予定）。
~~~

---

## 1. 状況の重大変更

### 1-1. 5/8 後道さんデモ 延期判断

**経緯**:
- 5/7 17:00 頃 Chrome MCP 視覚確認で Vercel 本番 /bloom 系全画面が **Garden Forest ログイン画面に強制リダイレクト**することが判明
- 後道さんが Bloom を見たいのに「Garden Forest 経営ダッシュボード」表記で混乱する深刻なリスク
- 東海林さん判断「**これはデモ日変更しないといけないぐらいの重要度**」

**新方針**:
- 5/8 デモ延期（後道さんへ東海林さんから連絡）
- Garden Series 統一認証ゲート 本格実装に着手
- 5/13 完成目標 → 後道さんスケジュール調整 → **5/14（水）or 5/15（木）or 5/16（金）デモ**

### 1-2. 後道さん UX 採用ゲートとの整合

memory `project_godo_ux_adoption_gate.md`「実物必須・遊び心・世界観」要件:
- ✅ login.html: 夕暮れ + カード装飾、Cormorant Garamond + 和欧混合フォント
- ✅ garden-home.html: 夜の庭園 + 流れ星「遊び心 ver Final」
- ✅ Garden Series 統一感 = 後道さん UX ゲート通過の必須条件

---

## 2. claude.ai 起草資産（採用確定）

### 2-1. 発見場所

`G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\garden-ui-concept\`

| ファイル | 内容 | サイズ |
|---|---|---|
| **`login.html`** | **Garden Series ログイン画面（最終版）** | 10.4 KB |
| **`garden-home.html`** | **Garden Series ホーム画面（遊び心 ver Final）** | 29.3 KB |
| `images/bg-login-twilight-with-card.png` | ログイン背景（夕暮れ + カード装飾、1870×841）| — |
| `images/bg-night-garden-with-stars.png` | ホーム背景（夜の庭園 + 流れ星、2003×785）| — |
| `images/logo-garden-series.png` | Garden Series ロゴ | — |
| `forest.html` / `tree.html` / `leaf.html` / `bud.html` 等 | 各モジュールのコンセプト画面（軽量版）| 各 6.6 KB |

### 2-2. login.html 設計概要

```
- 背景画像 bg-login-twilight-with-card.png を画面全体に cover 表示
- 画像内に既に描かれている入力欄の枠と Enter ボタンの位置に、
  透明な <input> と <button> を JavaScript で正確に重ね合わせる
- ウィンドウサイズが変わっても画像内の枠と入力欄が常にぴったり重なる
- タイトル「ログイン — Garden Series」
- 入力: 社員番号 4 桁 + パスワード
- ロゴ: 左上に logo-garden-series.png
```

### 2-3. garden-home.html 設計概要

```
- タイトル「Garden Series — 遊び心 ver Final」
- 背景: 夜の庭園 + 流れ星
- フォント: Cormorant Garamond + Noto Serif JP + Shippori Mincho
- 色味: 夜空 + ペーパー + ゴールドアクセント
- 各モジュール（Forest / Bloom / Tree / Bud / Leaf / Root / Rill / Soil / Sprout / Calendar / Fruit / Seed）への入口
```

### 2-4. login.html ヘッダー記載「次工程」

> このファイルは _chat_workspace/garden-ui-concept/ 配下のドラフト
> Claude Code 側で 015_Gardenシリーズ/ 配下の正式ディレクトリに整理移送
> 必要なら React/Next.js 化、認証 API 接続、社員マスタ連携等を実装

---

## 3. 設計判断 5 件（確定）

| # | 項目 | 確定内容 |
|---|---|---|
| 1 | パス | `/login`（シリーズ共通ルート）+ `/`（ログイン後 Top = garden-home）|
| 2 | ブランディング | 「**Garden Series**」（claude.ai 起草版そのまま）|
| 3 | ログイン後 | role 別自動振分け（CEO → /, admin → /, manager → /root, staff → /tree, etc）|
| 4 | 既存 ログイン | 全モジュールの `/[module]/login` を **完全廃止**（東海林さんしか使ってない、リダイレクト不要、即削除 OK）|
| 5 | デザイン | claude.ai 起草版（login.html + garden-home.html）採用、a-bloom-004 既存 BackgroundCarousel は破棄 |

---

## 4. 各モジュール 役割分担

| 担当 | タスク | 工数 | 期間 |
|---|---|---|---|
| **a-bloom-004** | login.html / garden-home.html → Next.js 化（main 実装担当）| 1.5d | 5/8-5/10 |
| **a-bloom-004** | 既存 `/login/page.tsx` 破棄（legacy 保持）| 0.2d | 5/8 |
| **a-bloom-004** | BloomGate の redirect 先を `/login` に統一 | 0.3d | 5/10 |
| **a-root-002** | RootGate の redirect 先 + role 別振分けロジック | 1.0d | 5/9-5/12 |
| **a-root-002** | signInRoot / signInBloom 等の共通化検討 | 0.5d | 5/12 |
| **a-forest-002** | ForestGate redirect + `/forest/login` 廃止 | 0.3d | 5/12 |
| **a-tree** | TreeAuthGate redirect + `/tree/login` 廃止 | 0.3d | 5/13 |
| **a-bud** | Bud Gate redirect + `/bud/login` 廃止 | 0.3d | 5/13 |
| **a-leaf** | Leaf Gate redirect + `/leaf/login` 廃止 | 0.3d | 5/13 |
| **a-rill** | RillGate redirect + `/rill/login` 廃止 | 0.3d | 5/13 |
| **全モジュール** | 統合テスト（Vercel デプロイ + 全画面 redirect 確認）| 1.0d | 5/13 |
| 合計 | | **約 6.0d** | 5/8-5/13 |

---

## 5. スケジュール

| 日付 | マイルストーン |
|---|---|
| 5/7 夜 | main- No. 83 横断周知投下 + 後道さんへの延期連絡（東海林さん）|
| 5/8 朝 | a-bloom-004 が claude.ai 起草版 Next.js 化 着手 |
| 5/9 朝 | a-forest-002 forest-9 完走報告（B-min 仕訳帳 完成）|
| 5/9 | a-root-002 認証 backend 着手 |
| 5/10 | a-bloom-004 login + garden-home 完成（コア実装）|
| 5/11-12 | 各モジュール gate redirect 統一 |
| 5/13 | 統合テスト + Vercel デプロイ |
| 5/14-16 | 後道さんデモ調整（東海林さん）|

---

## 6. 後道さんへの延期連絡（東海林さん作業）

**メッセージ案**（対面 or Chatwork）:

```
後道さん、5/8 のデモですが、Garden シリーズ全体の世界観統一のための仕様調整に
時間をいただきたく、5/13-16 のいずれかに延期させてください。
仕上がりが大きく良くなる方向の調整なので、当日見せられる完成度が上がります。
都合の良い日時をお知らせいただければ調整します。
```

memory `project_godo_communication_style.md`「対面のみ、5-10 分上限」 → 対面で短く伝達推奨。

---

## 7. 並行で続行する作業

| 案件 | 判断 |
|---|---|
| a-forest-002 B-min 仕訳帳 | **続行 OK**（認証層と独立、5/9 朝 forest-9 完走報告）|
| a-bloom-004 BloomState dev mock | **既完了**（dev 環境用、production には影響なし）|
| Vercel `SUPABASE_SERVICE_ROLE_KEY` | **完了済 OK** |
| Bud UI v2 整理移送 | **5/13 以降 post-デモ予定**（変更なし）|
| Leaf 関電業務委託 Phase C | **続行 OK**（変更なし）|

---

## 8. dispatch counter / 後続予定

- a-main-013: main- No. 83 → 次は **84**（counter 更新済）
- 後続 dispatch（5/13 以降に必要）:
  - main- No. 84+: 各モジュール（a-tree / a-bud / a-leaf / a-rill）への redirect 統一個別 dispatch（5/13 以降）
  - main- No. NN: 横断統合テスト指揮（5/13）
  - main- No. NN: 後道さんデモ最終調整（5/14-16）

---

## 9. 関連 dispatch

- main- No. 76（a-forest 銀行 CSV）✅ 完了
- main- No. 77（a-bloom-003 500 修正）✅ 完了
- main- No. 78（a-bloom-003 PR マージ + Vercel）✅ 完了
- main- No. 79（a-bloom-003 BloomState dev mock）✅ 完了
- main- No. 80（a-forest-002 判断保留 回答）✅ 完了
- main- No. 81（a-bloom-004 引き継ぎ）✅ 完了
- main- No. 82（a-forest-002 5/7 中前倒し）✅ 完了
- **main- No. 83（本書、横断周知 + 認証統一着手）** 🔴 投下中

---

ご確認・着手お願いします。判断保留事項あれば即停止 → a-main-013 経由で東海林さんに確認依頼。
