# dispatch main- No. 87 — a-bloom-004 通知（E 案 GO / Phase 2 + Phase 3 今夜完走）

> 起草: a-main-013
> 用途: a-bloom-004 へ「E 案 採用 / Phase 2 garden-home + Phase 3 BloomGate redirect 今夜完走 GO」
> 番号: main- No. 87
> 起草時刻: 2026-05-07(木) 18:31

---

## 投下用短文（東海林さんが a-bloom-004 にコピペ）

~~~
🔴 main- No. 87
【a-main-013 から a-bloom-004 への dispatch（E 案 GO / Phase 2 + Phase 3 今夜完走）】
発信日時: 2026-05-07(木) 18:31

bloom-004- No. 43 受領、Phase 1 27 分完走 + 視覚確認完璧。E 案採用です。

詳細は以下ファイル参照:
[docs/dispatch-main-no87-bloom-004-e-plan-go-20260507.md](docs/dispatch-main-no87-bloom-004-e-plan-go-20260507.md)

## 採用方針

**E 案: Phase 2 + Phase 3 今夜完走**（21-22:00 想定）

| Phase | タスク | 工数 |
|---|---|---|
| Phase 2 | garden-home.html (29.3 KB) → `/page.tsx` 化 | 約 1.0d → 圧縮 |
| Phase 3 | BloomGate redirect (`/forest/login` → `/login`) | 約 0.2d |

## 東海林さんからの方針（恒久）

「**ずっとこのモードで開発していく**」 = ガンガン進めるモードは常態（デモ向けの一時的なものではない）。

→ a-bloom-004 もこの方針で 5/8 以降の Phase A-2 統合 KPI / Daily Report 本実装等の前倒しタスクも継続的に進めて OK。

## 自己判断 OK の範囲

- 27 分速度実証済 = a-bloom-004 自走信頼度 高い
- garden-home.html 29.3 KB を慎重実装 → 完走目標、ただし苦戦時は無理せず判断（21:00 時点で進捗確認 → 苦戦してたら Phase 2 のみ明朝送りでも OK）
- Phase 3（BloomGate redirect 0.2d）は確実に今夜完走

## 完了報告

- Phase 2 + 3 完走時: bloom-004- No. 44（次番号）
- Phase 3 のみ完走 + Phase 2 明朝送りの場合も bloom-004- No. 44 で報告
- 視覚確認 + 5/13 統合テスト想定の準備状況も併記

## 注意点

- 旧コード保持ルール厳守（page.legacy-* 併存）
- claude.ai 起草版 garden-home.html の世界観（夜の庭園 + 流れ星 + Cormorant Garamond + Shippori Mincho）を完璧再現
- メニュー画面の各モジュール入口は role 別自動振分け（5/9 以降 a-root-002 と統合）

ガンガン進めましょう。判断保留あれば即上げてください。
~~~

---

## 1. 背景

### 1-1. bloom-004- No. 43 受領（18:24）

a-bloom-004 が main- No. 84 受領 → **27 分で Phase 1 (/login) 完走 + 視覚確認 OK**:
- 画像 3 枚コピー / legacy 保持 / 新 /login/page.tsx Next.js 化
- 目アイコン + 状態保持 + signInBloom 流用 + 廃止機能 全完了
- commit `aa7a76c` push 済
- claude.ai 起草版（夕暮れアーチ + バラ + 流れ星 + Welcome to the Garden）完璧再現

### 1-2. 東海林さん判断（18:30）

> デモがあるから等というわけではなく、ずっとこのモードで私は開発していく
> ただし Garden 開発進捗等、社内への工数日程等は現実的な数値で出して
> 推奨でガンガン進めていこう

**重要な方針確認**:
1. 「ガンガン進める」は 5/8 デモ延期だけの一時的なものではなく、**常態モード**
2. **社内報告（後道さん含む経営層）には現実的な数値**で報告（誇張しない）
3. E 案採用（Phase 2 + Phase 3 今夜完走）

---

## 2. E 案 詳細

### 2-1. Phase 2: garden-home.html → `/page.tsx` 化

**規模**: 29.3 KB（login.html の約 3 倍）

**claude.ai 起草版の特徴**:
- タイトル「Garden Series — 遊び心 ver Final」
- 背景: 夜の庭園 + 流れ星（bg-night-garden-with-stars.png、2003×785）
- フォント: Cormorant Garamond + Noto Serif JP + Shippori Mincho
- 色味: 夜空 + ペーパー + ゴールドアクセント
- 各モジュール（Forest / Bloom / Tree / Bud / Leaf / Root / Rill / Soil / Sprout / Calendar / Fruit / Seed）への入口

**実装方針**:
- claude.ai 起草版を完璧再現（世界観壊さない）
- 各モジュール入口は **role 別自動振分け**ロジック（5/9 以降 a-root-002 と統合、初期実装は静的リンク or 全モジュールリンク）
- Next.js / React 化（Server Component or Client Component 判断は a-bloom-004 自走）
- legacy 保持（既存 page.tsx を `page.legacy-bloom-original-home-20260507.tsx` 等で残す、ただし既存 home 画面が無ければ skip）

### 2-2. Phase 3: BloomGate redirect 変更

**変更箇所**: BloomGate.tsx の `BLOOM_PATHS.FOREST_LOGIN` → `/login`

**確認**: 旧 BloomGate redirect 先 `/forest/login` から新 `/login` への変更で、未認証時の挙動が新統一画面に切り替わる。

---

## 3. 自己判断 OK の範囲

| シナリオ | a-bloom-004 自走判断 OK |
|---|---|
| Phase 2 が想定より複雑 → 21:00 時点で進捗確認 → 苦戦してたら明朝送り | ✅ |
| Phase 2 完走 + Phase 3 完走 = 全完走（22:00 想定）| ✅ |
| Phase 3 のみ今夜 + Phase 2 明朝送り（D 案降格）| ✅ |
| Phase 1 で停止（F 案降格、想定外の問題発生）| ✅（理由を bloom-004- No. 44 で報告）|

判断保留が出たら即停止 → bloom-004- No. NN で a-main-013 へ。

---

## 4. 重要な恒久方針（東海林さん明言）

### 4-1. 「ガンガン進める」は常態モード

- 5/8 デモ延期で生まれた時間を活用するだけでなく
- **5/14-16 デモ後も同じ姿勢**で各モジュール前倒し継続
- 各モジュールセッションは自走判断 OK の範囲を最大化

### 4-2. 社内報告は現実的な数値

- 内部開発進捗（a-main-013 / 各モジュール）= ガンガン
- 社内報告（後道さん含む経営層、Chatwork、効果測定）= 現実的
- 例: 「Bloom Phase A-2 統合 KPI 完成」「Forest v9 機能 70% 移植完了」等の客観的指標
- 工数日程: 楽観的な短縮ではなく、過去実績ベースで現実的に

→ memory 化候補: 「ガンガン進める常態モード + 社内報告は現実的数値」を **新規 memory** で永続化推奨（後で東海林さんに提案）。

---

## 5. dispatch counter / 後続予定

- a-main-013: main- No. 87 → 次は **88**（counter 更新済）
- a-bloom-004: bloom-004- No. 43 → 次 **44**（Phase 2 + 3 完走報告 or 明朝送り判断報告）

---

## 6. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 84（5 件回答 + 今夜本実装 GO）| ✅ a-bloom-004 受領 + 27 分 Phase 1 完走 |
| **main- No. 87（本書、E 案 GO）** | 🔴 投下中 |

---

ご確認・着手お願いします。判断保留事項あれば即停止 → a-main-013 経由で東海林さんに即上げ → 即回答 → ガンガン継続。
