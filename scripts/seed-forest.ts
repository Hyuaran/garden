/**
 * Garden-Forest データシード
 *
 * 使い方: npx tsx --env-file=.env.local scripts/seed-forest.ts
 *
 * 前提: .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定済み
 * (シードスクリプトのみ service role key を使用。RLS をバイパスしてデータ投入。)
 */

import { createClient } from "@supabase/supabase-js";

// Node.js 21+ の built-in env ローダーを使用。
// 実行コマンド: npx tsx --env-file=.env.local scripts/seed-forest.ts

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // シードのみ service role
);

const COMPANIES = [
  { id: "hyuaran",     name: "株式会社ヒュアラン",       short: "ヒュアラン",     kessan: "3月",  color: "#1b4332", light: "#d8f3dc", sort_order: 1 },
  { id: "centerrise",  name: "株式会社センターライズ",   short: "センターライズ", kessan: "8月",  color: "#2d6a4f", light: "#b7e4c7", sort_order: 2 },
  { id: "linksupport", name: "株式会社リンクサポート",   short: "リンクサポート", kessan: "5月",  color: "#40916c", light: "#a7d7c5", sort_order: 3 },
  { id: "arata",       name: "株式会社ARATA",            short: "ARATA",          kessan: "11月", color: "#52b788", light: "#c9e4d8", sort_order: 4 },
  { id: "taiyou",      name: "株式会社たいよう",         short: "たいよう",       kessan: "12月", color: "#74c69d", light: "#dff0e8", sort_order: 5 },
  { id: "ichi",        name: "株式会社壱",               short: "壱",             kessan: "5月",  color: "#95d5b2", light: "#eaf5ef", sort_order: 6 },
];

const PERIODS = [
  // ヒュアラン (9期)
  { company_id:"hyuaran", ki:1, yr:2016, period_from:"2016/4", period_to:"2017/3", uriage:45906697, gaichuhi:12176569, rieki:707272, junshisan:1684772, genkin:500000, yokin:7045348, doc_url:"https://drive.google.com/file/d/1I9UqEnoETQ8uWDCHJ_z7Xt94fPyXh9sw/view?usp=sharing" },
  { company_id:"hyuaran", ki:2, yr:2017, period_from:"2017/4", period_to:"2018/3", uriage:117541916, gaichuhi:8963075, rieki:9405445, junshisan:8618417, genkin:500000, yokin:9762231, doc_url:"https://drive.google.com/file/d/1u_ddQSFYVViGsKtINhcFpN6DhUShGusr/view?usp=sharing" },
  { company_id:"hyuaran", ki:3, yr:2018, period_from:"2018/4", period_to:"2019/3", uriage:133819149, gaichuhi:14807180, rieki:5271432, junshisan:13352168, genkin:500000, yokin:18376794, doc_url:"https://drive.google.com/file/d/1tLTlu_SkhC_JxBB8Zr0g2KuLPV7fArX1/view?usp=sharing" },
  { company_id:"hyuaran", ki:4, yr:2019, period_from:"2019/4", period_to:"2020/3", uriage:125138223, gaichuhi:24864497, rieki:338212, junshisan:13655345, genkin:500000, yokin:35471843, doc_url:"https://drive.google.com/file/d/1M4_N9WShhYUKxWiZUYgdRGDD_sPnvUQt/view?usp=sharing" },
  { company_id:"hyuaran", ki:5, yr:2020, period_from:"2020/4", period_to:"2021/3", uriage:87076897, gaichuhi:24715024, rieki:382449, junshisan:13720346, genkin:5476089, yokin:14714314, doc_url:"https://drive.google.com/file/d/1javs55bgemlDSUV00UZDKhPOalsAjZji/view?usp=sharing" },
  { company_id:"hyuaran", ki:6, yr:2021, period_from:"2021/4", period_to:"2022/3", uriage:101415578, gaichuhi:45185096, rieki:5749658, junshisan:17433246, genkin:37039743, yokin:13424026, doc_url:"https://drive.google.com/file/d/13YBeZDwLm6sOlqhi5VVQl3yFduJwEf2G/view?usp=sharing" },
  { company_id:"hyuaran", ki:7, yr:2022, period_from:"2022/4", period_to:"2023/3", uriage:157756628, gaichuhi:91999026, rieki:2103275, junshisan:18906103, genkin:33986133, yokin:22623262, doc_url:"https://drive.google.com/file/d/13ZCkfbLBPswryXDviNdtIwxLQwctyIzx/view?usp=sharing" },
  { company_id:"hyuaran", ki:8, yr:2023, period_from:"2023/4", period_to:"2024/3", uriage:177303516, gaichuhi:129293964, rieki:909265, junshisan:21296760, genkin:35373275, yokin:12648586, doc_url:"https://drive.google.com/file/d/13l42COtU80bbLHHIPxSsvU_Ao93XIMSn/view?usp=sharing" },
  { company_id:"hyuaran", ki:9, yr:2024, period_from:"2024/4", period_to:"2025/3", uriage:293735522, gaichuhi:244600902, rieki:7448717, junshisan:26954180, genkin:35847580, yokin:34811142, doc_url:"https://drive.google.com/file/d/18J0Ss4KhCF1tpeu4I7IP7tyLVJqvE5Do/view?usp=sharing" },
  // センターライズ (7期)
  { company_id:"centerrise", ki:1, yr:2018, period_from:"2018/10", period_to:"2019/8", uriage:7426934, gaichuhi:0, rieki:1629718, junshisan:1256018, genkin:0, yokin:1610291, doc_url:"https://drive.google.com/file/d/14ot4XMlnZgPA2Q7dlybMCzt5a9GfwzYr/view?usp=sharing" },
  { company_id:"centerrise", ki:2, yr:2019, period_from:"2019/9", period_to:"2020/8", uriage:73439749, gaichuhi:18415880, rieki:417205, junshisan:1404202, genkin:0, yokin:15528613, doc_url:"https://drive.google.com/file/d/15Ms1T3qtVmIKdo0cXx1R3qcj66yoRfvl/view?usp=sharing" },
  { company_id:"centerrise", ki:3, yr:2020, period_from:"2020/9", period_to:"2021/8", uriage:8109060, gaichuhi:859664, rieki:-3872379, junshisan:-2538183, genkin:3600, yokin:5642614, doc_url:"https://drive.google.com/file/d/1m3Y984ixzEPkASzBUQ23Ajy3ewB4VxkF/view?usp=sharing" },
  { company_id:"centerrise", ki:4, yr:2021, period_from:"2021/9", period_to:"2022/8", uriage:6679625, gaichuhi:828203, rieki:2821294, junshisan:213101, genkin:2326525, yokin:6144832, doc_url:"https://drive.google.com/file/d/13Mm6fiRyRb4c45mLBWfo8yiZKV-cXvl7/view?usp=sharing" },
  { company_id:"centerrise", ki:5, yr:2022, period_from:"2022/9", period_to:"2023/8", uriage:12688948, gaichuhi:900000, rieki:404299, junshisan:547395, genkin:2506525, yokin:5282968, doc_url:"https://drive.google.com/file/d/13Ol6TPHoEW0YS9ptYtULP8-qo0FkCknL/view?usp=sharing" },
  { company_id:"centerrise", ki:6, yr:2023, period_from:"2023/9", period_to:"2024/8", uriage:57285262, gaichuhi:23172765, rieki:7005393, junshisan:6247357, genkin:2578355, yokin:12405530, doc_url:"https://drive.google.com/file/d/13StmiL8K9HRchQ_nIohKbuDVsEvutC54/view?usp=sharing" },
  { company_id:"centerrise", ki:7, yr:2024, period_from:"2024/9", period_to:"2025/8", uriage:73750112, gaichuhi:null, rieki:8124803, junshisan:12781187, genkin:2768834, yokin:17497734, doc_url:"https://drive.google.com/file/d/1MDSNHL4B3J55v9VTKr6uIPnOUm77SKJx/view?usp=sharing" },
  // リンクサポート (5期)
  { company_id:"linksupport", ki:1, yr:2020, period_from:"2020/6", period_to:"2021/5", uriage:43097849, gaichuhi:3863214, rieki:7963128, junshisan:6118715, genkin:534800, yokin:7836522, doc_url:"https://drive.google.com/file/d/1fop9vI_CzGJuSsvtWrRgcYUySPnLtyfI/view?usp=sharing" },
  { company_id:"linksupport", ki:2, yr:2021, period_from:"2021/6", period_to:"2022/5", uriage:33112686, gaichuhi:3285465, rieki:423665, junshisan:6472368, genkin:2064869, yokin:6448113, doc_url:"https://drive.google.com/file/d/14JnN3YmQiyIZHVf0nXrkGZqKUcbzMY0-/view?usp=sharing" },
  { company_id:"linksupport", ki:3, yr:2022, period_from:"2022/6", period_to:"2023/5", uriage:50816076, gaichuhi:7823588, rieki:564797, junshisan:6853854, genkin:2767352, yokin:17890297, doc_url:"https://drive.google.com/file/d/14RhOCKTdfvoGF5PviZ6ALuzdN5RYk-3e/view?usp=sharing" },
  { company_id:"linksupport", ki:4, yr:2023, period_from:"2023/6", period_to:"2024/5", uriage:61142862, gaichuhi:14742504, rieki:2477108, junshisan:9330962, genkin:2329895, yokin:8395755, doc_url:"https://drive.google.com/file/d/14PUItJRku0Y4x2pwlw9J7B1YsN7s84wH/view?usp=sharing" },
  { company_id:"linksupport", ki:5, yr:2024, period_from:"2024/6", period_to:"2025/5", uriage:94417468, gaichuhi:19269304, rieki:7990774, junshisan:15721031, genkin:899792, yokin:27339036, doc_url:"https://drive.google.com/file/d/1yGLXX6Yr7Uw8VBO3Gi2TgvFHc-F699PA/view?usp=sharing" },
  // ARATA (5期)
  { company_id:"arata", ki:1, yr:2019, period_from:"2019/12", period_to:"2020/11", uriage:0, gaichuhi:0, rieki:0, junshisan:0, genkin:999500, yokin:930171, doc_url:"https://drive.google.com/file/d/16CoEouEM_sM3-RBO-ByPHe8ipxDlCp72/view?usp=sharing" },
  { company_id:"arata", ki:2, yr:2020, period_from:"2020/12", period_to:"2021/11", uriage:0, gaichuhi:0, rieki:0, junshisan:0, genkin:375908, yokin:37439756, doc_url:"https://drive.google.com/file/d/13y-fsKwpc6UV4rDx-0LszzJHEYm8l92_/view?usp=sharing" },
  { company_id:"arata", ki:3, yr:2021, period_from:"2021/12", period_to:"2022/11", uriage:75418244, gaichuhi:0, rieki:3057743, junshisan:11238698, genkin:376054, yokin:12287490, doc_url:"https://drive.google.com/file/d/147hrdoUFYLJCEd1d1CUzNPUGI5DizHXN/view?usp=sharing" },
  { company_id:"arata", ki:4, yr:2022, period_from:"2022/12", period_to:"2023/11", uriage:103724100, gaichuhi:1674382, rieki:3350764, junshisan:14023048, genkin:466754, yokin:11430997, doc_url:"https://drive.google.com/file/d/13nIP7ql0HqMdWhucjkV_Siu6--TODWgT/view?usp=sharing" },
  { company_id:"arata", ki:5, yr:2023, period_from:"2023/12", period_to:"2024/11", uriage:87757027, gaichuhi:6755505, rieki:5932133, junshisan:16606358, genkin:452333, yokin:17551824, doc_url:"https://drive.google.com/file/d/1DOSyEfQ9RK5xcaDVg8dE7ROpjm8tjiWQ/view?usp=sharing" },
  // たいよう (4期)
  { company_id:"taiyou", ki:1, yr:2021, period_from:"2021/1", period_to:"2021/12", uriage:0, gaichuhi:0, rieki:-64100, junshisan:935900, genkin:1000000, yokin:1000, doc_url:"https://drive.google.com/file/d/14ZtPvTTJ3y9_IpIbMn7WKQFNbnPEVYMx/view?usp=sharing" },
  { company_id:"taiyou", ki:2, yr:2022, period_from:"2022/1", period_to:"2022/12", uriage:0, gaichuhi:0, rieki:-134100, junshisan:865900, genkin:1000000, yokin:1000, doc_url:"https://drive.google.com/file/d/14ZtPvTTJ3y9_IpIbMn7WKQFNbnPEVYMx/view?usp=sharing" },
  { company_id:"taiyou", ki:3, yr:2023, period_from:"2023/1", period_to:"2023/12", uriage:358107, gaichuhi:0, rieki:-202557, junshisan:797443, genkin:1000000, yokin:88313, doc_url:"https://drive.google.com/file/d/14ZtPvTTJ3y9_IpIbMn7WKQFNbnPEVYMx/view?usp=sharing" },
  { company_id:"taiyou", ki:4, yr:2024, period_from:"2024/1", period_to:"2024/12", uriage:13707960, gaichuhi:1246553, rieki:7862678, junshisan:6734977, genkin:653056, yokin:6679946, doc_url:"https://drive.google.com/file/d/1IXXpy4Tf0_L43zZ17A7twiU82GUBcNe0/view?usp=sharing" },
  // 壱 (0期 — periods は空)
];

const SHINKOUKI = [
  { company_id:"hyuaran",     ki:10, yr:2025, label:"第10期", range:"2025/4~2026/3",  reflected:"2026/3まで反映中", zantei:true,  uriage:190797587, gaichuhi:124932774, rieki:6444667 },
  { company_id:"centerrise",  ki:8,  yr:2025, label:"第8期",  range:"2025/9~2026/8",  reflected:"未反映",           zantei:false, uriage:null,      gaichuhi:null,      rieki:null },
  { company_id:"linksupport", ki:6,  yr:2025, label:"第6期",  range:"2025/6~2026/5",  reflected:"2026/2まで反映中", zantei:true,  uriage:88354820,  gaichuhi:9865325,   rieki:27174964 },
  { company_id:"arata",       ki:6,  yr:2024, label:"第6期",  range:"2024/12~2025/11", reflected:"未反映",           zantei:false, uriage:null,      gaichuhi:null,      rieki:null },
  { company_id:"taiyou",      ki:6,  yr:2026, label:"第6期",  range:"2026/1~2026/12",  reflected:"2026/3まで反映中", zantei:true,  uriage:6844086,   gaichuhi:4850326,   rieki:1603024 },
  { company_id:"ichi",        ki:1,  yr:2025, label:"第1期",  range:"2025/6~2026/5",   reflected:"2026/4まで反映中", zantei:true,  uriage:null,      gaichuhi:null,      rieki:-112635 },
];

async function seed() {
  console.log("Seeding companies...");
  const { error: compErr } = await supabase.from("companies").upsert(COMPANIES, { onConflict: "id" });
  if (compErr) throw compErr;
  console.log(`  ${COMPANIES.length} companies upserted.`);

  console.log("Seeding fiscal_periods...");
  const { error: periodErr } = await supabase.from("fiscal_periods").upsert(PERIODS, { onConflict: "company_id,ki" });
  if (periodErr) throw periodErr;
  console.log(`  ${PERIODS.length} periods upserted.`);

  console.log("Seeding shinkouki...");
  const { error: skErr } = await supabase.from("shinkouki").upsert(SHINKOUKI, { onConflict: "company_id" });
  if (skErr) throw skErr;
  console.log(`  ${SHINKOUKI.length} shinkouki upserted.`);

  console.log("\nDone!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
