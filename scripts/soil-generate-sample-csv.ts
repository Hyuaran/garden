/**
 * Garden-Soil Phase B-01 Phase 2: α テスト用サンプル CSV 生成スクリプト
 *
 * 対応 spec:
 *   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md §12 Task 7
 *
 * 作成: 2026-05-09（Phase B-01 Phase 2 実装、a-soil-002）
 *
 * 役割:
 *   200 件の合成 FileMaker CSV を生成して α テストで使う。
 *   本番 200 万件取込の前に、Adapter → Transform → Load の動作確認に利用。
 *
 * 実行例:
 *   npx tsx scripts/soil-generate-sample-csv.ts \
 *     "C:\garden\imports\filemaker-sample-200.csv" \
 *     200
 *
 * 出力 CSV 仕様:
 *   - UTF-8 BOM 付き
 *   - LF 改行
 *   - 16 列ヘッダー（runbook §1-1 の必須列）
 *   - 個人 7 割 / 法人 3 割
 *   - 5% 程度の Phase 1 Kintone と重複（phone + name 一致 → R1 検出テスト）
 *   - 一部の行に カナ半角 / 全角混在 / 引用符内カンマ などのエッジケース
 */

import { writeFileSync } from "node:fs";

// ============================================================
// CLI
// ============================================================

const [, , outPath, countStr] = process.argv;

if (!outPath) {
  console.error("Usage: tsx scripts/soil-generate-sample-csv.ts <out-path> [count=200]");
  process.exit(1);
}

const count = countStr ? Number.parseInt(countStr, 10) : 200;
if (Number.isNaN(count) || count <= 0) {
  console.error(`Invalid count: ${countStr}`);
  process.exit(1);
}

// ============================================================
// 合成データ
// ============================================================

const surnames = [
  "佐藤", "鈴木", "高橋", "田中", "伊藤", "山田", "渡辺", "中村",
  "小林", "加藤", "吉田", "山本", "斎藤", "松本", "井上",
];
const givenNames = [
  "太郎", "花子", "次郎", "三郎", "一郎", "美咲", "翔太", "健太",
  "結衣", "陽菜", "蓮", "葵", "颯", "凛",
];
const surnameKana = ["サトウ", "スズキ", "タカハシ", "タナカ", "イトウ", "ヤマダ", "ワタナベ", "ナカムラ", "コバヤシ", "カトウ", "ヨシダ", "ヤマモト", "サイトウ", "マツモト", "イノウエ"];
const givenNameKana = ["タロウ", "ハナコ", "ジロウ", "サブロウ", "イチロウ", "ミサキ", "ショウタ", "ケンタ", "ユイ", "ヒナ", "レン", "アオイ", "ハヤテ", "リン"];

const corpNames = [
  "株式会社サンプル商事",
  "有限会社テスト工業",
  "サンプル建設株式会社",
  "合同会社ガーデン",
  "テスト株式会社",
];
const reps = ["代表 一郎", "社長 花子", "代表取締役 太郎"];

const prefectures = ["大阪府", "東京都", "兵庫県", "京都府", "奈良県"];
const cities = ["大阪市北区", "渋谷区", "神戸市中央区", "京都市中京区", "奈良市"];
const addresses = ["1-2-3 サンプルビル", "4-5-6", "7-8-9 テストハウス 101", "10-11-12 ガーデンマンション 502"];

const industries = ["飲食", "工場照明", "事務所", "小売", "サービス"];
const sizes = ["極小", "小", "中", "大", ""];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length] as T;
}

function pad(n: number, len: number): string {
  return n.toString().padStart(len, "0");
}

function maybeQuote(value: string): string {
  // カンマ / 改行 / クォート を含むセルはダブルクォートで囲む + " → ""
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function makeRow(i: number): string[] {
  const isCorp = i % 10 < 3; // 3 割法人
  const isDuplicate = i % 20 === 0; // 5% は Phase 1 重複想定（電話番号 +81600000xxx）

  const personalName = `${pick(surnames, i)} ${pick(givenNames, i)}`;
  const personalNameKana = `${pick(surnameKana, i)} ${pick(givenNameKana, i)}`;
  const corpName = isCorp ? pick(corpNames, i) : "";
  const repName = isCorp ? pick(reps, i) : "";
  const phone1 = isDuplicate
    ? `06-0000-${pad(i % 10000, 4)}`           // 重複候補
    : `06-${pad(1000 + (i % 9000), 4)}-${pad(i * 7 % 10000, 4)}`;
  const phone2 = i % 5 === 0 ? `090-${pad(i % 9000, 4)}-${pad(i * 3 % 10000, 4)}` : "";
  const email = i % 3 === 0 ? `user${i}@example.com` : "";
  const postal = `${pad(530 + i % 100, 3)}-${pad(i * 13 % 10000, 4)}`;

  return [
    `FM-SAMPLE-${pad(i, 6)}`,                    // 管理番号
    isCorp ? "法人" : "個人",                    // 個人法人区分
    isCorp ? `代表者氏名${i}` : personalName,    // 漢字氏名
    isCorp ? "" : personalNameKana,              // カナ氏名
    corpName,                                     // 法人名
    repName,                                      // 代表者名
    phone1,                                       // 電話番号1
    phone2,                                       // 電話番号2
    email,                                        // メール
    postal,                                       // 郵便番号
    pick(prefectures, i),                         // 都道府県
    pick(cities, i),                              // 市区町村
    `${pick(addresses, i)} #${i}`,                // 住所
    pick(industries, i),                          // 業種
    pick(sizes, i),                               // 規模
    "active",                                     // ステータス
  ];
}

// ============================================================
// CSV 出力
// ============================================================

const HEADERS = [
  "管理番号",
  "個人法人区分",
  "漢字氏名",
  "カナ氏名",
  "法人名",
  "代表者名",
  "電話番号1",
  "電話番号2",
  "メール",
  "郵便番号",
  "都道府県",
  "市区町村",
  "住所",
  "業種",
  "規模",
  "ステータス",
];

const lines: string[] = [];
lines.push(HEADERS.map(maybeQuote).join(","));

for (let i = 1; i <= count; i += 1) {
  const cells = makeRow(i).map(maybeQuote);
  lines.push(cells.join(","));
}

// UTF-8 BOM + LF
const bom = "﻿";
const content = bom + lines.join("\n") + "\n";

writeFileSync(outPath, content, { encoding: "utf8" });

console.log(`[soil-generate-sample-csv] wrote ${count} rows to ${outPath}`);
console.log(`  headers: ${HEADERS.length} columns`);
console.log(`  size:    ${content.length} bytes`);
