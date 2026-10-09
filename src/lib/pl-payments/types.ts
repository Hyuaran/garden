export type PlPaymentRecord = {
  id: string;
  revision: string;
  category: string[];
  status: string;
  kind: string;
  vendor: string;
  taskName: string;
  mfCompany: "センターライズ" | "ヒュアラン" | string;
  owner: string;
  amount: number;
  fee: string;
  dueDate: string;
  periodDate: string;
  driveUrl: string;
  recordUrl: string;
};

export type PaymentTaskRow = {
  pl_record_id: string;
  pl_revision?: string | null;
  category?: string | null;
  status?: string | null;
  vendor?: string | null;
  mf_company?: string | null;
  amount?: number | null;
  due_date?: string | null;
  effective_due_date?: string | null;
  period_month?: string | null;
  notified_new_at?: string | null;
  drive_url?: string | null;
  drive_url_set_at?: string | null;
  drive_match_note?: string | null;
  transfer_request_id?: string | null;
  transfer_execute_id?: string | null;
  transfer_id?: string | null;
  transfer_created_at?: string | null;
  transfer_note?: string | null;
  reminder_sent_on?: string | null;
  unreserved_alert_sent_on?: string | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AccountSource = {
  id: string;
  payee: string;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountKana: string;
  fee: string;
};

export type TransferCreateResult = {
  requestId?: string;
  executeId?: string;
  transferId: string;
  duplicateKey: string;
  identifier: string;
  executeUrl?: string;
  note?: string;
  planned?: boolean;
};

export type RunEvent = {
  type: string;
  message: string;
  recordId?: string;
};
