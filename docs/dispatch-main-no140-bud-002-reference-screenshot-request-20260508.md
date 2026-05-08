# dispatch main- No. 140 — a-bud-002 へ Bud v2 参照スクショ配置依頼

発信日時: 2026-05-08(金) 14:55
発信元: a-main-015
宛先: a-bud-002（feature/bud-phase-d-implementation-002）
緊急度: 🟡 中（Garden UI 018 の ChatGPT 背景画像生成停滞解消のため、5/8 中に着手推奨）

---

## 件名

Bud v2 主要画面スクショの `_reference/garden-bud/` 配置依頼（claude.ai chat 共通参照画像庫）

## 背景

作業日報セッション（Garden UI 018）から report- No. 15 受領。claude.ai chat セッションが切り替わるたびに東海林さんが参考スクショを再アップロードする必要が発生 → 解決のため共通参照画像庫を G: ドライブ配下に新設しました。

配置先（新設済み）:
```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bud\
```

運用ルール: 同 `_reference/README.md` を参照（a-main-015 起草、5/8 14:55）。

## 依頼内容

**a-bud-002 が Bud v2 の主要画面スクショを取得して `_reference/garden-bud/` に配置**してください。

### 取得対象（優先度 A = 即必要）

| # | 画面 | ファイル名 | 用途 |
|---|---|---|---|
| 1 | 損益管理タブ（PL）| `bud-v2-pl-screenshot.png` | ChatGPT 背景画像生成の世界観統一参考、Forest v2 視覚比較 |

### 取得対象（優先度 B = あれば便利）

| # | 画面 | ファイル名 |
|---|---|---|
| 2 | 給与管理タブ | `bud-v2-payroll-screenshot.png` |
| 3 | 振込明細タブ | `bud-v2-transfer-screenshot.png` |
| 4 | 経費入力タブ | `bud-v2-expense-screenshot.png` |
| 5 | ホーム / ダッシュボード | `bud-v2-home-screenshot.png` |

優先度 A だけで一旦 OK。残り B は手が空いたタイミングで追加配置を推奨。

## 取得手順（推奨）

1. `feature/bud-phase-d-implementation-002` ブランチで dev server 起動（`npm run dev`）
2. ブラウザで Bud v2 損益管理画面に遷移
3. **Chrome MCP** または **Windows Snipping Tool** で全画面スクショ取得
4. 命名規則に従って配置:
   ```
   G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\_chat_workspace\_reference\garden-bud\bud-v2-pl-screenshot.png
   ```
5. `_reference/README.md` を一読（命名規則 / 書き込み権限 / アーカイブルール）
6. 完走報告（bud-002- No. 23）で a-main-015 へ「配置完了」報告

## 注意点

- **既存 v1 スクショがあれば削除禁止** → `_reference/garden-bud/_archive_202605/` に退避（memory `feedback_no_delete_keep_legacy.md` 準拠）
- 命名規則は `<module>-<version>-<screen>-screenshot.<ext>`
- アイコン素材（SVG）も将来配置予定なので、PNG 以外の素材があれば一緒に配置 OK
- スクショサイズは目安 1920x1080 〜 2560x1440（Retina 相当の高解像度推奨）

## 期待効果

- 東海林さん作業: 0 回（再アップロード不要）
- claude.ai chat: read_file_content で直接参照可能
- セッション間の整合性向上（古いスクショ参照ミスがなくなる）

## 完走報告フォーマット

```
🟢 bud-002- No. 23
【a-bud-002 から a-main-015 への完走報告】
発信日時: 2026-05-08(金) HH:MM

# 件名
Bud v2 参照スクショ配置完了（_reference/garden-bud/）

# 配置内容
- bud-v2-pl-screenshot.png (Mxxxx KB)
- (B 系で追加配置したら列挙)

# 次の作業
（Phase E spec 起草 / merge 戦略 等、main- No. 136 で指示済の続き）
```

## dispatch counter

a-main-015 dispatch-counter: 140 → **141 へ +1**（本 No. 140）

---

## 関連 dispatch / report

- report- No. 15（作業日報セッション → a-main-014、5/8 起源）
- main- No. 136（a-bud-002 Phase D 100% 完了 + Phase E + merge 戦略 GO、未投下）
- main- No. 141（a-bloom-004 へ Bloom アイコン + v2.8a スクショ依頼、後続起草中）
- main- No. 142（Garden UI 018 へ Forest v1 移動依頼 + report- No. 15 受領返答、後続起草中）
