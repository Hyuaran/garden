import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";

import { findOrCreateSubfolder, moveFile } from "../_lib/drive";

type MoveAction = "returned" | "approved" | "completed" | "resubmitted" | "not_reimbursable";

const DIRECT_SUBFOLDER: Partial<Record<MoveAction, string>> = {
  returned: "0_差戻し",
  approved: "1_承認",
  completed: "2_完了",
};

const OWNER_ALLOWED_ACTIONS = new Set<MoveAction>(["resubmitted", "not_reimbursable"]);

type ExpenseRow = {
  drive_file_id: string | null;
  applicant_employee_id: string | null;
};

type EmployeeRow = {
  employee_id: string;
  user_id: string | null;
  expense_drive_folder_id: string | null;
};

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) {
      return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });
    }

    const body = (await req.json()) as { requestId?: string; action?: string };
    const requestId = body.requestId;
    const action = body.action as MoveAction | undefined;
    if (!requestId || !action || !isMoveAction(action)) {
      return NextResponse.json({ ok: false, error: "requestId / action が不正です" }, { status: 400 });
    }

    const { data: row } = await supabase
      .from("bud_expense_requests")
      .select("drive_file_id,applicant_employee_id")
      .eq("id", requestId)
      .maybeSingle<ExpenseRow>();

    if (!row) {
      return NextResponse.json({ ok: false, error: "申請が見つかりません" }, { status: 404 });
    }
    if (!row.drive_file_id) {
      return NextResponse.json({ ok: true, skipped: "drive_file_id なし" });
    }
    if (!row.applicant_employee_id) {
      return NextResponse.json({ ok: false, error: "申請者が未設定です" }, { status: 409 });
    }

    const [{ data: hasAccess }, { data: applicant }] = await Promise.all([
      supabase.rpc("bud_has_access"),
      supabase
        .from("root_employees")
        .select("employee_id,user_id,expense_drive_folder_id")
        .eq("employee_id", row.applicant_employee_id)
        .maybeSingle<EmployeeRow>(),
    ]);

    const budAccess = Boolean(hasAccess);
    const owner = applicant?.user_id === auth.user.id;
    if (!budAccess && !(OWNER_ALLOWED_ACTIONS.has(action) && owner)) {
      return NextResponse.json({ ok: false, error: "このDrive移動の権限がありません" }, { status: 403 });
    }

    if (!applicant?.expense_drive_folder_id) {
      return NextResponse.json({ ok: true, skipped: "申請者のDriveフォルダ未設定" });
    }

    const targetFolderId = await resolveTargetFolderId(applicant.expense_drive_folder_id, action);
    await moveFile(row.drive_file_id, targetFolderId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Drive移動に失敗しました";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function isMoveAction(action: string): action is MoveAction {
  return action === "returned" || action === "approved" || action === "completed" || action === "resubmitted" || action === "not_reimbursable";
}

async function resolveTargetFolderId(employeeFolderId: string, action: MoveAction) {
  if (action === "resubmitted") return employeeFolderId;
  if (action === "not_reimbursable") {
    const returnedFolderId = await findOrCreateSubfolder(employeeFolderId, "0_差戻し");
    return findOrCreateSubfolder(returnedFolderId, "0_精算不可");
  }

  const subfolder = DIRECT_SUBFOLDER[action];
  if (!subfolder) throw new Error("未対応のDrive移動です");
  return findOrCreateSubfolder(employeeFolderId, subfolder);
}
