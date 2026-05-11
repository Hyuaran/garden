# dispatch main- No. 141 — a-bloom-004 へ Bloom 法人アイコン + v2.8a スクショ配置依頼

> 起草: a-main-015
> 用途: a-bloom-004 への Bloom 法人アイコン集 + v2.8a 主要画面スクショ配置依頼
> 番号: main- No. 141
> 起草時刻: 2026-05-08(金) 14:55

---

## 投下用短文（東海林さんが a-bloom-004 にコピペ）

~~~
🟡 main- No. 141
【a-main-015 から a-bloom-004 への dispatch】
発信日時: 2026-05-08(金) 14:55

# 件名
Bloom 法人アイコン集 + v2.8a 主要画面スクショの `_reference/garden-bloom/` 配置依頼

# 背景
作業日報セッション（Garden UI 018）から report- No. 15 受領。claude.ai chat 共通参照画像庫を G: ドライブ配下に新設済み。

配置先:
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bloom\

# 依頼内容（優先度 A = 即必要）

## A-1. Bloom 法人アイコン集（6 法人分）
サブフォルダ: _reference/garden-bloom/bloom-corporate-icons/

| 法人 | ファイル名 |
|---|---|
| ヒュアラン | hyuaran.svg または .png |
| センターライズ | centerrise.svg |
| リンクサポート | linksupport.svg |
| ARATA | arata.svg |
| たいよう | taiyou.svg |
| 壱 | ichi.svg |

取得方法:
- 既存実装に SVG/PNG があれば抽出（src/app/bloom 配下を Grep / Glob で検索）
- 不在なら ChatGPT 生成可否を判断保留として a-main-015 へ上げる

用途: Forest v2 で法人 6 色置き換え（各法人アイコン + 法人カラー方針確定）

## A-2. Bloom v2.8a ホームページスクショ
- bloom-v2.8a-homepage-screenshot.png（タイル UI 全体）

# 依頼内容（優先度 B = あれば便利）
- bloom-v2.8a-workboard-screenshot.png
- bloom-v2.8a-monthly-digest-screenshot.png
- bloom-v2.8a-progress-screenshot.png
- bloom-v2.8a-daily-report-screenshot.png

# 取得手順
1. A-1: src/app/bloom 配下を hyuaran|centerrise|linksupport|ARATA|taiyou|壱 で grep
2. SVG/PNG が見つかった場合 → cp で配置
3. 見つからなかった場合 → 完走報告に判断保留として記載
4. A-2: dev server 起動（or Vercel URL 利用）→ Chrome MCP / Snipping Tool でスクショ
5. _reference/README.md を一読
6. 完走報告（bloom-004- No. 58）で a-main-015 へ報告

# 注意点
- 既存 v1/v2.7 等のスクショは削除禁止 → _archive_202605/ に退避
- 法人アイコンが既存 SVG で見つからない場合は無理に PNG 化せず判断保留として上げる
- スクショは Bloom 認証通過後の画面で（dev mode で BloomGate バイパス OK、project_bloom_auth_independence.md 準拠）

# 並行 main- No. 139 との関係
本依頼は main- No. 139（DD/EE/FF プラン GO）と並行進行 OK。アイコン抽出は 30 分目安。

# 完走報告フォーマット
🟢 bloom-004- No. 58
【a-bloom-004 から a-main-015 への完走報告】
発信日時: 2026-05-08(金) HH:MM
件名: Bloom 法人アイコン + v2.8a スクショ配置完了 / 部分完了 / 判断保留
配置内容 + 判断保留 を記載
~~~

---

## 詳細（参考）

発信日時: 2026-05-08(金) 14:55
発信元: a-main-015
宛先: a-bloom-004（feature/bloom-6screens-vercel-2026-05 系 / 該当作業ブランチ）
緊急度: 🟡 中（Garden UI 018 の Forest v2 法人 6 色置き換え用、5/8 中に着手推奨）

---

## 件名

Bloom 法人アイコン集 + v2.8a 主要画面スクショの `_reference/garden-bloom/` 配置依頼

## 背景

作業日報セッション（Garden UI 018）から report- No. 15 受領。claude.ai chat 共通参照画像庫を G: ドライブ配下に新設済み。

配置先:
```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bloom\
```

運用ルール: 同 `_reference/README.md` を参照（a-main-015 起草、5/8 14:55）。

## 依頼内容

**a-bloom-004 が以下を `_reference/garden-bloom/` に配置**してください。

### 取得対象（優先度 A = 即必要）

#### A-1. Bloom 法人アイコン集（6 法人分）

サブフォルダ: `_reference/garden-bloom/bloom-corporate-icons/`

| # | 法人 | ファイル名 |
|---|---|---|
| 1 | ヒュアラン | `hyuaran.svg`（or `.png`）|
| 2 | センターライズ | `centerrise.svg` |
| 3 | リンクサポート | `linksupport.svg` |
| 4 | ARATA | `arata.svg` |
| 5 | たいよう | `taiyou.svg` |
| 6 | 壱 | `ichi.svg` |

**取得方法**:
- 既存実装に SVG / PNG があれば抽出して配置（src/app/bloom 配下を `Grep` または `Glob` で検索）
- 不在なら ChatGPT 生成依頼の素案を判断保留として a-main-015 へ上げる（生成は東海林さん判断後）

**用途**: Forest v2 で法人 6 色置き換え（各法人アイコン + 法人カラー方針確定）

#### A-2. Bloom v2.8a ホームページスクショ

| # | 画面 | ファイル名 |
|---|---|---|
| 1 | ホームページ（タイル UI 全体）| `bloom-v2.8a-homepage-screenshot.png` |

### 取得対象（優先度 B = あれば便利）

| # | 画面 | ファイル名 |
|---|---|---|
| 2 | Workboard 画面 | `bloom-v2.8a-workboard-screenshot.png` |
| 3 | 月次ダイジェスト | `bloom-v2.8a-monthly-digest-screenshot.png` |
| 4 | 進捗管理（progress） | `bloom-v2.8a-progress-screenshot.png` |
| 5 | 日報 | `bloom-v2.8a-daily-report-screenshot.png` |

A だけで一旦 OK、残り B は手が空いたら。

## 取得手順（推奨）

### A-1（法人アイコン）の流れ

1. `Grep` で `src/app/bloom` 配下を `hyuaran|centerrise|linksupport|ARATA|taiyou|壱` 等の法人名で検索
2. SVG / PNG 素材があれば該当パスを記録
3. **見つかった場合**: `cp` で `_reference/garden-bloom/bloom-corporate-icons/` に配置（命名規則 `<法人名英>.svg`）
4. **見つからなかった場合**: 完走報告に「不在 → ChatGPT 生成依頼が必要」と判断保留として記載 → a-main-015 がボール返答

### A-2（v2.8a スクショ）の流れ

1. dev server 起動（`npm run dev`）または既デプロイ Vercel URL 利用（`https://garden-chi-ochre.vercel.app/bloom/...`）
2. Chrome MCP / Snipping Tool でホームページスクショ取得
3. 配置:
   ```
   G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bloom\bloom-v2.8a-homepage-screenshot.png
   ```
4. `_reference/README.md` 一読
5. 完走報告（bloom-004- No. 58）で a-main-015 へ「配置完了」報告

## 注意点

- **既存 v1 / v2.7 等のスクショがあれば削除禁止** → `_archive_202605/` に退避
- 命名規則は `<module>-<version>-<screen>-screenshot.<ext>`
- 法人アイコンが既存 SVG で見つからない場合は **無理に PNG 化せず** judgment 保留として上げる（ChatGPT で世界観統一生成のほうが整合性高いため）
- スクショは Bloom 認証通過後の画面で（dev mode で BloomGate バイパスでもよい、§memory `project_bloom_auth_independence.md` 準拠）

## 完走報告フォーマット

```
🟢 bloom-004- No. 58
【a-bloom-004 から a-main-015 への完走報告】
発信日時: 2026-05-08(金) HH:MM

# 件名
Bloom 法人アイコン + v2.8a スクショ配置完了 / 部分完了 / 判断保留

# 配置内容
- bloom-corporate-icons/hyuaran.svg
- ...
- bloom-v2.8a-homepage-screenshot.png (Mxxxx KB)

# 判断保留（あれば）
- 法人アイコン: 既存実装で発見できず → ChatGPT 生成可否を東海林さん判断要

# 次の作業
（main- No. 139 の DD/EE/FF プラン続行）
```

## dispatch counter

a-main-015 dispatch-counter: 141 → **142 へ +1**（本 No. 141）

---

## 関連 dispatch / report

- report- No. 15（作業日報セッション → a-main-014、5/8 起源）
- main- No. 139（a-bloom-004 vitest 解消 + DD/EE/FF GO、未投下）
- main- No. 140（a-bud-002 へ Bud v2 スクショ依頼、起草済）
- main- No. 142（Garden UI 018 へ Forest v1 移動依頼 + report- No. 15 受領返答、後続起草中）
