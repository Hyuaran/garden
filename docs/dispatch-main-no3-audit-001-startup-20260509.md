# ⚠️ このファイルは破棄

dispatch counter リセット違反のため、本ファイル（main- No. 3 と表記）は破棄。

## 正規番号への移動

| 旧（破棄） | 新（正規） |
|---|---|
| main- No. 3 | main- No. 204 |
| docs/dispatch-main-no3-audit-001-startup-20260509.md | docs/dispatch-main-no204-audit-001-startup-20260510.md |

## 破棄理由

017 期最終 counter = 203（a-main 系統共通の連番）から継続すべきところ、020 期で 1 から再採番してしまった違反。020 で worktree pull 同期済みの dispatch-counter.txt 値（203）を見落とし、独自カウントを開始した。

## 再発防止

- dispatch 起草前に必ず `cat docs/dispatch-counter.txt` で現在 counter 確認
- scripts/dispatch-record.ps1 を使えば counter 自動 +1 + status.md 自動更新

## 破棄日時

2026-05-10
