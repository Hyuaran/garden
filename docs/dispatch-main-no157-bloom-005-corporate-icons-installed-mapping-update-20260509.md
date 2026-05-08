# dispatch main- No. 157 — a-bloom-005 へ 6 法人アイコン配置完了 + 組込指示 + マッピング更新

> 起草: a-main-015
> 用途: a-bloom-005 への 6 法人アイコン配置完了通知 + WebP 変換 / TypeScript 定義 / Forest 連携準備指示
> 番号: main- No. 157
> 起草時刻: 2026-05-09(土) 01:17

---

## 投下用短文（東海林さんが a-bloom-005 にコピペ）

~~~
🟢 main- No. 157
【a-main-015 から a-bloom-005 への dispatch（6 法人アイコン配置完了 + 組込指示 + マッピング更新）】
発信日時: 2026-05-09(土) 01:17

# 件名
6 法人アイコン 配置完了 🏆 + 東海林さん新マッピング採用 + 組込指示（WebP 変換 / TypeScript 定義 / Forest 連携 準備）

# 完了内容（東海林さん作業 + a-main-015 確認）

## 配置済 6 法人アイコン + グループ HD 統合アイコン
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bloom\bloom-corporate-icons\
- hyuaran.png（ピンク）1.5M
- centerrise.png（紫）1.6M
- linksupport.png（青）1.6M
- arata.png（橙）1.6M
- taiyou.png（黄）1.5M
- ichi.png（赤）1.7M
- overview-6corporations.png（一覧、cp 配置）2.3M
- ChatGPT Image 2026年5月9日 01_14_04 (6).png（原本、削除禁止）2.3M
- **hyuaran-group-hd.png（6 法人花束統合アイコン、グループ HD 用、Chatwork 等のアイコン用）**（5/9 02:00 頃配置）

# ⚠️ 重要: 東海林さん新マッピング採用（KK 案 spec §1-2 から変更）

| # | 法人 | 旧マッピング（KK 案 spec §1-2）| **新マッピング（東海林さん確定、本 dispatch 採用）**|
|---|---|---|---|
| 1 | ヒュアラン | 緑系（樹冠）| **ピンク（薄桃〜淡桜）**|
| 2 | センターライズ | 青系（水流）| **紫（藤色〜菫色）**|
| 3 | リンクサポート | 黄系（蜂蜜）| **青（群青〜空色）**|
| 4 | ARATA | 紫系（蕾）| **橙（朱橙〜山吹）**|
| 5 | たいよう | 橙系（太陽）| **黄（山吹〜蜂蜜色）**|
| 6 | 壱 | 朱赤系（漢字）| **赤（朱赤〜緋色）**|

シンボルも 6 法人共通「**アネモネ + ガラス玉円輪フレーム + 黒紫花芯 + 細裂葉**」に統一（A 案採用、12 モジュール未使用花）。

# a-main-015 視覚確認結果（評価合格 ✅）

| 軸 | 状態 |
|---|---|
| 6 色完全 distinct | ✅ 被りなし |
| 連作整合性 | ✅ 同じ画家・同じ筆致・同じガラス玉フレーム・同じ花芯・同じ細裂葉 |
| 12 モジュール整合 | ✅ 蓮 / 蕾 / 双葉 と並べて統一感 |
| 透明背景 PNG | ✅ 1024x1024 |
| 視認性 | ✅ 全色 distinct（白同化問題解消、ピンクで視認性確保）|
| ボタニカル水彩 + ピーターラビット世界観 | ✅ 完璧 |

# 依頼内容（a-bloom-005 で組込）

## A. PNG → WebP 変換（quality 90）

```
cwebp -q 90 hyuaran.png -o hyuaran.webp
cwebp -q 90 centerrise.png -o centerrise.webp
cwebp -q 90 linksupport.png -o linksupport.webp
cwebp -q 90 arata.png -o arata.webp
cwebp -q 90 taiyou.png -o taiyou.webp
cwebp -q 90 ichi.png -o ichi.webp
cwebp -q 90 hyuaran-group-hd.png -o hyuaran-group-hd.webp
```

配置先:
```
C:\garden\a-bloom-005\public\themes\corporate-icons\
├─ hyuaran.webp
├─ centerrise.webp
├─ linksupport.webp
├─ arata.webp
├─ taiyou.webp
├─ ichi.webp
└─ hyuaran-group-hd.webp（6 法人花束統合、グループ HD 用）
```

注: 元 PNG は削除禁止（feedback_no_delete_keep_legacy 準拠）、_reference 配下は永続保管。

## B. TypeScript 定義追加

```typescript
// src/lib/garden-corporations.ts
export const GARDEN_CORPORATIONS = [
  {
    id: 'hyuaran',
    name: '株式会社ヒュアラン',
    icon: '/themes/corporate-icons/hyuaran.webp',
    color: '#F4A6BD',  // ピンク（薄桃〜淡桜）
    role: 'グループ HD・人材',
  },
  {
    id: 'centerrise',
    name: '株式会社センターライズ',
    icon: '/themes/corporate-icons/centerrise.webp',
    color: '#8E7CC3',  // 紫（藤色〜菫色）
    role: 'コールセンター運営',
  },
  {
    id: 'linksupport',
    name: '株式会社リンクサポート',
    icon: '/themes/corporate-icons/linksupport.webp',
    color: '#4A6FA5',  // 青（群青〜空色）
    role: '業務支援・連携',
  },
  {
    id: 'arata',
    name: '株式会社 ARATA',
    icon: '/themes/corporate-icons/arata.webp',
    color: '#E8743C',  // 橙（朱橙〜山吹）
    role: '新規事業',
  },
  {
    id: 'taiyou',
    name: '株式会社たいよう',
    icon: '/themes/corporate-icons/taiyou.webp',
    color: '#F9C846',  // 黄（山吹〜蜂蜜色）
    role: 'エネルギー・関電業務委託',
  },
  {
    id: 'ichi',
    name: '株式会社壱',
    icon: '/themes/corporate-icons/ichi.webp',
    color: '#C0392B',  // 赤（朱赤〜緋色）
    role: '第一・基幹',
  },
] as const;

export type CorporationId = (typeof GARDEN_CORPORATIONS)[number]['id'];

// グループ HD 統合アイコン（6 法人花束、Chatwork / Bloom v9 / Forest 全体ビュー用）
export const GARDEN_GROUP_HD_ICON = '/themes/corporate-icons/hyuaran-group-hd.webp';
```

## B-2. グループ HD 統合アイコンの用途

| 用途 | 配置場所 | 備考 |
|---|---|---|
| Chatwork グループアイコン | Chatwork UI（東海林さん設定）| 外部 SaaS、Drive PNG 直接 UP |
| Bloom v9 unified ホーム グループ HD 表示 | `src/app/page.tsx` 等 | 6 法人切替 default state |
| Forest dashboard グループ全体ビュー | Forest dashboard 上部 | 6 法人横断指標表示時 |
| 給与明細書ヘッダー（グループ全体扱い）| `src/app/bud/payroll/...` PDF | 印刷用は PNG fallback |

## C. KK 案 spec §1-2 + §2 の更新

ファイル: docs/specs/2026-05-08-bloom-corporate-icons-chatgpt-prompt.md

更新内容:
- §1-2 表の「色テーマ（暫定）」を新マッピング（ピンク/紫/青/橙/黄/赤）に変更
- §2 ChatGPT 投下用プロンプト の「シンボルとカラー」セクションを「アネモネ + ガラス玉 + 6 色 variations」に書き換え（過去履歴は spec §X 改訂履歴に記録）
- §改訂履歴に「2026-05-09 01:17 東海林さん新マッピング採用 + アネモネ A 案採用」追記

## D. Forest 連携準備（別 dispatch 起票推奨、a-bloom-005 で起草）

Forest 側 src/lib/forest-fetcher.ts mock を GARDEN_CORPORATIONS 経由参照に切替する仕様 spec を起票。
ファイル名: docs/specs/2026-05-09-forest-corporations-mock-migration.md
内容:
- mock の「株式会社ヒュアラン」「ヒュアラングループ HD」を GARDEN_CORPORATIONS.find(c => c.id === 'hyuaran') 経由参照
- 6 法人すべて GARDEN_CORPORATIONS 参照に統一
- カラーテーマも本 dispatch §B の color 値を流用

実装は別途 a-forest-002 dispatch で起票（5/13 統合テスト前推奨）。

# Vercel push 停止 整合（main- No. 148）

- ✅ 配置作業: G ドライブ書き込みのみ = 影響なし、即実施完了
- ✅ A 〜 C 作業: ローカル commit OK（push なし）
- ✅ D 作業: spec 起草のみ = ローカル commit OK
- ⏳ push: 5/9 09:00 JST 過ぎ解除 broadcast 後に一括 push

# 完走報告フォーマット

```
🟢 bloom-005-NN
【a-bloom-005 から a-main-015 への完走報告】
発信日時: 2026-05-09(土) HH:MM
件名: 6 法人アイコン組込完了（A: WebP 変換 / B: TypeScript 定義 / C: spec 更新 / D: Forest 連携 spec 起票）

完了内容:
- A: 6 webp 配置（quality 90、サイズ XX KB / each）
- B: src/lib/garden-corporations.ts 新規（XX 行）
- C: KK 案 spec 更新（行追加 / 削除）
- D: Forest 連携 spec 起票（docs/specs/2026-05-09-forest-corporations-mock-migration.md、XX 行）

ローカル commit: NN 件
push: 5/9 09:00 JST 過ぎ解除後
```

# 緊急度
🟢 通常（5/14-16 後道さんデモ前重要素材、5/9 中の組込推奨）

# 補足: ChatGPT セッション内 6 法人 1 セッション完走

東海林さんが ChatGPT 同セッション内で 6 枚一気生成完了。連作整合性が完璧（同じ画家による連作）= ChatGPT 投下プロンプト戦略の成功事例。

今後の Garden Series 関連画像生成（背景 / アイコン / 装飾等）も「**1 セッション内連続生成**」が黄金パターン。
~~~

---

## 詳細（参考）

発信日時: 2026-05-09(土) 01:17
発信元: a-main-015
宛先: a-bloom-005
緊急度: 🟢 通常
