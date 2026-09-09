/**
 * トス／クローザー区分（営業部が毎月出す Excel）を Root 従業員マスタの役職に反映する
 * ============================================================
 * 作成: 2026-09-09
 *
 * 使い方:
 *   # 確認だけ（DB 変更なし）
 *   npx tsx --env-file=.env.local scripts/apply-toss-closer-roles.ts "<区分の JSON>"
 *   # 本実行
 *   npx tsx --env-file=.env.local scripts/apply-toss-closer-roles.ts "<区分の JSON>" --apply
 *
 * 区分の JSON: { "氏名（空白なし）": "closer" | "toss", ... }
 *   営業部の Excel（例 9月トス・クロザー区分.xlsx：A 列=氏名、B 列=区分）から Claude が変換して
 *   C:\Claude\000_Garden\040_Root_組織マスタ\toss_closer_YYYY-MM.json に置く
 * 動作:
 *   - 氏名（空白を除いた形）で root_employees を探し、区分に合わせて garden_role を closer／toss にする
 *   - 役職が manager／admin／super_admin の人（リーダー・責任者）は変えない（Excel にクローザーとあっても据え置き）
 *   - 変えた人は garden_role_manual=true にして、名簿同期で上書きされないようにする
 *   - JSON に無い人は触らない
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const KEEP_ROLES = new Set(["manager", "admin", "super_admin"]);

function normalizeName(value: unknown) {
  return String(value ?? "").replace(/[\s　]+/g, "");
}

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!file) throw new Error("区分の JSON のパスを指定してください");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  const wanted = new Map<string, "closer" | "toss">();
  for (const [rawName, kind] of Object.entries(parsed)) {
    const name = normalizeName(rawName);
    if (!name) continue;
    if (kind === "closer" || kind === "toss") wanted.set(name, kind);
  }
  console.log(`区分: クローザー ${[...wanted.values()].filter((v) => v === "closer").length} 人 / トス ${[...wanted.values()].filter((v) => v === "toss").length} 人`);

  const { data: employees, error } = await supabase
    .from("root_employees")
    .select("employee_id,employee_number,name,garden_role,garden_role_manual,is_active")
    .is("deleted_at", null);
  if (error) throw error;
  // 同名の履歴行（打刻 ID 無し＝R〜／無効）は対象外。同名が複数残る場合は判断せず飛ばす
  const byName = new Map<string, typeof employees>();
  for (const e of employees) {
    if (String(e.employee_number).startsWith("R") || !e.is_active) continue;
    const key = normalizeName(e.name);
    byName.set(key, [...(byName.get(key) ?? []), e]);
  }

  const changes: string[] = [];
  const missing: string[] = [];
  for (const [name, role] of wanted) {
    const candidates = byName.get(name) ?? [];
    if (candidates.length === 0) { missing.push(name); continue; }
    if (candidates.length > 1) { console.log(`  同名が複数のため飛ばす: ${name}（${candidates.map((c) => c.employee_number).join("/")}）`); continue; }
    const employee = candidates[0];
    if (KEEP_ROLES.has(String(employee.garden_role))) { console.log(`  据え置き: ${employee.name}（${employee.garden_role}）`); continue; }
    if (employee.garden_role === role && employee.garden_role_manual) continue;
    changes.push(`${employee.name}: ${employee.garden_role ?? "(なし)"} → ${role}`);
    if (apply) {
      const { error: updateError } = await supabase
        .from("root_employees")
        .update({ garden_role: role, garden_role_manual: true })
        .eq("employee_id", employee.employee_id);
      if (updateError) throw updateError;
    }
  }
  console.log(`${apply ? "更新" : "更新予定"} ${changes.length} 人`);
  for (const line of changes) console.log("  " + line);
  if (missing.length) console.log("Root に無い（未登録）:", missing.join("、"));
}

main().catch((error) => { console.error(error); process.exit(1); });
