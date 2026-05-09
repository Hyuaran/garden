# dispatch 標準テンプレ集（v5、2026-05-09 確定）

> a-main セッションが dispatch 起草時に必ず参照するテンプレファイル
> memory `feedback_dispatch_header_format` v5 に準拠

---

## 1. 単一 dispatch（東海林さんへの提示形式）

```
🚨 dispatch 発行 🚨 緊急度: 🟡 中

投下先: claude.ai chat「Garden UI 021」
ファイル: [dispatch-main-noNNN-...md](docs/dispatch-main-noNNN-...md)
別途添付必要データ: なし / あり（あり時はフルパス記載）
  - mock 画像: G:\マイドライブ\...\tab-N-*.png

🟡 main- No. NNN
【a-main-NNN から 宛先 への dispatch（件名）】
発信日時: YYYY-MM-DD(曜) HH:MM

→ 投下完了したら「NNN投下済」で OK
```

## 2. PowerShell 利用 dispatch（東海林さんがコピペ実行）

```
🚨🚨🚨 PowerShell 利用 dispatch 注意 🚨🚨🚨 緊急度: 🔴 高

実行コマンド: ...
影響範囲: [破壊的かどうか / 本番影響かどうか]
ファイル参照: [...](docs/...)
事前確認: [...]

→ 実行完了したら「実行済」で OK
```

## 3. 複数 dispatch 同時発行（ガンガン投下時、漏れ防止）

```
🚨 dispatch 発行 (N 件、順不同で OK) 🚨

# 1 / 緊急度: 🟡
投下先: a-bud-002
ファイル: [dispatch-main-noNNN-...md](docs/dispatch-main-noNNN-...md)
別途添付: なし

# 2 / 緊急度: 🟢
投下先: a-forest-002
ファイル: [dispatch-main-noNNN-...md](docs/dispatch-main-noNNN-...md)
別途添付: あり（参照パス: ...）

# 3 / 緊急度: 🔴
投下先: a-leaf-002
ファイル: [dispatch-main-noNNN-...md](docs/dispatch-main-noNNN-...md)
別途添付: なし

→ 投下完了は各番号で「NNN投下済」を順次返信、OK
```

## 4. 確認系（東海林さんに判断仰ぎ）

```
📋 確認 📋 緊急度: 🟡 中

論点: ...
現状: ...
選択肢:
| 案 | 内容 | 推奨 |
|---|---|---|
| A | ... | 🟢 |
| B | ... | — |

→ 案 A / B どちらで GO ですか？
```

---

## md ファイル本体（dispatch ファイル内部）

```markdown
# dispatch main- No. NNN — 件名

> 起草: a-main-NNN
> 用途: ...
> 番号: main- No. NNN
> 起草時刻: YYYY-MM-DD(曜) HH:MM

---

## 投下用短文（東海林さんがコピー → 投下先にペースト）

~~~
🟡 main- No. NNN
【a-main-NNN から 宛先 への dispatch（件名）】
発信日時: YYYY-MM-DD(曜) HH:MM

# 件名
...

# 添付画像（東海林さんがアップロード時に使用）

| 用途 | フルパス | 必須 |
|---|---|---|
| mock 画像 | G:\... | 必須 |

# 内容
...
~~~

---

## 詳細（参考、投下対象外）
...

## self-check
- [ ] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [ ] ~~~ ラップ
- [ ] 添付画像フルパス記載（必要時）
- [ ] 既存実装把握済（議論前 / 修正前 / 外部依頼前）
- [ ] 厳守事項リスト化
```

---

## 起草前 self-check（私 = a-main 用）

| # | チェック | 確認 |
|---|---|---|
| 1 | dispatch counter 確認した | `cat docs/dispatch-counter.txt` |
| 2 | 同じ宛先への直近 dispatch 重複していない | `ls docs/dispatch-main-no*<宛先>*` |
| 3 | 添付画像 ls で存在確認した | memory `feedback_file_existence_check_before_ok` |
| 4 | 既存実装把握した（外部依頼前トリガー）| memory `feedback_check_existing_impl_before_discussion` |
| 5 | 緊急度マーク（🟢🟡🔴）付与した | memory `feedback_powershell_emoji_signaling` |
| 6 | dispatch 完了後、counter +1 した | `echo "NNN+1" > docs/dispatch-counter.txt` |
| 7 | dispatch-status.md に投下予定として記録 | `docs/dispatch-status.md` |

---

## 改訂履歴

- 2026-05-09 18:30 初版（a-main-017、東海林さんテンプレ採用 v5）
