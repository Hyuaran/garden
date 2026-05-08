# main- No. 46 dispatch - claude.ai 作業日報セッションへの質問（Bloom v29 / icon_work / progress_ring 保存場所） - 2026-05-05

> 起草: a-main-012
> 用途: report- No. 5 で報告された v29 preview HTML / icon_work バッジ / progress_ring 11 枚 の保存場所を確認
> 番号: main- No. 46
> 起草時刻: 2026-05-05(火) 18:18
> 緊急度: 🔴 5/8 デモ必須（/bloom/progress 取り込み準備のための素材確認）

---

## 投下用短文（東海林さんが claude.ai 作業日報セッションにコピペ）

~~~
🔴 main- No. 46
【a-main-012 から claude.ai 作業日報セッションへの 質問（Bloom v29 / icon_work / progress_ring 保存場所）】
発信日時: 2026-05-05(火) 18:18

report- No. 5（Bloom v29 完成報告）受領しました。a-main-012 が Garden プロジェクトの /bloom/progress に取り込むため、3 件の素材保存場所をご確認お願いします。

【質問 1】v29 preview HTML

仕様書記載 path:
- `_chat_workspace\chat-ui-bloom-dev-progress-v3-preview-20260505-v29.html`

a-main-012 で確認した結果、この path にファイルが見つかりません。代わりに発見したのは:
- `_chat_workspace\garden-bloom\chat-ui-bloom-dev-progress-v3-20260504.html`（5/4 付 v3）
- `_chat_workspace\garden-bloom\v3.html`

質問:
- v29 preview HTML は別 path に保存されていますか？
- Drive sync 中で a-main-012 側にまだ届いていない可能性？
- 上記 v3 (5/4) を v29 として扱って良いですか（v3 = v29 が同義）？

【質問 2】icon_work バッジ（勤務形態 3 区分）

仕様書記載:
- `_chat_workspace\icon_work_office.png`
- `_chat_workspace\icon_work_home.png`
- `_chat_workspace\icon_work_irregular.png`

a-main-012 で確認したところ、_chat_workspace 配下に icon_work_*.png が見当たりません。

質問:
- 別 path（garden-bloom 配下等）にありますか？
- それとも未保存？保存予定？

【質問 3】progress_ring 11 枚

仕様書記載:
- `images/decor/progress_ring_000.png` 〜 `progress_ring_100.png`（11 枚）
- 「既存配置済み」と記載

質問:
- これは Garden プロジェクト側（src/app/bloom/<どこか>/images/decor/）の path？
- それとも Drive 上の `_chat_workspace\` 配下？正確なパスを教えてください。
- a-main-012 が Garden プロジェクト（C:\garden\a-bloom-003\）内を再 grep して確認すべき場所のヒントもいただけると助かります。

【質問 4】その他、取り込みに必要な追加素材

v29 完成版で使用された CSS / JS / 画像 / フォント等で、上記 1〜3 以外に Garden プロジェクトへ持ち込むべきファイルがあれば、リストアップお願いします。

【今後の流れ】

ご回答受領後、a-main-012 → a-bloom-003 への dispatch（main- No. 47 or 後続）として:
- 素材を Garden プロジェクトへ配置
- /bloom/progress として React 実装 or HTML iframe 配置（実装方式は東海林さんと別途相談）
- 5/8 デモまでに動作確認

の段取りで進めます。

【dispatch counter】

a-main-012: 次 main- No. 47

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 18:18 初版（a-main-012、report- No. 5 受領後、_chat_workspace の v29 / icon_work 不在を検出）
