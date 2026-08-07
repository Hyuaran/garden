/**
 * Toss partner account issuer.
 *
 * CSV columns: partner_code,partner_name
 * Dry-run: npx tsx --env-file=.env.local scripts/seed-toss-partners.ts --file=partners.csv
 * Apply:   npx tsx --env-file=.env.local scripts/seed-toss-partners.ts --file=partners.csv --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { normalizePartnerCode, toTossEmail } from "../src/app/toss/_lib/identity";

type PartnerInput = { partnerCode: string; partnerName: string };

function inputFile(): string {
  const value = process.argv.find((arg) => arg.startsWith("--file="))?.slice("--file=".length);
  if (!value) throw new Error("--file=partners.csv を指定してください");
  return resolve(value);
}

function readPartners(path: string): PartnerInput[] {
  const lines = readFileSync(path, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const dataLines = lines[0]?.toLowerCase().includes("partner_code") ? lines.slice(1) : lines;
  return dataLines.map((line, index) => {
    const comma = line.indexOf(",");
    if (comma < 0) throw new Error(`CSV ${index + 2}行目: カンマ区切りではありません`);
    return {
      partnerCode: normalizePartnerCode(line.slice(0, comma)),
      partnerName: line.slice(comma + 1).trim(),
    };
  }).map((partner) => {
    if (!partner.partnerName) throw new Error(`${partner.partnerCode}: 氏名が空です`);
    return partner;
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const partners = readPartners(inputFile());
  console.log(`Toss partner accounts: ${apply ? "APPLY" : "DRY-RUN"} / ${partners.length}件`);

  for (const partner of partners) {
    console.log(`${partner.partnerCode} ${partner.partnerName} / ${toTossEmail(partner.partnerCode)} / initial password: gd${partner.partnerCode}`);
  }
  if (!apply) {
    console.log("DBは変更していません。実行する場合は --apply を付けてください。");
    return;
  }

  const admin = getSupabaseAdmin();
  for (const partner of partners) {
    const email = toTossEmail(partner.partnerCode);
    const password = `gd${partner.partnerCode}`;
    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      console.error(`${partner.partnerCode}: Auth検索失敗: ${listError.message}`);
      continue;
    }
    const existing = listed.users.find((user) => user.email === email);
    let userId = existing?.id;
    let createdNew = false;
    if (existing) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { partner_code: partner.partnerCode, partner_name: partner.partnerName },
      });
      if (updateError) {
        console.error(`${partner.partnerCode}: Auth更新失敗: ${updateError.message}`);
        continue;
      }
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { partner_code: partner.partnerCode, partner_name: partner.partnerName },
      });
      if (createError || !created.user) {
        console.error(`${partner.partnerCode}: Auth作成失敗: ${createError?.message ?? "user missing"}`);
        continue;
      }
      userId = created.user.id;
      createdNew = true;
    }
    if (!userId) continue;
    const { error: upsertError } = await admin.from("toss_partners").upsert({
      partner_code: partner.partnerCode,
      partner_name: partner.partnerName,
      user_id: userId,
      email,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "partner_code" });
    if (upsertError) {
      if (createdNew) await admin.auth.admin.deleteUser(userId);
      console.error(`${partner.partnerCode}: プロフィール保存失敗${createdNew ? "（Authをロールバック）" : ""}: ${upsertError.message}`);
      continue;
    }
    console.log(`${partner.partnerCode}: ${createdNew ? "作成" : "更新"}完了`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
