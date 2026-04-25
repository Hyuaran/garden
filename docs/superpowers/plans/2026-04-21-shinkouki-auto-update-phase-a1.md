# 進行期データ自動更新 Phase A1 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 税理士から届く試算表 PDF を自動解析し、Supabase の `shinkouki` テーブルを更新する Python スクリプトを実装する（Phase A1）。

**Architecture:** 既存の `003_GardenForest_使用不可/update_shinkouki_v3.py` のPDF抽出ロジック（pdfplumber による表解析 + 会社名判定 + 損益計算書の主要数値抽出）をそのまま移植し、出力先のみ HTML 書き換え → Supabase UPDATE に差し替える。`.env.local` から Service Role Key を読み取る管理用スクリプトのため RLS をバイパスする。

**Tech Stack:** Python 3.10+ / pdfplumber / requests / python-dotenv

> **Note:** 当初 `supabase-py` 採用予定だったが、Python 3.14 で依存 `pyiceberg` のビルドに C++ Build Tools が必要なため、`requests` で Supabase REST API を直接叩く方式に変更済み（2026-04-22）。

**関連ドキュメント:**
- 設計書: `docs/superpowers/specs/2026-04-21-shinkouki-auto-update-design.md`
- 既存スクリプト: `G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/003_GardenForest_使用不可/update_shinkouki_v3.py`
- シードスクリプト（参考）: `scripts/seed-forest.ts`

---

## ファイル構成

**新規作成:**
- `scripts/update_shinkouki_supabase.py` — メインスクリプト
- `scripts/requirements.txt` — Python依存パッケージ
- `scripts/README-shinkouki.md` — 運用手順書（東海林さん向け）

**参照のみ（変更なし）:**
- `.env.local` — `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
- `G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/001_仕訳帳/D_税理士連携データ/*.pdf`

---

## 会社 ID マッピング（重要）

| PDFの会社名 | Supabase `companies.id` |
|---|---|
| ヒュアラン | `hyuaran` |
| センターライズ | `centerrise` |
| リンクサポート | `linksupport` |
| ＡＲＡＴＡ / ARATA | `arata` |
| たいよう | `taiyou` |
| 壱 | `ichi` |

---

## Task 1: Python 環境セットアップと依存パッケージ定義 ✅ **完了（2026-04-22, コミット `a18de6c`）**

**Files:**
- Create: `scripts/requirements.txt`

- [x] **Step 1: `scripts/requirements.txt` を作成**

```
pdfplumber>=0.11.0
requests>=2.31.0
python-dotenv>=1.0.0
```

- [x] **Step 2: 依存パッケージをインストール**

Run (PowerShell):
```powershell
cd C:\garden\b-main
pip install -r scripts\requirements.txt
```
Expected output: `Successfully installed pdfplumber-X.X.X requests-X.X.X python-dotenv-X.X.X`

- [x] **Step 3: インストール確認**

Run:
```powershell
python -c "import pdfplumber, requests, dotenv; print('OK')"
```
Expected output: `OK`

- [x] **Step 4: Commit**

```bash
git add scripts/requirements.txt
git commit -m "chore(forest): Python依存パッケージ requirements.txt を追加"
```

---

## Task 2: スクリプト骨組み + .env.local 読み込み

**Files:**
- Create: `scripts/update_shinkouki_supabase.py`

- [ ] **Step 1: 骨組みとヘッダーを作成**

```python
"""
Garden-Forest 進行期データ自動更新スクリプト (Supabase版)

D_税理士連携データのPDFから売上・外注費・利益を抽出し、
Supabase の shinkouki テーブルを UPDATE する。

使い方:
  # Dry-run（実際には書き込まず、抽出結果だけ表示）
  python scripts/update_shinkouki_supabase.py --dry-run

  # 本番実行
  python scripts/update_shinkouki_supabase.py

前提:
  - .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定済み
  - pip install -r scripts/requirements.txt 済み
"""

import argparse
import io
import os
import re
import sys
from pathlib import Path

import pdfplumber
import requests
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# ===== 設定 =====
PROJECT_ROOT = Path(__file__).parent.parent
ENV_PATH = PROJECT_ROOT / ".env.local"
PDF_DIR = Path(
    r"G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴"
    r"\001_仕訳帳\D_税理士連携データ"
)

# 法人名（PDF内テキスト） → Supabase companies.id
COMPANY_MAP = {
    "ヒュアラン": "hyuaran",
    "センターライズ": "centerrise",
    "リンクサポート": "linksupport",
    "ＡＲＡＴＡ": "arata",
    "ARATA": "arata",
    "たいよう": "taiyou",
    "壱": "ichi",
}


def load_env():
    """環境変数を .env.local から読み込む"""
    if not ENV_PATH.exists():
        print(f"❌ .env.local が見つかりません: {ENV_PATH}")
        sys.exit(1)
    load_dotenv(ENV_PATH)

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("❌ NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定")
        sys.exit(1)

    return url, key


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="DB書き込みをスキップ")
    args = parser.parse_args()

    print("=== Garden-Forest 進行期データ自動更新 ===\n")
    if args.dry_run:
        print("🔍 Dry-run モード（書き込みなし）\n")

    url, key = load_env()
    print(f"Supabase URL: {url}")
    print(f"PDF ディレクトリ: {PDF_DIR}")
    print()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 骨組みを実行して環境変数読み込みを確認**

Run:
```powershell
python scripts\update_shinkouki_supabase.py --dry-run
```
Expected output: `Supabase URL: https://hhazivjdfsybupwlepja.supabase.co` と PDF ディレクトリのパスが表示される

- [ ] **Step 3: Commit**

```bash
git add scripts/update_shinkouki_supabase.py
git commit -m "feat(forest): 進行期更新スクリプトの骨組みと環境変数読み込みを実装"
```

---

## Task 3: PDF 判定 & 抽出ロジックを v3 から移植

**Files:**
- Modify: `scripts/update_shinkouki_supabase.py`

- [ ] **Step 1: `is_financial_statement` 関数を追加**

`COMPANY_MAP` の下に追加：

```python
def is_financial_statement(pdf_path: Path) -> bool:
    """PDFが残高試算表 / 損益計算書 / 貸借対照表のどれかを先頭ページで判定"""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return False
            text = pdf.pages[0].extract_text() or ""
            t = re.sub(r"\s+", "", text)
            return ("残高試算表" in t) or ("損益計算書" in t) or ("貸借対照表" in t)
    except Exception as e:
        print(f"⚠️  判定失敗 {pdf_path.name}: {e}")
        return False
```

- [ ] **Step 2: テーブル抽出ロジック `extract_with_tables` を追加**

```python
def extract_with_tables(pdf_path: Path) -> dict:
    """PDFのテーブル抽出で損益計算書の主要数値を取得"""
    result = {
        "uriage": None,
        "gaichuhi": None,
        "rieki": None,
        "period": None,
        "company_id": None,
    }

    with pdfplumber.open(pdf_path) as pdf:
        full_text = ""
        all_tables = []
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
            all_tables.extend(page.extract_tables())

    # 会社名を特定
    for company_name, cid in COMPANY_MAP.items():
        if company_name in full_text:
            result["company_id"] = cid
            break

    # 対象期間を抽出（至 令和X年Y月）
    m = re.search(r"至\s*令和\s*(\d+)年\s*(\d+)月", full_text)
    if m:
        reiwa = int(m.group(1))
        month = int(m.group(2))
        result["period"] = f"{reiwa + 2018}/{month}"

    # 前期比較残高試算表かどうか判定
    text_no_space = full_text.replace(" ", "").replace("　", "")
    is_comparative = ("前期比較" in text_no_space) or (
        "前期比較" in pdf_path.name
    )

    def get_number(cell):
        if cell is None:
            return None
        s = str(cell).replace(",", "").replace(" ", "").strip()
        if not s:
            return None
        try:
            return int(s)
        except ValueError:
            try:
                f = float(s)
                if "." in s:
                    return None  # 構成比・対売上比はスキップ
                return int(f)
            except ValueError:
                return None

    def get_target_value(row, is_comp):
        ncols = len(row)
        if is_comp:
            # 前期比較: 当期金額 = index 4 (8列テーブル)
            if ncols >= 5:
                v = get_number(row[4])
                if v is not None:
                    return v
            if ncols >= 4:
                return get_number(row[-4])
        else:
            # 残高試算表: 期間残高 = index -2
            if ncols >= 3:
                v = get_number(row[-2])
                if v is not None:
                    return v
            if ncols > 5:
                return get_number(row[5])
        return None

    for table in all_tables:
        if not table:
            continue
        for row in table:
            if not row:
                continue
            row_text = "".join([str(c or "") for c in row])
            row_clean = row_text.replace(" ", "").replace("　", "")

            if "売上高合計" in row_clean:
                v = get_target_value(row, is_comparative)
                if v and v > 0:
                    result["uriage"] = v

            if "外注費" in row_clean and "営業外" not in row_clean:
                v = get_target_value(row, is_comparative)
                if v and v > 0:
                    result["gaichuhi"] = v

            if "当期純損益金額" in row_clean:
                v = get_target_value(row, is_comparative)
                if v is not None:
                    result["rieki"] = v

    return result
```

- [ ] **Step 3: テキストベースフォールバック `extract_pl_from_pdf` を追加**

```python
def extract_pl_from_pdf(pdf_path: Path) -> dict:
    """テキストベース抽出（テーブル抽出失敗時のフォールバック）"""
    result = {
        "uriage": None,
        "gaichuhi": None,
        "rieki": None,
        "period": None,
        "company_id": None,
    }

    with pdfplumber.open(pdf_path) as pdf:
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"

    for company_name, cid in COMPANY_MAP.items():
        if company_name in full_text:
            result["company_id"] = cid
            break

    m = re.search(r"至\s*令和\s*(\d+)年\s*(\d+)月", full_text)
    if m:
        result["period"] = f"{int(m.group(1)) + 2018}/{int(m.group(2))}"

    def extract_numbers(text: str):
        nums = re.findall(r"-?[\d,]+", text)
        candidates = []
        for n in nums:
            try:
                val = int(n.replace(",", ""))
                if abs(val) > 0:
                    candidates.append(val)
            except ValueError:
                pass
        return candidates

    for line in full_text.split("\n"):
        line_clean = re.sub(r"\s+", "", line)

        if "売上高合計" in line_clean:
            for n in extract_numbers(line):
                if n > 0:
                    result["uriage"] = n
                    break

        if "外注費" in line_clean and "営業外" not in line_clean:
            for n in extract_numbers(line):
                if n > 0 and (
                    result["gaichuhi"] is None or n > result["gaichuhi"]
                ):
                    result["gaichuhi"] = n

        if "当期純損益金額" in line_clean:
            nums = extract_numbers(line)
            if nums:
                result["rieki"] = nums[-1]

    return result
```

- [ ] **Step 4: フォーマットヘルパー `format_amount` を追加**

```python
def format_amount(value) -> str:
    """金額を表示用にフォーマット（None対応）"""
    if value is None:
        return "なし"
    return f"{value:,}"
```

- [ ] **Step 5: Commit**

```bash
git add scripts/update_shinkouki_supabase.py
git commit -m "feat(forest): PDF抽出ロジックをv3から移植（テーブル抽出+テキストフォールバック）"
```

---

## Task 4: PDF ループ処理の実装（抽出のみ、まだDB書き込みなし）

**Files:**
- Modify: `scripts/update_shinkouki_supabase.py`

- [ ] **Step 1: `process_pdfs` 関数を追加**

```python
def process_pdfs() -> dict[str, dict]:
    """PDFディレクトリを走査し、各社の抽出結果を返す

    Returns:
        {company_id: {"uriage": int, "gaichuhi": int, "rieki": int, "period": str}}
    """
    if not PDF_DIR.exists():
        print(f"❌ PDFディレクトリが見つかりません: {PDF_DIR}")
        return {}

    all_pdfs = [
        p for p in PDF_DIR.iterdir()
        if p.suffix.lower() == ".pdf" and p.is_file()
    ]
    target_pdfs = [p for p in all_pdfs if is_financial_statement(p)]

    if not target_pdfs:
        print("❌ 財務諸表PDFが見つかりませんでした")
        return {}

    print(f"対象PDF: {len(target_pdfs)}件 (全PDF {len(all_pdfs)}件中)\n")

    updates = {}

    for pdf_path in target_pdfs:
        print(f"📄 読み込み: {pdf_path.name}")
        data = extract_with_tables(pdf_path)

        if not data["company_id"]:
            print(f"  ⚠️  会社名を特定できませんでした。スキップ。\n")
            continue

        # テーブル抽出で売上も利益も取れなかった場合はテキスト抽出を試行
        if data["uriage"] is None and data["rieki"] is None:
            print(f"  (テーブル抽出失敗、テキスト抽出にフォールバック)")
            data2 = extract_pl_from_pdf(pdf_path)
            if data2["uriage"] is not None or data2["rieki"] is not None:
                data = data2

        print(f"  会社: {data['company_id']}")
        print(f"  期間: ~{data.get('period', '不明')}")
        print(f"  売上: {format_amount(data['uriage'])}")
        print(f"  外注: {format_amount(data['gaichuhi'])}")
        print(f"  利益: {format_amount(data['rieki'])}")

        # 売上・外注・利益のいずれかが取れていれば更新対象
        if (
            data["uriage"] is not None
            or data["gaichuhi"] is not None
            or data["rieki"] is not None
        ):
            updates[data["company_id"]] = data
        else:
            print(f"  ⚠️  数値が取れませんでした。スキップ。")
        print()

    return updates
```

- [ ] **Step 2: `main()` を書き換えて `process_pdfs()` を呼ぶ**

`main()` の既存内容を以下に置き換え：

```python
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="DB書き込みをスキップ")
    args = parser.parse_args()

    print("=== Garden-Forest 進行期データ自動更新 ===\n")
    if args.dry_run:
        print("🔍 Dry-run モード（書き込みなし）\n")

    url, key = load_env()
    print(f"Supabase URL: {url}")
    print(f"PDFディレクトリ: {PDF_DIR}\n")

    updates = process_pdfs()

    if not updates:
        print("更新対象がありませんでした")
        return

    print(f"=== 抽出結果サマリ: {len(updates)}社 ===")
    for cid, data in updates.items():
        print(f"  {cid}: 売上={format_amount(data['uriage'])} 外注={format_amount(data['gaichuhi'])} 利益={format_amount(data['rieki'])}")
    print()

    if args.dry_run:
        print("✅ Dry-run 完了（書き込みなし）")
        return

    # 次のTaskで Supabase UPDATE を実装
    print("⚠️  Supabase UPDATE は Task 5 で実装します")
```

- [ ] **Step 3: Dry-run で実行して全PDFの抽出が動くか確認**

Run:
```powershell
python scripts\update_shinkouki_supabase.py --dry-run
```
Expected output: 4つのPDFから `ヒュアラン / リンクサポート / たいよう / 壱` の抽出結果が表示される（センターライズ・ARATAは現状PDFなし）

- [ ] **Step 4: Commit**

```bash
git add scripts/update_shinkouki_supabase.py
git commit -m "feat(forest): PDF走査とループ処理を実装（抽出のみ、Supabase書き込みは次タスク）"
```

---

## Task 5: Supabase UPDATE 処理の実装

**Files:**
- Modify: `scripts/update_shinkouki_supabase.py`

- [ ] **Step 1: `update_supabase` 関数を追加**

`process_pdfs` の下に追加：

```python
def update_supabase(url: str, service_key: str, updates: dict[str, dict]) -> int:
    """Supabase の shinkouki テーブルを REST API 経由で UPDATE する

    Args:
        url: Supabase プロジェクト URL
        service_key: SUPABASE_SERVICE_ROLE_KEY
        updates: {company_id: {uriage, gaichuhi, rieki, period}}

    Returns:
        正常に更新された件数
    """
    endpoint = f"{url}/rest/v1/shinkouki"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    success_count = 0

    for cid, data in updates.items():
        # 更新ペイロードを構築
        payload = {}
        if data["uriage"] is not None:
            payload["uriage"] = data["uriage"]
        if data["gaichuhi"] is not None:
            payload["gaichuhi"] = data["gaichuhi"]
        if data["rieki"] is not None:
            payload["rieki"] = data["rieki"]

        # reflected（何月まで反映済みか）
        if data.get("period"):
            payload["reflected"] = f"{data['period']}まで反映中"

        # 暫定フラグ: スクリプトで自動反映 = 暫定扱い
        payload["zantei"] = True

        if not payload:
            print(f"  {cid}: 更新対象フィールドがありません。スキップ。")
            continue

        try:
            response = requests.patch(
                endpoint,
                headers=headers,
                params={"company_id": f"eq.{cid}"},
                json=payload,
                timeout=30,
            )

            if response.status_code >= 400:
                print(f"  ❌ {cid}: UPDATE 失敗 (HTTP {response.status_code}) - {response.text[:200]}")
                continue

            rows = response.json() if response.content else []
            if not rows:
                print(f"  ❌ {cid}: 該当行なし（shinkouki テーブルに未登録？）")
                continue

            success_count += 1
            fields = ", ".join(f"{k}={v}" for k, v in payload.items())
            print(f"  ✅ {cid}: {fields}")

        except requests.RequestException as e:
            print(f"  ❌ {cid}: リクエスト失敗 - {e}")

    return success_count
```

- [ ] **Step 2: `main()` の末尾を書き換えて UPDATE を呼ぶ**

`# 次のTaskで Supabase UPDATE を実装` の行と `print("⚠️  Supabase UPDATE は Task 5 で実装します")` を以下に置き換え：

```python
    print(f"=== Supabase UPDATE: {len(updates)}社 ===")
    success = update_supabase(url, key, updates)
    print(f"\n✅ 完了: {success}/{len(updates)} 件を更新しました")
```

- [ ] **Step 3: Dry-run で UPDATE のコードパスが実行されないことを確認**

Run:
```powershell
python scripts\update_shinkouki_supabase.py --dry-run
```
Expected output: `✅ Dry-run 完了（書き込みなし）` で終了。Supabase UPDATE のログは出ない

- [ ] **Step 4: 本番実行（1社分をテスト）**

Run:
```powershell
python scripts\update_shinkouki_supabase.py
```
Expected output: 抽出された各社に対して `✅ hyuaran: uriage=..., gaichuhi=..., ...` のログ、最後に `✅ 完了: N/N 件を更新しました`

- [ ] **Step 5: Supabase Dashboard で確認**

[Supabase Dashboard](https://supabase.com) → garden → Table Editor → shinkouki テーブルを開く。  
対象各社の `uriage`/`gaichuhi`/`rieki`/`reflected`/`zantei` が更新されていることを確認。

- [ ] **Step 6: Forest ダッシュボードで確認**

`https://garden-chi-ochre.vercel.app/forest` にアクセスしてログイン。  
進行期の数値が更新されていることを確認。

- [ ] **Step 7: Commit**

```bash
git add scripts/update_shinkouki_supabase.py
git commit -m "feat(forest): Supabase shinkouki UPDATE 処理を実装"
```

---

## Task 6: 運用手順書（README）の作成

**Files:**
- Create: `scripts/README-shinkouki.md`

- [ ] **Step 1: README を作成**

```markdown
# 進行期データ自動更新スクリプト（運用手順）

税理士から届く試算表 PDF から、Forest ダッシュボードの進行期データを自動更新する。

## 前提

- Python 3.10+ インストール済み
- プロジェクトルートの `.env.local` に Supabase 認証情報が設定済み
- 初回のみ: `pip install -r scripts/requirements.txt`

## 毎月の運用手順

### ステップ 1: PDFを所定のフォルダに置く

税理士から届いた試算表PDFを以下に配置:

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\001_仕訳帳\D_税理士連携データ\
```

ファイル名例: `ヒュアラン_202604101329連携_暫定_前期比較残高試算表(月次・期間)-17.pdf`

### ステップ 2: Dry-run で抽出結果を確認

PowerShell でプロジェクトルートに移動後:

```powershell
python scripts\update_shinkouki_supabase.py --dry-run
```

出力される売上・外注・利益の値が正しいか確認する。

### ステップ 3: 本番実行

確認後、`--dry-run` なしで実行:

```powershell
python scripts\update_shinkouki_supabase.py
```

### ステップ 4: ダッシュボードで確認

https://garden-chi-ochre.vercel.app/forest で更新されていることを確認。

## トラブルシューティング

### 「会社名を特定できませんでした」

→ PDF 内のテキストが `COMPANY_MAP` の会社名と一致していない。  
スクリプト内の `COMPANY_MAP` 辞書に該当の表記を追加する。

### 「数値が取れませんでした」

→ PDF のテーブル構造が想定と異なる可能性。手動で Supabase Table Editor から更新するか、Phase A3 の手動編集モーダル（実装予定）を使う。

### 「UPDATE 失敗」

→ `.env.local` の `SUPABASE_SERVICE_ROLE_KEY` が正しいか確認。  
→ Supabase Dashboard にログインできるか確認。

## 新規会社を追加したい場合

1. Supabase の `companies` / `shinkouki` テーブルに会社を追加
2. スクリプトの `COMPANY_MAP` に会社名とIDを追加
3. PDF を `D_税理士連携データ` に置いて実行
```

- [ ] **Step 2: Commit**

```bash
git add scripts/README-shinkouki.md
git commit -m "docs(forest): 進行期自動更新スクリプトの運用手順書を追加"
```

---

## Task 7: エンドツーエンド動作確認

- [ ] **Step 1: Supabase の shinkouki テーブルを初期状態に戻す（テスト用）**

Supabase SQL Editor で現在の shinkouki の値をバックアップ:

```sql
SELECT * FROM shinkouki;
```

結果をスクリーンショット or コピーで保存。

- [ ] **Step 2: Dry-run 実行**

```powershell
python scripts\update_shinkouki_supabase.py --dry-run
```

出力例を確認:
- 4 つの PDF が読み込まれる
- 各社の抽出値が表示される
- `✅ Dry-run 完了（書き込みなし）` で終了

- [ ] **Step 3: 本番実行**

```powershell
python scripts\update_shinkouki_supabase.py
```

- [ ] **Step 4: Supabase Table Editor で shinkouki を確認**

各社の `uriage` / `gaichuhi` / `rieki` / `reflected` / `zantei` がスクリプト出力と一致しているか確認。

- [ ] **Step 5: Forest ダッシュボードで確認**

https://garden-chi-ochre.vercel.app/forest → ログイン → 各社の進行期セルの数値が更新されていることを確認。  
`SummaryCards` の合計値も新しい値を反映していることを確認。

- [ ] **Step 6: 別の会社の PDF を追加してもう一度実行**

`D_税理士連携データ` にセンターライズやARATAのPDFも追加し、同じフローを繰り返して4社以上でも動作することを確認。

- [ ] **Step 7: 完了の日報記録**

Run:
```powershell
python "G:/マイドライブ/17_システム構築/07_Claude/01_東海林美琴/006_日報自動配信/send_report.py" add "Garden Forest Phase A1: 進行期自動更新スクリプト完成（税理士PDF→Supabase反映）"
```

---

## 自己レビュー

- ✅ 設計書の Phase A1 のスコープを完全にカバー
- ✅ 既存 v3 スクリプトの抽出ロジックを流用（pdfplumber、テーブル+テキストフォールバック）
- ✅ 環境変数読み込み → PDF走査 → 抽出 → UPDATE の流れが明確
- ✅ Dry-run モードでテスト可能
- ✅ エラーハンドリング（会社名特定失敗、UPDATE失敗、該当行なし）
- ✅ 運用手順書（README）で東海林さんが自分で使える
- ✅ 各ステップに具体的なコードとコマンドを明示

Phase A2（Web UI）と Phase A3（手動編集モーダル）は別の plan で実装する。
