import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/generate-zenkaku-dropdown-options.mts <fields234.json>");
const targetFields = ["TV申込","商材名区分1","商材名区分2","地デジ環境","工事種別","携帯キャリア","携帯端末タイプ","既契約回線タイプ","既契約継続有無","無線LANカード","無線利用方法","申込ISP","申込コード","申込プラン名","申込電話プラン名","第三者確認名_性別","第三者確認名_続柄","電話申込OP_FAXお知らせメール","電話申込OP_ナンバーリクエスト_NR","電話申込OP_発信者番号表示_ND","電話申込OP_着信お知らせメール","電話申込OP_自動転送_VW","電話申込OP_複数チャネル","電話申込OP_迷惑電話ブロック","電話申込OP_追加番号","電話申込OP_通話中着信通知_CH"] as const;
const snapshot = JSON.parse(readFileSync(resolve(source), "utf8")) as { properties: Record<string,{options?:Record<string,unknown>}> };
const options = Object.fromEntries(targetFields.map((field) => {
  const property = snapshot.properties[field];
  if (!property?.options) throw new Error(`Missing dropdown field: ${field}`);
  return [field, Object.keys(property.options)];
}));
const output = `// Generated from the app234 fields snapshot. Do not edit by hand.\n// Regenerate: npx tsx scripts/generate-zenkaku-dropdown-options.mts <fields234.json>\nexport const ZENKAKU_DROPDOWN_OPTIONS = ${JSON.stringify(options, null, 2)} as const;\n`;
writeFileSync(resolve("src/app/system/mypage/_lib/zenkaku-dropdown-options.generated.ts"), output, "utf8");
