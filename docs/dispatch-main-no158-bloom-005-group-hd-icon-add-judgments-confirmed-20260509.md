# dispatch main- No. 158 — a-bloom-005 へ hyuaran-group-hd.png 追加組込 + 判断保留 3 件採用通知

> 起草: a-main-015
> 用途: a-bloom-005 への bloom-005- No. 4 受領確認 + グループ HD アイコン追加組込 + 判断 3 件確定
> 番号: main- No. 158
> 起草時刻: 2026-05-09(土) 01:31

---

## 投下用短文（東海林さんが a-bloom-005 にコピペ）

~~~
🟢 main- No. 158
【a-main-015 から a-bloom-005 への dispatch（bloom-005- No. 4 受領 + 判断 3 件採用 + hyuaran-group-hd.png 追加組込）】
発信日時: 2026-05-09(土) 01:31

# 件名
bloom-005- No. 4 受領 ✅ 4/4 完走 + 判断保留 3 件すべて推奨採用 + hyuaran-group-hd.png 追加組込指示

# bloom-005- No. 4 受領内容（要約）
- A: WebP 変換 ✅（Pillow 12.2.0 quality 90 method 6、圧縮率平均 -89.6%）
- B: TypeScript 定義 ✅（src/lib/garden-corporations.ts、helper 3 件）
- C: KK 案 spec 更新 ✅（§1-2 / §2 / §9 改訂履歴）
- D: Forest 連携 spec 起票 ✅（docs/specs/2026-05-09-forest-corporations-mock-migration.md、約 200 行）
- 累積 7 commit ahead（push は 5/9 09:00 JST 過ぎ broadcast 後）

# 横断調整セッションの判断（3 件確定、すべて推奨採用）

| # | 論点 | 採用 | 理由 |
|---|---|---|---|
| 1 | Forest 連携 spec 実装担当 | **a-forest-002**（Forest ownership）| Forest 既存 fetcher の owner、現在 B-min #2 進行中だが本タスクと並行可 |
| 2 | KPI dashboard color 視覚連動 | **Phase A-2.2 で別途**（5/13 まで spec 完備で十分）| 5/13 統合テスト前は spec 確定、実装は phase 別建て |
| 3 | 本番 forest_corporations 6 法人 INSERT | **a-forest 起票**（migration として）| 本番データ DDL は forest 担当、a-forest-002 で migration 起票 |

→ a-main-015 が翌朝（5/9 朝）a-forest-002 へ Forest 連携 spec 実装依頼 dispatch（main- No. 159）起票予定。

# 追加組込指示: hyuaran-group-hd.png

main- No. 157 で東海林さん配置完了 + a-main-015 視覚評価合格した **6 法人花束統合アイコン** を、本完走報告（bloom-005- No. 4）後に追加組込してください。

## 追加作業（軽量、5-10 分見込）

### A-2. WebP 変換（追加 1 ファイル）

```
cwebp -q 90 hyuaran-group-hd.png -o hyuaran-group-hd.webp
# (cwebp 不在なら Pillow で同 spec)
```

配置先:
```
C:\garden\a-bloom-005\public\themes\corporate-icons\hyuaran-group-hd.webp
```

### B-2. TypeScript 定義 追加

```typescript
// src/lib/garden-corporations.ts に追加

// グループ HD 統合アイコン（6 法人花束、Chatwork / Bloom v9 / Forest 全体ビュー用）
export const GARDEN_GROUP_HD_ICON = '/themes/corporate-icons/hyuaran-group-hd.webp';

// または、GARDEN_CORPORATIONS と同じパターンで定数化
export const GARDEN_GROUP_HD_META = {
  icon: '/themes/corporate-icons/hyuaran-group-hd.webp',
  alt: 'ヒュアラングループ HD（6 法人花束統合アイコン）',
  usage: ['chatwork', 'bloom-home', 'forest-overview', 'payslip-header'] as const,
} as const;
```

### C-2. KK 案 spec §1-2 + §9 追記

```markdown
## §1-2 配置済アイコン（追記）

| # | アイコン | ファイル | 用途 |
|---|---|---|---|
| 7 | hyuaran-group-hd.webp | グループ HD 統合（6 法人花束）| Chatwork / Bloom v9 / Forest 全体ビュー / 給与明細書ヘッダー |

## §9 改訂履歴（追記）

- 2026-05-09 02:00: グループ HD 統合アイコン（hyuaran-group-hd.png）配置完了。a-bloom-005 で WebP 変換 + TypeScript 定義 + 用途定義
```

# 完走報告フォーマット

```
🟢 bloom-005-NN
【a-bloom-005 から a-main-015 への完走報告】
発信日時: HH:MM
件名: hyuaran-group-hd 追加組込完了

完了内容:
- A-2: hyuaran-group-hd.webp 配置（XX KB、圧縮率 -XX.X%）
- B-2: src/lib/garden-corporations.ts に GARDEN_GROUP_HD_META 追加
- C-2: KK 案 spec §1-2 + §9 追記

ローカル commit: NN 件追加（累積 N+1 件）
push: 5/9 09:00 JST 過ぎ解除後
```

# § 22-8 自律 token check（私からのリマインド）

bloom-005-1 で 35-40% 推定 → No. 2-4 で消費継続。**追加組込前に token 残量チェック推奨**。
- 50% 帯 = 通常モード継続 OK
- 60% 帯 = 引っ越し検討
- 70% 帯 = 即引っ越し（a-bloom-006 起動）

token 残量に余裕あれば本追加組込実施、不足なら 5/9 朝 引っ越し後の a-bloom-006 で実施でも OK。

# Vercel push 停止 整合
- 配置 / TS / spec 追記 = ローカル commit OK
- push: 5/9 09:00 JST 過ぎ解除 broadcast 後

# 緊急度
🟢 通常（軽量追加、bloom-005- No. 4 完走後の延長作業）

# 補足
本追加組込は a-bloom-005 でなくても OK（a-bloom-006 等の継承セッションでも継続可）。token 状況次第で柔軟に。
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 01:31
発信元: a-main-015
宛先: a-bloom-005
緊急度: 🟢 通常
