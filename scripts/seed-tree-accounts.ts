/**
 * Garden-Tree 初期アカウント発行スクリプト
 * ============================================================
 * 作成: 2026-04-21
 *
 * 使い方:
 *   # 実行内容を確認（DB変更なし）
 *   npx tsx --env-file=.env.local scripts/seed-tree-accounts.ts
 *
 *   # 本実行（DB変更あり）
 *   npx tsx --env-file=.env.local scripts/seed-tree-accounts.ts --apply
 *
 * 前提:
 *   - .env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が設定済
 *   - scripts/root-auth-schema.sql と scripts/root-rls-employees.sql が
 *     Supabase に適用済み（user_id / garden_role / birthday カラム存在）
 *   - scripts/root-schema.sql が適用済み（root_employees 等の基本テーブル）
 *   - 法人マスタ COMP-001（ヒュアラン等）が存在する
 *
 * 動作:
 *   各社員について以下を idempotent（何度実行しても同じ結果）に実行：
 *     1. auth.users に emp{4桁}@garden.internal を作成 or 既存取得
 *     2. パスワード = 誕生日MMDD で設定（既存ユーザーは既存パスワード維持）
 *     3. root_employees に UPSERT（user_id / garden_role / birthday）
 *
 * 注意:
 *   このスクリプトは service_role_key を使用するため
 *   絶対に公開リポジトリやフロントエンドで実行しないこと。
 *   .env.local は .gitignore 済。
 *
 * 関連ドキュメント:
 *   docs/superpowers/specs/2026-04-21-tree-supabase-integration-design.md
 */

import { createClient } from "@supabase/supabase-js";

// ============================================================
// 型定義
// ============================================================

type GardenRole = "toss" | "closer" | "cs" | "staff" | "manager" | "admin" | "super_admin";

type SeedEmployee = {
  employee_number: string;  // 4桁 e.g. "0004"
  name: string;
  name_kana: string;
  birthday: string;         // YYYY-MM-DD
  garden_role: GardenRole;
  company_id: string;       // COMP-001 など
  employment_type: string;  // "正社員" | "アルバイト" | "業務委託"
  /** 既に Supabase Auth にユーザーがある場合 true（パスワードを変更しない） */
  existing?: boolean;
};

// ============================================================
// 登録データ（11名・2026-04-21 東海林さん確定）
// ============================================================

const EMPLOYEES: SeedEmployee[] = [
  // --------------------------------------------------------
  // 既存 Supabase Auth ユーザー（Forest 用に発行済）
  // Auth の password は変更しない。root_employees への紐付けのみ。
  // --------------------------------------------------------
  {
    employee_number: "0000",
    name: "後道",
    name_kana: "ウシロミチ",
    birthday: "1900-01-01",   // 不明のためプレースホルダ（後で本人更新）
    garden_role: "admin",
    company_id: "COMP-001",
    employment_type: "正社員",
    existing: true,
  },
  {
    employee_number: "0008",
    name: "東海林 美琴",
    name_kana: "ショウジ ミコト",
    birthday: "1900-01-01",   // 同上
    garden_role: "super_admin",
    company_id: "COMP-001",
    employment_type: "正社員",
    existing: true,
  },

  // --------------------------------------------------------
  // 新規発行（正社員9名）
  // --------------------------------------------------------
  {
    employee_number: "0004",
    name: "上田 基人",
    name_kana: "ウエダ モトヒト",
    birthday: "1989-12-19",
    garden_role: "admin",
    company_id: "COMP-001",
    employment_type: "正社員",
  },
  {
    employee_number: "0009",
    name: "萩尾 拓也",
    name_kana: "ハギオ タクヤ",
    birthday: "1978-10-19",
    garden_role: "staff",
    company_id: "COMP-001",
    employment_type: "正社員",
  },
  {
    employee_number: "1165",
    name: "宮永 ひかり",
    name_kana: "ミヤナガ ヒカリ",
    birthday: "1999-02-02",
    garden_role: "manager",
    company_id: "COMP-001",
    employment_type: "正社員",
  },
  {
    employee_number: "1324",
    name: "三好 理央",
    name_kana: "ミヨシ リオ",
    birthday: "1998-04-18",
    garden_role: "staff",
    company_id: "COMP-001",
    employment_type: "正社員",
  },
  {
    employee_number: "1326",
    name: "小泉 翔",
    name_kana: "コイズミ ショウ",
    birthday: "1996-11-26",
    garden_role: "manager",
    company_id: "COMP-001",
    employment_type: "正社員",
  },
  {
    employee_number: "1331",
    name: "辻 舞由子",
    name_kana: "ツジ マユコ",
    birthday: "2005-03-25",
    garden_role: "staff",
    company_id: "COMP-001",
    employment_type: "正社員",
  },
  {
    employee_number: "1480",
    name: "簡 棣榮",
    name_kana: "カン テイエイ",
    birthday: "1994-11-20",
    garden_role: "staff",
    company_id: "COMP-001",
    employment_type: "正社員",
  },
  {
    employee_number: "1508",
    name: "桐井 大輔",
    name_kana: "キリイ ダイスケ",
    birthday: "1974-11-08",
    garden_role: "staff",
    company_id: "COMP-001",
    employment_type: "正社員",
  },
  {
    employee_number: "1523",
    name: "石原 孝志朗",
    name_kana: "イシハラ コウシロウ",
    birthday: "2003-03-26",
    garden_role: "staff",
    company_id: "COMP-001",
    employment_type: "正社員",
  },

  // --------------------------------------------------------
  // 次回バッチで登録予定（参考・コメントアウト）
  // 田中 実花 / 南薗 優樹 / 森 健登 → garden_role: "cs"
  // その他アルバイト → garden_role: "toss" / "closer"
  // --------------------------------------------------------
];

// ============================================================
// ヘルパー関数
// ============================================================

/** 社員番号 → 擬似メール */
function toEmail(empNum: string): string {
  return `emp${empNum.padStart(4, "0")}@garden.internal`;
}

/** YYYY-MM-DD → MMDD（初期パスワード用） */
function toInitialPassword(birthday: string): string {
  const [, m, d] = birthday.split("-");
  return `${m}${d}`;
}

/** employee_id を生成（4桁社員番号 → EMP-{社員番号}） */
function toEmployeeId(empNum: string): string {
  return `EMP-${empNum.padStart(4, "0")}`;
}

// ============================================================
// メイン
// ============================================================

async function main() {
  const applyMode = process.argv.includes("--apply");
  const mode = applyMode ? "APPLY" : "DRY-RUN";

  console.log("");
  console.log("╔════════════════════════════════════════════╗");
  console.log(`║  Garden-Tree アカウント発行 (${mode.padEnd(8)})  ║`);
  console.log("╚════════════════════════════════════════════╝");
  console.log("");
  console.log(`  対象: ${EMPLOYEES.length}名`);
  console.log(`  内訳: super_admin=${EMPLOYEES.filter((e) => e.garden_role === "super_admin").length}`);
  console.log(`        admin=${EMPLOYEES.filter((e) => e.garden_role === "admin").length}`);
  console.log(`        manager=${EMPLOYEES.filter((e) => e.garden_role === "manager").length}`);
  console.log(`        staff=${EMPLOYEES.filter((e) => e.garden_role === "staff").length}`);
  console.log("");

  if (!applyMode) {
    console.log("  ※ DRY-RUN モード：実際のDB操作は行いません");
    console.log("     本実行するには --apply オプションを付けてください");
    console.log("");
  }

  // 環境変数チェック
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("❌ 環境変数が不足しています:");
    console.error("   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    console.error("   .env.local を確認してください");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const emp of EMPLOYEES) {
    const email = toEmail(emp.employee_number);
    const password = toInitialPassword(emp.birthday);
    const employeeId = toEmployeeId(emp.employee_number);

    console.log(`\n━━ ${emp.employee_number} ${emp.name} (${emp.garden_role}) ━━`);
    console.log(`  email      : ${email}`);
    console.log(`  password   : ${emp.existing ? "(既存・変更しない)" : password}`);
    console.log(`  employee_id: ${employeeId}`);
    console.log(`  birthday   : ${emp.birthday}`);

    if (!applyMode) {
      skipped++;
      continue;
    }

    // ------------------------------------------------
    // 1. Supabase Auth: user を作成 or 取得
    // ------------------------------------------------
    let userId: string | null = null;

    if (emp.existing) {
      // 既存ユーザーを email で検索
      const { data: list, error } = await supabase.auth.admin.listUsers();
      if (error) {
        console.error(`  ❌ listUsers: ${error.message}`);
        failed++;
        continue;
      }
      const found = list.users.find((u) => u.email === email);
      if (!found) {
        console.error(`  ❌ 既存ユーザー ${email} が見つかりません`);
        failed++;
        continue;
      }
      userId = found.id;
      console.log(`  ✓ 既存ユーザー取得: user_id=${userId.slice(0, 8)}...`);
    } else {
      // 新規作成を試みる
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          employee_number: emp.employee_number,
          name: emp.name,
        },
      });

      if (error) {
        // 既にメールアドレス存在 → 検索してパスワード更新
        const alreadyExists =
          error.message.includes("already been registered") ||
          error.message.includes("already exists") ||
          (error as unknown as { code?: string }).code === "email_exists";

        if (alreadyExists) {
          const { data: list } = await supabase.auth.admin.listUsers();
          const found = list.users.find((u) => u.email === email);
          if (!found) {
            console.error(`  ❌ 既に登録済と判定されたが検索失敗: ${email}`);
            failed++;
            continue;
          }
          userId = found.id;
          const { error: updErr } = await supabase.auth.admin.updateUserById(
            found.id,
            { password },
          );
          if (updErr) {
            console.error(`  ❌ パスワード更新失敗: ${updErr.message}`);
            failed++;
            continue;
          }
          console.log(`  ✓ 既存に上書き: user_id=${userId.slice(0, 8)}... / password更新`);
          updated++;
        } else {
          console.error(`  ❌ createUser: ${error.message}`);
          failed++;
          continue;
        }
      } else {
        userId = data.user!.id;
        console.log(`  ✓ 新規作成: user_id=${userId.slice(0, 8)}...`);
        created++;
      }
    }

    if (!userId) continue;

    // ------------------------------------------------
    // 2. root_employees に UPSERT
    // ------------------------------------------------
    // 既存レコード（employee_number 一致）があれば employee_id を流用
    const { data: existingEmp } = await supabase
      .from("root_employees")
      .select("employee_id")
      .eq("employee_number", emp.employee_number)
      .maybeSingle();

    const useEmployeeId = existingEmp?.employee_id ?? employeeId;

    // INSERT or UPDATE で項目を分ける（既存は最小限の更新のみ）
    const upsertRow: Record<string, unknown> = {
      employee_id: useEmployeeId,
      employee_number: emp.employee_number,
      name: emp.name,
      name_kana: emp.name_kana,
      user_id: userId,
      garden_role: emp.garden_role,
      birthday: emp.birthday,
      email,
      is_active: true,
    };

    // 新規作成時に必要な必須フィールドをダミー値で補う
    if (!existingEmp) {
      upsertRow.company_id = emp.company_id;
      upsertRow.employment_type = emp.employment_type;
      upsertRow.salary_system_id = "SAL-SYS-001"; // 要：事前に給与体系マスタが存在すること
      upsertRow.hire_date = "2020-01-01";         // 仮。後で Root UI から更新
      upsertRow.bank_name = "";
      upsertRow.bank_code = "";
      upsertRow.branch_name = "";
      upsertRow.branch_code = "";
      upsertRow.account_type = "";
      upsertRow.account_number = "";
      upsertRow.account_holder = "";
      upsertRow.account_holder_kana = "";
      upsertRow.insurance_type = "未加入";
    }

    const { error: upsertErr } = await supabase
      .from("root_employees")
      .upsert(upsertRow, { onConflict: "employee_id" });

    if (upsertErr) {
      console.error(`  ❌ root_employees UPSERT: ${upsertErr.message}`);
      failed++;
      continue;
    }
    console.log(`  ✓ root_employees UPSERT 完了: ${useEmployeeId}`);
  }

  // ============================================================
  // 結果サマリ
  // ============================================================
  console.log("");
  console.log("┌─────────────────────────────┐");
  console.log("│         結果サマリ          │");
  console.log("├─────────────────────────────┤");
  console.log(`│  新規作成 : ${String(created).padStart(3)}          │`);
  console.log(`│  更新     : ${String(updated).padStart(3)}          │`);
  console.log(`│  スキップ : ${String(skipped).padStart(3)} (dry-run)│`);
  console.log(`│  失敗     : ${String(failed).padStart(3)}          │`);
  console.log("└─────────────────────────────┘");

  if (failed > 0) {
    console.log("\n⚠️  失敗があります。上記ログを確認してください。");
    process.exit(1);
  }
  console.log("\n✅ 完了");
}

main().catch((e) => {
  console.error("\n❌ FATAL ERROR:");
  console.error(e);
  process.exit(1);
});
