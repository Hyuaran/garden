# 5/14-16 後道さんデモ — リハーサルメモ（Garden Series 統一世界観 + 12 モジュール俯瞰）

作成: 2026-05-07 a-main-014
旧版: [docs/demo-rehearsal-bloom-20260508.md](docs/demo-rehearsal-bloom-20260508.md)（5/8 単日 Bloom 中心、保持）
対象画面: Garden Series 統一 login + garden-home + Bloom 7 画面 + 12 モジュール最新進捗
スタイル: **紙資料 NG・対面のみ・5-10 分上限・「これでいいですね？」型で即 FB を引き出す**

---

## 1. 5/8 → 5/14-16 延期理由（東海林さん手元用、後道さんに直接説明しない）

- Vercel /bloom 系全画面が「Garden Forest」表示で混乱リスク発覚（5/7 17:00）
- 認証統一実装に集中、Garden Series 全体の世界観を一段良い状態で見せるため
- 5/13 統合テストで全 12 モジュール最新化完了 → 5/14-16 にデモ
- 後道さん UX 採用ゲート（実物必須 / 遊び心 / 世界観）を確実に通すため

---

## 2. 5/14-16 3 候補別 準備状態

| 日 | 準備レベル | 推奨度 |
|---|---|---|
| **5/14（水）** | 統合テスト直後、認証統一 Phase A 完成、claude.ai 起草版 login + garden-home 反映済 | 🟢 推奨（早く見せて FB 早く取る）|
| 5/15（木）| 5/14 デモ後 1 晩の磨き込み完了 | 🟡 中（後道さん都合次第）|
| 5/16（金）| 2 晩の磨き込み完了 | 🟡 中（最終調整版）|

→ 後道さん都合 + 東海林さん意向で 1 日確定。3 日全部使うわけではない。

---

## 3. デモ運用（2 系統、5/8 から継承）

| 用途 | 環境 | 表示方法 |
|---|---|---|
| **当日 対面**（メイン）| ローカル dev `http://localhost:3001` | 東海林さん PC を後道さんに直接見せる |
| **後道さん別 PC**（自席 / 持ち帰り確認）| Vercel 本番 `garden-chi-ochre.vercel.app` | URL を後道さんに渡す |

両系統で **同じ最新コード**が動いている前提（5/13 統合テスト後、認証統一反映済）。

---

## 4. 進め方の原則（後道さん特性 ベース）

- ❌ 時間配分・アジェンダ朗読 → じっと聞いてもらえない前提
- ✅ **画面を出して即「これいけそうですか？」型** で進める
- ✅ ヒットしそうな画面から先に出す（後道さんがノる順 = 直感ヒット率最大化）
- ✅ 質問を引き出してから次へ。沈黙なら「次これも見ます？」で送る
- ✅ **最初の 30 秒**で「Garden の世界観」を伝える（login + home の入口）

---

## 5. 推奨表示順（後道さん受け重視、5/14-16 改訂版）

| 順 | 画面 | 開く順理由 | 5/8 旧版との差分 |
|---|---|---|---|
| **1** | **/login**（claude.ai 起草版） | 入口の世界観で第一印象を作る、Garden ブランドを冒頭で確立 | ★ 新規追加 |
| **2** | **/garden-home**（claude.ai 起草版） | 統一ホーム、12 モジュールが俯瞰で見える | ★ 新規追加 |
| 3 | **Bloom Top** | 経営者向けトップ画面の世界観 | 既存 |
| 4 | **CEO Status** | 後道さん専用ダッシュボード（自分事化、最初に「これ僕の画面？」で食いつき UP）| 既存 |
| 5 | **Workboard** | 全体の動きが一覧で見える（経営者ビュー）| 既存 |
| 6 | **Daily Report** | 東海林さんが何してるか問題の解 | 既存（5/7 木曜から MVP 完成済）|
| 7 | **Development Progress**（/bloom/progress）| 12 モジュールの開発状況、最新化済 | 既存（5/10 集約役で最新化）|
| 8 | **Roadmap**（任意、時間あれば）| 6 ヶ月計画の見え方 | 既存 |
| 9 | **Monthly Digest**（任意、時間あれば）| 月次で経営層に届く形 | 既存 |

→ **必須 1-7 で 5-7 分、8-9 は時間余りで追加**

---

## 6. 各画面 見どころ（10 秒で伝える）+ 即決質問

### 1. /login（claude.ai 起草版）★ 新規

- **見どころ**: ボタニカル水彩 / Garden Series 統一ロゴ / 入口の温かみ
- **即決質問**: 「**この入口の感じ、Garden っぽいですか？**」
- **遊び心ポイント**: 季節感の orb / 蕾 → 葉 → 花 のアニメーション

### 2. /garden-home（claude.ai 起草版）★ 新規

- **見どころ**: 12 モジュールが樹冠（Bloom/Fruit/Seed/Forest）/ 地上（Bud/Leaf/Tree）/ 地下（Soil/Root/Rill）の縦階層で見える
- **即決質問**: 「**全体の構造、これで伝わりますか？**」
- **遊び心ポイント**: モジュール間の繋がりを視覚化（樹木の根 → 葉 → 花）

### 3. Bloom Top

- **見どころ**: 入口画面の世界観・温かみ。Garden の「庭」コンセプト
- **即決質問**: 「**最初に開いた瞬間、これいけそうですか？**」

### 4. CEO Status

- **見どころ**: 後道さんの「今日のステータス」「決裁待ち」「重要 KPI」を一画面に集約
- **即決質問**: 「**朝これ見るだけで「今日何決めればいいか」分かりそうですか？**」

### 5. Workboard

- **見どころ**: 全モジュール横断で「今動いていること」が一望できるカンバン風ボード
- **即決質問**: 「**全体の動きを 1 画面で見るならこれで十分ですか？**」

### 6. Daily Report（5/7 完成 MVP）

- **見どころ**: 東海林さんの日次活動が後道さんに見える化（「経営者何してるか問題」の解）
- **即決質問**: 「**東海林さんの動き、これで毎日 1 分で把握できそうですか？**」

### 7. Development Progress（/bloom/progress）

- **見どころ**: Garden 12 モジュール × 進捗 % × Phase × グループ（樹冠 / 地上 / 地下）の一覧 + 履歴
- **即決質問**: 「**全体感、これで把握できそうですか？**」
- **5/10 集約役で最新化済前提**（root_module_design_status migration 反映）

### 8. Roadmap（任意）

- **見どころ**: 6 ヶ月リリース計画（Phase A → D）が時系列で可視化
- **即決質問**: 「**この時系列の見え方で、年内リリース判断できそうですか？**」

### 9. Monthly Digest（任意）

- **見どころ**: 月次で経営層宛に自動配信される「今月のまとめ」プレビュー
- **即決質問**: 「**月初にこれが Chatwork に届いたら、開きますか？**」

---

## 7. 後道さん 反応パターンと対応

| 反応 | 対応 |
|---|---|
| 「いいね、いけそう」 | **次の画面へ即送る**（深掘りしない、テンポ重視）|
| 「ここどうなってる？」 | **その場で答える**（紙資料・後追い NG）|
| 「もっとこうしたい」 | **メモする**（その場で実装議論しない、後で field-feedback-YYYYMMDD-garden.md に書き出し）|
| 沈黙 / 反応薄 | **「次これも見ます？」で送る**（沈黙=NG ではない、進める）|
| 「これは何のために？」 | **1 文で目的を答える**（説教 NG）|

---

## 8. デモ後のアクション（その場で完結させない）

- 後道さん FB は `docs/field-feedback-YYYYMMDD-garden.md` に集約
- 反応の良かった画面 / 弱かった画面を分類
- 翌日以降の優先順位調整に反映

---

## 9. トラブル時の即断対応

| シナリオ | 対応 |
|---|---|
| /login → /garden-home 遷移失敗 | **localhost で再起動 1 回**、ダメなら「世界観だけ見てください」で先に進む |
| /bloom/progress 500 エラー | **MOCK_DATA=1 で起動 + 「これは表示確認用」**（30 秒）|
| 別画面で見栄え崩れ | **「ここはまだ調整中、世界観だけ感じてください」で先に進める** |
| ネット重い / 表示遅い | 画面再読込 1 回まで → ダメなら別画面に切替（**待たせない**）|
| Vercel 表示と localhost で差異 | **localhost を本命**、Vercel は「あとで自席で見られます」|

---

## 10. 「これは見せない」ポリシー

- ❌ 開発進捗の数字（65% 等）の根拠説明 → 「ざっくり」で十分
- ❌ DB 設計 / migration の話 → 後道さん興味なし
- ❌ 5/8 → 5/14-16 リスケの理由詳細 → 「もう少しいい状態で見せたかった」で十分
- ❌ 認証統一 / RLS / Vercel 等の技術用語 → ゼロ
- ❌ コード / SQL → 絶対見せない

---

## 11. 後道さん別 PC URL 配布（Vercel）

### URL（5/13 統合テスト完了 想定）

| 画面 | URL |
|---|---|
| Login | https://garden-chi-ochre.vercel.app/login |
| Garden Home | https://garden-chi-ochre.vercel.app/garden-home |
| Bloom Top | https://garden-chi-ochre.vercel.app/bloom |
| Workboard | https://garden-chi-ochre.vercel.app/bloom/workboard |
| CEO Status | https://garden-chi-ochre.vercel.app/bloom/ceo-status |
| Daily Report | https://garden-chi-ochre.vercel.app/bloom/daily-report |
| Development Progress | https://garden-chi-ochre.vercel.app/bloom/progress |
| Roadmap | https://garden-chi-ochre.vercel.app/bloom/roadmap |
| Monthly Digest | https://garden-chi-ochre.vercel.app/bloom/monthly-digest |

※ 認証統一後の確定 URL は 5/13 統合テスト完了報告で最終化

### 配布タイミング

| タイミング | 行動 |
|---|---|
| 5/14-16 デモ前 | URL リストを後道さんに Chatwork or 紙メモで渡す（「自席で開いて確認できます」一言）|
| デモ中 | 「あとで自席でゆっくり見られるように URL も渡しますね」 |
| デモ後 | URL 改めて Chatwork で送る + 「気になる画面あったら直接コメントもらえれば」 |

### 後道さんが別 PC で見る時の認証

- **認証統一後**: /login → role 判定 → 各モジュールへ
- 後道さん用ログイン方法を 5/13 中に確認（東海林さんから後道さんへの伝達経路）
- パスワード or PIN を後道さんに伝達（Chatwork DM）

---

## 12. デモ前日チェック（東海林さん 10 分）

### 5/14 デモの場合（5/13 統合テスト完了直後）

- [ ] localhost:3001/login 200 OK ✅（対面用）
- [ ] localhost:3001/garden-home 200 OK ✅
- [ ] localhost:3001/bloom/progress 200 OK ✅（最新化済）
- [ ] garden-chi-ochre.vercel.app/login 200 OK ✅（後道さん用）
- [ ] garden-chi-ochre.vercel.app/garden-home 200 OK ✅
- [ ] 両方で 9 画面（login + garden-home + bloom 7 画面）OK
- [ ] **NG ある場合の即断**: 5/15 へリスケ or 当日対面はローカルで vercel は「ローカル動作確認後にあらためて URL 送信」

### 5/15 / 5/16 デモの場合

- 5/14 デモの FB を反映した状態で再チェック
- 全画面の世界観統一感確認

---

## 13. デモ後の段取り

- 後道さん FB 集約 → `docs/field-feedback-YYYYMMDD-garden.md`
- 別 PC でアクセス時の追加 FB（後日）も同ファイルに集約
- 関連モジュールへ FB 反映 dispatch
- 5/15 or 5/16 のデモ前なら、その日のリハで反映

---

## 14. 関連 docs / memory

- 旧版: [docs/demo-rehearsal-bloom-20260508.md](docs/demo-rehearsal-bloom-20260508.md)（保持）
- リスケ草案: [docs/godo-reschedule-chatwork-draft-20260507.md](docs/godo-reschedule-chatwork-draft-20260507.md)
- 統合テスト Plan: [docs/superpowers/plans/2026-05-13-garden-series-integration-test-plan.md](docs/superpowers/plans/2026-05-13-garden-series-integration-test-plan.md)
- memory: `project_godo_communication_style.md`（紙 NG / 対面 / 5-10 分）
- memory: `project_godo_ux_adoption_gate.md`（実物必須 / 遊び心 / 世界観）
- memory: `feedback_demo_quality_must_match_production.md`（デモ品質 = 本番品質）
- memory: `project_garden_3layer_visual_model.md`（樹冠 / 地上 / 地下）

---

## 15. 改訂履歴

- 2026-05-07 21:25 初版（a-main-014）
  - 5/8 単日 Bloom 中心 → 5/14-16 3 候補 Garden 統一世界観に拡張
  - /login + /garden-home（claude.ai 起草版）追加（推奨表示順 1-2 に挿入）
  - Daily Report MVP 完成済を反映
  - /bloom/progress 5/10 集約役 最新化前提を反映
