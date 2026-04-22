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
