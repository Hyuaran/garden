"use client";
import SystemTabs from '@/app/system/_components/SystemTabs/SystemTabs';
import RosterProfileFields, {type ProfileDraft} from './RosterProfileFields';
import TeamHistoryPanel from './TeamHistoryPanel';
import { BUSINESSES } from '../_lib/team-history';
import { FormRow as KitFormRow, SelectField as KitSelectField, FieldLabel, RadioGroup } from '@/app/system/forms/_components/form-kit';

import FilterRow from "@/app/system/_components/FilterBox/FilterRow";

import ChoiceFilter from "@/app/system/_components/ChoiceFilter";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../_components/PageHeader";
import UpdatedStamp, { UpdatedStampRow } from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import { Button } from "../_components/Button";
import DataTable, { type DataColumn } from "@/app/system/_components/DataTable/DataTable";
import { StatusBadge } from "../_components/StatusBadge";
import { Modal } from "../_components/Modal";
import { TextField, SelectField, FormGrid, TextareaField } from "../_components/FormField";
import { fetchEmployees, upsertEmployee, updateEmployeeGardenRole, setEmployeeActive, fetchCompanies, fetchSalarySystems } from "../_lib/queries";
import {
  GARDEN_ROLE_LABELS,
  isRoleAtLeast,
  type Company,
  type Employee,
  type GardenRole,
  type SalarySystem,
} from "../_constants/types";
import { colors } from "../_constants/colors";
import { useRootState } from "../_state/RootStateContext";
import { writeAudit } from "../_lib/audit";
import {
  validateEmployee,
  isEmployeeBankRequired,
  hasErrors,
  VALIDATION_ERROR_BANNER,
  type FieldErrors,
} from "../_lib/validators";
import { useMasterShortcuts } from "../_lib/useMasterShortcuts";
import { sanitizeUpsertPayload, NULLABLE_DATE_KEYS } from "../_lib/sanitize-payload";
import KotEmployeePanel from "./KotEmployeePanel";
import { GardenRoleField } from "./GardenRoleField";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import {
  CALL_RECORDING_OVERRIDE_LABELS,
  type CallRecordingOverride,
} from "@/lib/innovera/call-access";

/**
 * 雇用形態選択肢。DB 値（value）と UI ラベル（label）を分離。
 * Phase A-3-g で 'outsource' を追加（DB は英語、UI は「外注」表示）。
 */
const EMP_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "役員",       label: "役員" },
  { value: "正社員",    label: "正社員" },
  { value: "アルバイト", label: "アルバイト" },
  { value: "派遣",       label: "派遣" },
  { value: "outsource", label: "外注" },
];
const ACCOUNT_TYPES = ["普通", "当座"];
const INS_TYPES = ["加入", "未加入", "一部加入"];
const CALL_RECORDING_OVERRIDE_OPTIONS: CallRecordingOverride[] = [
  "default",
  "all",
  "all_history_own_audio",
  "own",
  "none",
];
const GARDEN_ROLE_CHANGE_ERROR = "Garden権限を変更できませんでした。全権管理者のアカウントで操作してください。";
const GARDEN_ROLE_CHANGE_RETRY_ERROR = "Garden権限を変更できませんでした。時間をおいて、もう一度お試しください。";

/**
 * 年末調整の甲/乙欄区分（Phase A-3-h）。DB 値は英語コード、UI は日本語表示。
 */
const KOU_OTSU_OPTIONS: Array<{ value: "" | "kou" | "otsu"; label: string }> = [
  { value: "",    label: "（未設定）" },
  { value: "kou", label: "甲欄（主な収入）" },
  { value: "otsu", label: "乙欄（副業）" },
];

type ChatworkTokenSyncPerson = {
  employeeNumber: string;
  name: string;
};

type ChatworkTokenSyncResult = {
  syncedAt: string;
  imported: number;
  created: number;
  unchanged: number;
  invalidFormat: ChatworkTokenSyncPerson[];
  rejectedByChatwork: ChatworkTokenSyncPerson[];
  missingRoot: ChatworkTokenSyncPerson[];
  retired: number;
};

type RosterSyncResult = {
  syncedAt: string;
  dryRun: boolean;
  rosterRecords: number;
  created: number;
  updated: number;
  accountsCreated: number;
  authBanned: number;
  authUnbanned: number;
  errors: string[];
};

type ProfileHistoryRow = {
  id?: string;
  category: string;
  payload: Record<string, unknown>;
  source: string;
  source_ref: string | null;
  source_document_url?: string | null;
  effective_from: string | null;
  recorded_at?: string | null;
  recorded_by: string | null;
  confirmed_by_employee_at?: string | null;
};

type ProfileHistoryState = {
  employee: Employee;
  rows: ProfileHistoryRow[];
  currentIds: Record<string, string | null>;
} | null;

type CurrentAddress = {
  postal_code: string | null;
  full: string | null;
  building: string | null;
  room: string | null;
  source: string;
  recorded_at: string | null;
};

type CurrentAddressMap = Record<string, CurrentAddress>;

const PROFILE_CATEGORY_LABELS: Record<string, string> = { address: "住所", contact: "連絡先", emergency_contact: "緊急連絡先", bank_account: "給与受取口座", commute: "交通費", employment: "雇用条件", dependents: "扶養", my_number_status: "マイナンバー" };
const PROFILE_SOURCE_LABELS: Record<string, string> = { roster: "従業員名簿", bank_list: "口座一覧", transfer_group: "振込グループ", mf_contract: "電子契約の書類", employee_confirm: "本人確認", submission: "届出", onboarding: "入社手続き", admin: "事務の入力" };

function sourceLabel(source: string) {
  return PROFILE_SOURCE_LABELS[source] ?? source;
}

function formatPostalCode(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{7}$/.test(raw)) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
  return raw;
}

function addressLine(address: CurrentAddress | undefined) {
  const full = address?.full?.trim() ?? "";
  if (!full) return "未登録";
  const postalCode = formatPostalCode(address?.postal_code);
  return [postalCode ? `〒${postalCode}` : "", full].filter(Boolean).join(" ");
}

function formatProfileDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function addressSourceLine(address: CurrentAddress | undefined) {
  if (!address?.source) return "";
  const date = formatProfileDate(address.recorded_at);
  return `出どころ：${sourceLabel(address.source)}${date ? `（${date}）` : ""}`;
}

async function fetchCurrentAddresses(): Promise<CurrentAddressMap> {
  // 住所が読めなくても一覧そのものは出す（住所列は「未登録」になる）
  let body: unknown;
  try {
    const response = await fetch("/api/root/employees/addresses", { cache: "no-store" });
    if (!response.ok) return {};
    body = await response.json();
  } catch {
    return {};
  }
  const raw = (body as { addresses?: unknown })?.addresses ?? body;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CurrentAddressMap = {};
  for (const [employeeId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    out[employeeId] = {
      postal_code: typeof row.postal_code === "string" ? row.postal_code : null,
      full: typeof row.full === "string" ? row.full : null,
      building: typeof row.building === "string" ? row.building : null,
      room: typeof row.room === "string" ? row.room : null,
      source: typeof row.source === "string" ? row.source : "",
      recorded_at: typeof row.recorded_at === "string" ? row.recorded_at : null,
    };
  }
  return out;
}

function AddressReadOnly({ address }: { address: CurrentAddress | undefined }) {
  const full = address?.full?.trim() ?? "";
  const postalCode = formatPostalCode(address?.postal_code);
  const building = address?.building?.trim() ?? "";
  const room = address?.room?.trim() ?? "";
  const source = addressSourceLine(address);

  return (
    <section style={{ margin: "16px 0 8px" }} {...CLARITY_MASK}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px 0", color: colors.textMuted }}>住所（今の値・変更は届出か名簿から）</h3>
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 6, background: colors.bgPanel, padding: "10px 12px", color: colors.text, fontSize: 14, lineHeight: 1.7 }}>
        {full ? (
          <>
            {postalCode ? <div>〒{postalCode}</div> : null}
            <div>{full}</div>
            {building || room ? <div>{[building, room].filter(Boolean).join(" ")}</div> : null}
            {source ? <div style={{ color: colors.textMuted, fontSize: 13 }}>{source}</div> : null}
          </>
        ) : (
          <div style={{ color: colors.textMuted }}>未登録</div>
        )}
      </div>
      <div style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>
        住所の変更は本人の届出（マイページ）か、名簿の同期で入ります。履歴は一覧の［履歴］から確認できます。
      </div>
    </section>
  );
}

function profileValue(row: ProfileHistoryRow) {
  const p = row.payload ?? {};
  const s = (key: string) => p[key] === null || p[key] === undefined ? "" : String(p[key]);
  if (row.category === "address") return s("full") || "未登録";
  if (row.category === "contact") return [s("phone"), s("email")].filter(Boolean).join(" / ") || "未登録";
  if (row.category === "emergency_contact") return `${s("name")}${s("relation") ? `（${s("relation")}）` : ""} ${s("phone")} ${Boolean(p.same_address_as_employee) ? "本人と同じ" : s("address")}`.trim() || "未登録";
  if (row.category === "bank_account") return [s("bank_name"), s("branch_name"), ({ ordinary: "普通", current: "当座", savings: "貯蓄" } as Record<string, string>)[s("account_type")] ?? s("account_type"), s("account_number")].filter(Boolean).join(" ") || "未登録";
  if (row.category === "commute") return `日額 ${s("round_trip") || "-"}円・片道 ${s("one_way") || "-"}円・上限 ${s("monthly_cap") || "なし"}${s("nearest_station") ? `・${s("nearest_station")}` : ""}`;
  if (row.category === "employment") return [s("employment_type"), s("hire_date"), s("department"), s("affiliation")].filter(Boolean).join(" / ") || "未登録";
  if (row.category === "dependents") return `${s("count") || "0"} 人`;
  if (row.category === "my_number_status") return p.submitted ? "提出済み" : "未提出";
  return JSON.stringify(p);
}

function profileSource(row: ProfileHistoryRow) {
  return `${PROFILE_SOURCE_LABELS[row.source] ?? row.source}${row.source_ref ? `（${row.source_ref}）` : ""}`;
}

type ChatworkTokenStatus = {
  registered: boolean;
  accountName: string | null;
  updatedAt: string | null;
};

const emptyChatworkTokenStatus: ChatworkTokenStatus = {
  registered: false,
  accountName: null,
  updatedAt: null,
};

const empty = (nextId: string, companyId: string, salarySystemId: string): Employee => ({
  employee_id: nextId,
  employee_number: "",
  name: "",
  name_kana: "",
  company_id: companyId,
  employment_type: "正社員",
  salary_system_id: salarySystemId,
  hire_date: new Date().toISOString().slice(0, 10),
  termination_date: null,
  contract_end_on: null,
  kou_otsu: null,
  dependents_count: 0,
  deleted_at: null,
  email: "",
  bank_name: "",
  bank_code: "",
  branch_name: "",
  branch_code: "",
  account_type: "普通",
  account_number: "",
  account_holder: "",
  account_holder_kana: "",
  kot_employee_id: null,
  innovera_extension: null,
  innovera_mobile_extension: null,
  chatwork_account_id: null,
  filemaker_employee_name: null,
  mf_employee_id: null,
  call_recording_access: "default",
  insurance_type: "加入",
  is_active: true,
  notes: null,
  created_at: "",
  updated_at: "",
  garden_role: "staff",
});

function isGardenRoleChangeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /P0001|enforce_garden_role_change|現在の権限/i.test(message);
}

function nextId(existing: Employee[]): string {
  const nums = existing.map((e) => parseInt(e.employee_id.replace("EMP-", ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `EMP-${String(max + 1).padStart(4, "0")}`;
}

function formatSyncPeople(people: ChatworkTokenSyncPerson[]) {
  if (people.length === 0) return "";
  return `：${people.map((person) => `${person.employeeNumber} ${person.name}`.trim()).join("、")}`;
}

export default function EmployeesPage() {
  const { canWrite, rootUser } = useRootState();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [addresses, setAddresses] = useState<CurrentAddressMap>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [salarySystems, setSalarySystems] = useState<SalarySystem[]>([]);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editTab,setEditTab] = useState('basic');
  const bankBaselineRef = useRef<Record<string,unknown>>({});
  const [profileDraft,setProfileDraft] = useState<ProfileDraft>({});
  const [profileChanges,setProfileChanges] = useState<ProfileDraft>({});
  const [profileReady,setProfileReady] = useState(false);
  const [pushWarning,setPushWarning] = useState<string>();
  const [roleTarget, setRoleTarget] = useState<Employee | null>(null);
  const [nextGardenRole, setNextGardenRole] = useState<GardenRole>("staff");
  const [saving, setSaving] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [tokenSyncing, setTokenSyncing] = useState(false);
  const [tokenSyncResult, setTokenSyncResult] = useState<ChatworkTokenSyncResult | null>(null);
  const [rosterSyncing, setRosterSyncing] = useState(false);
  const [rosterSyncResult, setRosterSyncResult] = useState<RosterSyncResult | null>(null);
  const [rosterSyncedAt, setRosterSyncedAt] = useState<string | null>(null);
  const [chatworkTokenStatus, setChatworkTokenStatus] = useState<ChatworkTokenStatus>(emptyChatworkTokenStatus);
  const [chatworkTokenInput, setChatworkTokenInput] = useState("");
  const [chatworkTokenLoading, setChatworkTokenLoading] = useState(false);
  const [chatworkTokenSaving, setChatworkTokenSaving] = useState(false);
  const [chatworkTokenError, setChatworkTokenError] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Employee | null>(null);
  const [profileHistory, setProfileHistory] = useState<ProfileHistoryState>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyCategory, setHistoryCategory] = useState("");
  const [historySource, setHistorySource] = useState("");
  const bankRequired = editTarget ? isEmployeeBankRequired(editTarget) : true;
  const canSyncChatworkTokens = rootUser?.garden_role ? isRoleAtLeast(rootUser.garden_role, "manager") : false;
  const canManageChatworkToken = rootUser?.garden_role ? isRoleAtLeast(rootUser.garden_role, "manager") : false;
  const canSyncRoster = rootUser?.garden_role ? isRoleAtLeast(rootUser.garden_role, "admin") : false;
  const editEmployeeId = editTarget?.employee_id;
  useEffect(() => {
    setProfileDraft({}); setProfileChanges({}); setProfileReady(false);
    bankBaselineRef.current = Object.fromEntries(Object.entries({bank_name:'bank_name',bank_code:'bank_code',branch_name:'branch_name',branch_code:'branch_code',account_type:'account_type',account_number:'account_number',account_holder_kana:'holder_kana'}).map(([key,source])=>[source,source === 'account_type' ? ({普通:'ordinary',当座:'current'} as Record<string,string>)[String(editTarget?.account_type)] ?? editTarget?.account_type : editTarget?.[key as keyof Employee]]));
    setEditTab('basic');
    if (!editEmployeeId) return;
    const controller = new AbortController();
    fetch('/api/root/employees/'+encodeURIComponent(editEmployeeId)+'/profile-history',{signal:controller.signal}).then(async response=>{
      if (!response.ok) throw new Error('履歴を読み込めませんでした。');
      const body = await response.json();
      if (controller.signal.aborted) return;
      const current: ProfileDraft = {};
      for (const row of body.rows ?? []) if (body.currentIds[row.category] === row.id) current[row.category]=row.payload;
      setProfileDraft(current); setProfileReady(true);
      const bank = current.bank_account;
      if (bank) bankBaselineRef.current = bank;
      if (bank) setEditTarget(target=> target?.employee_id === editEmployeeId ? {...target,...Object.fromEntries(Object.entries({bank_name:'bank_name',bank_code:'bank_code',branch_name:'branch_name',branch_code:'branch_code',account_type:'account_type',account_number:'account_number',account_holder_kana:'holder_kana'}).map(([key,source])=>[key,source === 'account_type' ? ({ordinary:'普通',current:'当座'} as Record<string,string>)[String(bank[source])] ?? bank[source] ?? '' : bank[source] ?? '']))} : target);
    }).catch(error=>{if (!controller.signal.aborted) setError(error.message);});
    return ()=>controller.abort();
  },[editEmployeeId]);
  function changeProfile(category:string,key:string,value:unknown) {
    const apply = (old:ProfileDraft) => category === 'sub_account' ? {...old,bank_account:{...old.bank_account,sub_account:{...(old.bank_account?.sub_account as object ?? {}),[key]:value}}} : {...old,[category]:{...old[category],[key]:value}};
    setProfileDraft(apply);setProfileChanges(apply);
  }
  const editEmployeeCreatedAt = editTarget?.created_at;
  const editEmployeeTokenRegistered = Boolean(editTarget?.chatwork_api_token_enc);
  const editEmployeeTokenAccountName = editTarget?.chatwork_account_name ?? null;
  const editEmployeeTokenUpdatedAt = editTarget?.chatwork_token_updated_at ?? null;

  async function load() {
    try {
      setLoading(true); setError(null);
      const [e, c, s, a] = await Promise.all([fetchEmployees(), fetchCompanies(), fetchSalarySystems(), fetchCurrentAddresses()]);
      setEmployees(e); setCompanies(c); setSalarySystems(s); setAddresses(a);
      const linkedId = new URLSearchParams(window.location.search).get("employeeId");
      if (linkedId && !editTarget) setEditTarget(e.find(row=>row.employee_id===linkedId) ?? null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/root/roster-sync", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled) setRosterSyncedAt(body.latest?.synced_at ?? null);
      })
      .catch(() => { /* 履歴を取得できない場合は未取得を表示する。 */ });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (!editTarget) setErrors({}); }, [editTarget]);
  useEffect(() => {
    if (!editEmployeeId) {
      setChatworkTokenStatus(emptyChatworkTokenStatus);
      setChatworkTokenInput("");
      setChatworkTokenError(null);
      return;
    }
    setChatworkTokenStatus({
      registered: editEmployeeTokenRegistered,
      accountName: editEmployeeTokenAccountName,
      updatedAt: editEmployeeTokenUpdatedAt,
    });
    setChatworkTokenInput("");
    setChatworkTokenError(null);
    if (!canManageChatworkToken || !editEmployeeCreatedAt || !editEmployeeId) return;

    let cancelled = false;
    setChatworkTokenLoading(true);
    fetch(`/api/root/employees/${encodeURIComponent(editEmployeeId)}/chatwork-token`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Chatwork 連携の状態を読み込めませんでした");
        if (!cancelled) setChatworkTokenStatus(body as ChatworkTokenStatus);
      })
      .catch((statusError) => {
        if (!cancelled) {
          setChatworkTokenError(statusError instanceof Error ? statusError.message : "Chatwork 連携の状態を読み込めませんでした");
        }
      })
      .finally(() => {
        if (!cancelled) setChatworkTokenLoading(false);
      });

    return () => { cancelled = true; };
  }, [
    editEmployeeId,
    editEmployeeCreatedAt,
    editEmployeeTokenRegistered,
    editEmployeeTokenAccountName,
    editEmployeeTokenUpdatedAt,
    canManageChatworkToken,
  ]);

  const companyMap = useMemo(() => new Map(companies.map((c) => [c.company_id, c])), [companies]);
  const salaryMap = useMemo(() => new Map(salarySystems.map((s) => [s.salary_system_id, s])), [salarySystems]);

  useMasterShortcuts<Employee>({
    rows: employees, modalOpen: !!editTarget || !!historyTarget || !!roleTarget,
    onSearch: () => { const input = tableRef.current?.querySelector<HTMLInputElement>('input[type="search"]'); input?.focus(); input?.select(); },
    rowNavigation: false,
  });

  async function handleSave() {
    if (!editTarget) return;
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_employees",
        payload: { attempted: "save" },
      });
      setError("編集権限がありません");
      return;
    }
    const errs = validateEmployee(editTarget);
    if (hasErrors(errs)) {
      setErrors(errs);
      setError(VALIDATION_ERROR_BANNER);
      // 入力が足りない欄のあるタブを開く（口座1は「口座・通勤」タブにある）
      const bankKeys = ["bank_name", "bank_code", "branch_name", "branch_code", "account_type", "account_number", "account_holder", "account_holder_kana"];
      const errorKeys = Object.keys(errs).filter(key => errs[key as keyof typeof errs]);
      setEditTab(errorKeys.length > 0 && errorKeys.every(key => bankKeys.includes(key)) ? 'bank' : 'basic');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setErrors({});
      const changes: ProfileDraft = {...profileChanges};
      const bankPatch: Record<string,unknown> = {};
      for (const [key,source] of Object.entries({bank_name:'bank_name',bank_code:'bank_code',branch_name:'branch_name',branch_code:'branch_code',account_type:'account_type',account_number:'account_number',account_holder_kana:'holder_kana'})) {
        const raw = editTarget[key as keyof Employee];
        const value = source === 'account_type' ? ({普通:'ordinary',当座:'current'} as Record<string,string>)[String(raw)] ?? raw : raw;
        if (String(value ?? '') !== String(bankBaselineRef.current[source] ?? '')) bankPatch[source] = value;
      }
      if (Object.keys(bankPatch).length) changes.bank_account = {...changes.bank_account,...bankPatch};
      const saved = await upsertEmployee(
        sanitizeUpsertPayload({ ...editTarget, profile_changes:changes, chatwork_account_id: editTarget.chatwork_account_id?.trim() || null }, { nullableDateKeys: NULLABLE_DATE_KEYS.employees }) as Partial<Employee> & { employee_id: string },
      );
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_employees",
        targetId: editTarget.employee_id,
        payload: { value: editTarget },
      });
      setEditTarget(null);
      await load();
      setPushWarning(saved?.warning);
    } catch (e) {
      setError(isGardenRoleChangeError(e) ? GARDEN_ROLE_CHANGE_ERROR : (e as Error).message);
    }
    finally { setSaving(false); }
  }

  async function handleToggleActive(e: Employee) {
    if (!canWrite) {
      await writeAudit({
        action: "permission_denied",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_employees",
        payload: { attempted: "toggle_active" },
      });
      setError("編集権限がありません");
      return;
    }
    try {
      const saved = await setEmployeeActive(e.employee_id, !e.is_active);
      setEditTarget(null);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser?.user_id ?? null,
        actorEmpNum: rootUser?.employee_number ?? null,
        targetType: "root_employees",
        targetId: e.employee_id,
        payload: { toggle_active: !e.is_active },
      });
      await load();
      setPushWarning(saved?.warning);
    } catch (err) { setError((err as Error).message); }
  }

  function openRoleDialog(employee: Employee) {
    setRoleTarget(employee);
    setNextGardenRole(employee.garden_role ?? "staff");
    setRoleError(null);
  }

  function closeRoleDialog() {
    if (roleSaving) return;
    setRoleTarget(null);
    setRoleError(null);
  }

  async function handleChatworkTokenSync() {
    if (!canSyncChatworkTokens) {
      setError("責任者以上の権限が必要です");
      return;
    }
    try {
      setTokenSyncing(true);
      setError(null);
      setTokenSyncResult(null);
      const response = await fetch("/api/root/chatwork-token-sync", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Chatwork トークンを取り込めませんでした");
      setTokenSyncResult(body as ChatworkTokenSyncResult);
      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Chatwork トークンを取り込めませんでした");
    } finally {
      setTokenSyncing(false);
    }
  }

  async function handleRosterSync() {
    if (rosterSyncing) return;
    if (!canSyncRoster) {
      setError("管理者以上の権限が必要です");
      return;
    }
    try {
      setRosterSyncing(true);
      setError(null);
      setRosterSyncResult(null);
      const response = await fetch("/api/root/roster-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "名簿同期に失敗しました");
      setRosterSyncResult(body as RosterSyncResult);
      if (!body.dryRun) setRosterSyncedAt(body.syncedAt);
      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "名簿同期に失敗しました");
    } finally {
      setRosterSyncing(false);
    }
  }

function formatChatworkTokenUpdatedAt(value: string | null) {
    if (!value) return "";
    return new Date(value).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleChatworkTokenSave() {
    if (!editTarget || !canManageChatworkToken) {
      setChatworkTokenError("責任者以上の権限が必要です");
      return;
    }
    try {
      setChatworkTokenSaving(true);
      setChatworkTokenError(null);
      const response = await fetch(`/api/root/employees/${encodeURIComponent(editTarget.employee_id)}/chatwork-token`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: chatworkTokenInput }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Chatwork 連携を保存できませんでした");
      setEditTarget(current => current ? { ...current, chatwork_account_id: body.accountId ?? null } : current);
      setChatworkTokenInput("");
      setChatworkTokenStatus({
        registered: true,
        accountName: body.accountName ?? null,
        updatedAt: body.updatedAt ?? null,
      });
      await load();
    } catch (saveError) {
      setChatworkTokenError(saveError instanceof Error ? saveError.message : "Chatwork 連携を保存できませんでした");
    } finally {
      setChatworkTokenSaving(false);
    }
  }

  async function handleChatworkTokenDelete() {
    if (!editTarget || !canManageChatworkToken) {
      setChatworkTokenError("責任者以上の権限が必要です");
      return;
    }
    if (!window.confirm("Chatwork トークンを削除します。よろしいですか。")) return;
    try {
      setChatworkTokenSaving(true);
      setChatworkTokenError(null);
      const response = await fetch(`/api/root/employees/${encodeURIComponent(editTarget.employee_id)}/chatwork-token`, {
        method: "DELETE",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Chatwork 連携を削除できませんでした");
      setChatworkTokenInput("");
      setChatworkTokenStatus(emptyChatworkTokenStatus);
      await load();
    } catch (deleteError) {
      setChatworkTokenError(deleteError instanceof Error ? deleteError.message : "Chatwork 連携を削除できませんでした");
    } finally {
      setChatworkTokenSaving(false);
    }
  }

  async function handleRoleChange() {
    if (!roleTarget || rootUser?.garden_role !== "super_admin") return;
    const currentRole = roleTarget.garden_role ?? "staff";
    if (currentRole === nextGardenRole) {
      setRoleTarget(null);
      setRoleError(null);
      return;
    }

    try {
      setRoleSaving(true);
      setRoleError(null);
      await updateEmployeeGardenRole(roleTarget.employee_id, nextGardenRole);
      setEmployees((current) => current.map((employee) => (
        employee.employee_id === roleTarget.employee_id
          ? { ...employee, garden_role: nextGardenRole }
          : employee
      )));
      setEditTarget(current => current?.employee_id === roleTarget.employee_id ? { ...current, garden_role: nextGardenRole } : current);
      setRoleTarget(null);
      await writeAudit({
        action: "master_update",
        actorUserId: rootUser.user_id,
        actorEmpNum: rootUser.employee_number,
        targetType: "root_employees",
        targetId: roleTarget.employee_id,
        payload: {
          garden_role: { from: currentRole, to: nextGardenRole },
        },
      });
    } catch (changeError) {
      console.error("[updateEmployeeGardenRole]", changeError);
      setRoleError(
        isGardenRoleChangeError(changeError)
          ? GARDEN_ROLE_CHANGE_ERROR
          : GARDEN_ROLE_CHANGE_RETRY_ERROR,
      );
    } finally {
      setRoleSaving(false);
    }
  }

  async function openHistory(employee: Employee) {
    setHistoryTarget(employee);
    setProfileHistory(null);
    setHistoryError(null);
    setHistoryCategory("");
    setHistorySource("");
    try {
      setHistoryLoading(true);
      const response = await fetch(`/api/root/employees/${encodeURIComponent(employee.employee_id)}/profile-history`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "履歴を読み込めませんでした");
      setProfileHistory({ employee, rows: body.rows ?? [], currentIds: body.currentIds ?? {} });
    } catch (loadError) {
      setHistoryError(loadError instanceof Error ? loadError.message : "履歴を読み込めませんでした");
    } finally {
      setHistoryLoading(false);
    }
  }

  const columns: DataColumn<Employee>[] = [
    { id: "id", value: (e) => e.employee_id, type: "text", label: "ID", align: "fixed", render: (e) => e.employee_id },
    { id: "num", value: (e) => e.employee_number, type: "text", label: "社員番号", align: "fixed", render: (e) => <span {...CLARITY_MASK}>{e.employee_number}</span> },
    { id: "name", value: (e) => e.name, type: "text", label: "氏名", align: "text", render: (e) => <span {...CLARITY_MASK}>{e.name}</span> },
    { id: "kana", value: (e) => e.name_kana, type: "text", label: "カナ", align: "text", render: (e) => <span {...CLARITY_MASK}>{e.name_kana}</span> },
    { id: "address", value: (e) => addressLine(addresses[e.employee_id]), type: "text", label: "住所", align: "text", render: (e) => {
      const address = addresses[e.employee_id];
      const text = addressLine(address);
      return <span style={{ color: address?.full ? colors.text : colors.textMuted }} {...CLARITY_MASK}>{text}</span>;
    }, wrap: true },
    { id: "company", value: (e) => companyMap.get(e.company_id)?.company_name ?? e.company_id, type: "text", label: "法人", align: "text", render: (e) => companyMap.get(e.company_id)?.company_name ?? e.company_id },
    { id: "team", value: (e) => e.current_team || "所属なし", type: "text", label: "チーム", align: "text", render: (e) => e.current_team || "所属なし" },
    { id: "business", value: (e) => e.business || "未設定", type: "text", label: "事業", align: "text", render: (e) => e.business || "—" },
    { id: "emp_type", value: (e) => e.employment_type, type: "text", label: "雇用形態", align: "text", render: (e) => e.employment_type },
    { id: "garden_role", value: (e) => GARDEN_ROLE_LABELS[e.garden_role ?? "staff"], type: "text", label: "Garden権限", align: "text", render: (e) => GARDEN_ROLE_LABELS[e.garden_role ?? "staff"] },
    { id: "salary", value: (e) => salaryMap.get(e.salary_system_id)?.system_name ?? e.salary_system_id, type: "text", label: "給与体系", align: "text", render: (e) => salaryMap.get(e.salary_system_id)?.system_name ?? e.salary_system_id },
    { id: "hire", value: (e) => e.hire_date, type: "date", label: "入社日", align: "fixed", render: (e) => e.hire_date },
    { id: "birthday", value: (e) => e.birthday ?? "", type: "date", label: "生年月日", align: "fixed", render: (e) => e.birthday ?? "—" },
    { id: "termination", value: (e) => e.termination_date ?? "", type: "date", filterValue: (e) => e.termination_date || "なし", label: "退職日", align: "fixed", render: (e) => e.termination_date ?? "—" },
    { id: "status", value: (e) => e.is_active ? "在籍" : "退職", type: "text", label: "状態", render: (e) => <StatusBadge active={e.is_active} />, align: "fixed" },

  ];

  const canAdd = companies.length > 0 && salarySystems.length > 0;

  return (
    <>
      <PageHeader
        title="従業員マスタ"
      />
      <UpdatedStampRow>
        <UpdatedStamp label="従業員名簿" date={rosterSyncedAt} onRefresh={handleRosterSync} busy={rosterSyncing} disabled={!canSyncRoster} refreshLabel="Kintone の従業員名簿と同期する" title="Kintone の従業員名簿と同期する" />
      </UpdatedStampRow>
      {rosterSyncResult && <div role="status" style={{ color: colors.textMuted, fontSize: 12, textAlign: "right", marginBottom: 12 }}>更新 {rosterSyncResult.updated}・無効化 {rosterSyncResult.authBanned}</div>}
      {!canAdd && !loading && <div style={{ background: colors.warningBg, color: colors.warning, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>従業員を追加するには、先に法人マスタと給与体系マスタを登録してください。</div>}
      {tokenSyncResult && (
        <div style={{ background: colors.warningBg, color: colors.warning, padding: "10px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13, lineHeight: 1.7 }}>
          <div>Kintone 従業員名簿から Chatwork の API トークンを取り込みました（{new Date(tokenSyncResult.syncedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}）</div>
          <div>取り込み {tokenSyncResult.imported} 人（新規 {tokenSyncResult.created}・変更なし {tokenSyncResult.unchanged}）</div>
          <div>形式が違うため取り込まず {tokenSyncResult.invalidFormat.length} 人{formatSyncPeople(tokenSyncResult.invalidFormat)}</div>
          <div>Chatwork が受け付けないため取り込まず {tokenSyncResult.rejectedByChatwork.length} 人{formatSyncPeople(tokenSyncResult.rejectedByChatwork)}</div>
          <div>Root に該当者がいない {tokenSyncResult.missingRoot.length} 人{formatSyncPeople(tokenSyncResult.missingRoot)}</div>
          <div>退職済みのため対象外 {tokenSyncResult.retired} 人</div>
        </div>
      )}
      {error && <div style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {loading ? <div style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}>読込中...</div> : <div ref={tableRef}><DataTable columns={columns} rows={employees} rowKey={(e) => e.employee_id} defaultSort={{ id: "num", direction: "asc" }} searchText={(e) => [e.name, e.name_kana, e.employee_number].join(" ")} searchPlaceholder="氏名・カナ・社員番号" pageSize={500} onRowClick={setEditTarget} toolbar={<>        <Button variant="secondary" onClick={handleChatworkTokenSync} disabled={tokenSyncing || !canSyncChatworkTokens} title={!canSyncChatworkTokens ? "責任者以上の権限が必要です" : undefined}>{tokenSyncing ? "取り込み中..." : "Chatwork トークンを取り込む"}</Button>
        <Button onClick={() => setEditTarget(empty(nextId(employees), companies[0]?.company_id ?? "", salarySystems[0]?.salary_system_id ?? ""))} disabled={!canAdd || !canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>+ 新規追加</Button>
</>} /></div>}

      <Modal open={!!historyTarget} onClose={() => setHistoryTarget(null)} title={`${historyTarget?.name ?? ""}（${historyTarget?.employee_number ?? ""}）の履歴`} width={960}>
        {historyLoading ? <div style={{ color: colors.textMuted }}>読込中...</div> : historyError ? <div role="alert" style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4 }}>{historyError}</div> : profileHistory ? (
          <div>
            <FilterRow style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <ChoiceFilter label="区分" value={historyCategory} onValueChange={value => setHistoryCategory(value)}>
                <option value="">区分：すべて</option>
                {Object.entries(PROFILE_CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </ChoiceFilter>
              <ChoiceFilter label="出どころ" value={historySource} onValueChange={value => setHistorySource(value)}>
                <option value="">出どころ：すべて</option>
                {Object.entries(PROFILE_SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </ChoiceFilter>
            </FilterRow>
            {Object.entries(profileHistory.rows.filter((row) => (!historyCategory || row.category === historyCategory) && (!historySource || row.source === historySource)).reduce<Record<string, ProfileHistoryRow[]>>((acc, row) => { (acc[row.category] ??= []).push(row); return acc; }, {})).map(([category, rows]) => (
              <section key={category} style={{ marginBottom: 18 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 15, color: colors.text }}>{PROFILE_CATEGORY_LABELS[category] ?? category}</h3>
                <div style={{ display: "grid", gap: 6 }}>
                  {rows.map((row) => {
                    const isCurrent = profileHistory.currentIds[row.category] === row.id;
                    return <div key={row.id ?? `${row.category}-${row.recorded_at}`} style={{ display: "grid", gridTemplateColumns: "18px 96px minmax(210px,1fr) minmax(130px,180px) auto", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 6, background: isCurrent ? colors.bgPanel : colors.dangerBg, border: `1px solid ${isCurrent ? colors.border : colors.danger}`, fontSize: 13, color: colors.text }} {...CLARITY_MASK}>
                      <span aria-hidden="true">{isCurrent ? "●" : "▲"}</span>
                      <span>{row.effective_from ?? "-"}</span>
                      <span>{profileValue(row)}</span>
                      <span>{profileSource(row)}</span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", whiteSpace: "nowrap" }}>
                        {row.source_document_url ? <a href={row.source_document_url} target="_blank" rel="noreferrer">書類を開く</a> : null}
                        {isCurrent ? <strong>今の値</strong> : null}
                        {row.confirmed_by_employee_at ? <span>本人確認 {row.confirmed_by_employee_at.slice(0, 10)}</span> : null}
                      </span>
                    </div>;
                  })}
                </div>
              </section>
            ))}
            {profileHistory.rows.length === 0 ? <div style={{ color: colors.textMuted }}>履歴はまだありません。</div> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!roleTarget}
        onClose={closeRoleDialog}
        onSubmit={handleRoleChange}
        title="Garden権限の変更"
        width={520}
      >
        {roleTarget && (
          <div>
            {roleError && (
              <div role="alert" style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 16, fontSize: 13 }}>
                {roleError}
              </div>
            )}
            <div style={{ margin: 0, display: "grid", gridTemplateColumns: "110px 1fr", gap: "12px 16px", alignItems: "center" }}>
              <div style={{ color: colors.textMuted, fontSize: 13 }}>氏名</div>
              <div style={{ margin: 0, color: colors.text, fontSize: 14 }} {...CLARITY_MASK}>
                {roleTarget.name}（社員番号 {roleTarget.employee_number}）
              </div>
              <div style={{ color: colors.textMuted, fontSize: 13 }}>いまの権限</div>
              <div style={{ margin: 0, color: colors.text, fontSize: 14, fontWeight: 600 }}>
                {GARDEN_ROLE_LABELS[roleTarget.garden_role ?? "staff"]}
              </div>
              <div style={{ margin: 0, gridColumn: "1 / -1" }}>
                <GardenRoleField
                  label="変更後"
                  operatorRole={rootUser?.garden_role}
                  value={nextGardenRole}
                  onChange={setNextGardenRole}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
              <Button variant="secondary" onClick={closeRoleDialog} disabled={roleSaving}>キャンセル</Button>
              <Button onClick={handleRoleChange} disabled={roleSaving}>
                {roleSaving ? "変更中..." : "変更する"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {pushWarning && <p role="status" style={{fontSize:13}}>{pushWarning}</p>}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} onSubmit={handleSave} title={editTarget?.created_at ? "従業員を編集" : "従業員を追加"} width={860}>
        {editTarget && (
          <div>
            <SystemTabs>{[['basic','基本'],['address','住所・連絡先'],['bank','口座・通勤'],['employment','雇用の条件']].map(([id,label])=><button type="button" role="tab" aria-selected={editTab===id} key={id} onClick={()=>setEditTab(id)}>{label}</button>)}</SystemTabs>
            {editTarget.created_at && (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }} onClick={(ev) => ev.stopPropagation()}>
        <Button variant="secondary" onClick={() => openHistory(editTarget)}>履歴を見る</Button>
        <Button
          variant="secondary"
          onClick={() => openRoleDialog(editTarget)}
          disabled={rootUser?.garden_role !== "super_admin" || editTarget.garden_role === "super_admin"}
          title={rootUser?.garden_role !== "super_admin" ? "Garden権限の変更は全権管理者のみ行えます" : editTarget.garden_role === "super_admin" ? "全権管理者のGarden権限は画面から変更できません" : undefined}
        >
          Garden 権限を変更する
        </Button>
        <Button variant={editTarget.is_active ? "danger" : "primary"} onClick={() => handleToggleActive(editTarget)} disabled={!canWrite} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>{editTarget.is_active ? "無効にする" : "有効にする"}</Button>
      </div>
            )}
            {!profileReady && editTarget.created_at && <p>履歴を読み込み中です。</p>}
            <div hidden={editTab!=='basic'}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px 0", color: colors.textMuted }}>基本情報</h3>
            <FormGrid cols={3}>
              <TextField label="従業員ID" required value={editTarget.employee_id} onChange={(e) => setEditTarget({ ...editTarget, employee_id: e.target.value })} disabled={!!editTarget.created_at} error={errors.employee_id} />
              <TextField label="社員番号" required value={editTarget.employee_number} onChange={(e) => setEditTarget({ ...editTarget, employee_number: e.target.value })} error={errors.employee_number} />
              <SelectField label="所属法人" required value={editTarget.company_id} onChange={(e) => setEditTarget({ ...editTarget, company_id: e.target.value })} error={errors.company_id}>
                {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
              </SelectField>
              <TextField label="氏名" required value={editTarget.name} onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })} error={errors.name} />
              <TextField label="氏名カナ" required value={editTarget.name_kana} onChange={(e) => setEditTarget({ ...editTarget, name_kana: e.target.value })} error={errors.name_kana} />
              <TextField label="公式 LINE の連絡先" type="url" value={editTarget.line_contact_url || ""} onChange={(e) => setEditTarget({ ...editTarget, line_contact_url: e.target.value })} />
              <TextField label="メールアドレス" required type="email" value={editTarget.email} onChange={(e) => setEditTarget({ ...editTarget, email: e.target.value })} error={errors.email} />
              <SelectField label="雇用形態" required value={editTarget.employment_type} onChange={(e) => setEditTarget({
                ...editTarget,
                employment_type: e.target.value,
                // 外注以外を選ぶと契約終了日をクリア
                contract_end_on: e.target.value === "outsource" ? (editTarget.contract_end_on ?? null) : null,
              })} error={errors.employment_type}>
                {EMP_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </SelectField>
              <SelectField label="給与体系" required value={editTarget.salary_system_id} onChange={(e) => setEditTarget({ ...editTarget, salary_system_id: e.target.value })} error={errors.salary_system_id}>
                {salarySystems.map((s) => <option key={s.salary_system_id} value={s.salary_system_id}>{s.system_name}</option>)}
              </SelectField>
              <SelectField label="社会保険区分" required value={editTarget.insurance_type} onChange={(e) => setEditTarget({ ...editTarget, insurance_type: e.target.value })} error={errors.insurance_type}>
                {INS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectField>
              <GardenRoleField
                operatorRole={rootUser?.garden_role}
                value={editTarget.garden_role ?? "staff"}
                onChange={(gardenRole) => setEditTarget({ ...editTarget, garden_role: gardenRole })}
              />
              <TextField label="入社日" required type="date" value={editTarget.hire_date} onChange={(e) => setEditTarget({ ...editTarget, hire_date: e.target.value })} error={errors.hire_date} />
              <TextField label="生年月日" type="date" value={editTarget.birthday ?? ""} onChange={e=>setEditTarget({...editTarget,birthday:e.target.value || null})} />
              <TextField label="退職日" type="date" value={editTarget.termination_date ?? ""} onChange={(e) => {
                const next = { ...editTarget, termination_date: e.target.value || null };
                setEditTarget(next);
                // 保存失敗後に退職日を入力した場合も、不要になった必須エラーを直ちに消す。
                if (hasErrors(errors)) {
                  const nextErrors = validateEmployee(next);
                  setErrors(nextErrors);
                  if (!hasErrors(nextErrors) && error === VALIDATION_ERROR_BANNER) setError(null);
                }
              }} error={errors.termination_date} />
              {editTarget.employment_type === "outsource" && (
                <TextField
                  label="契約終了日（外注）"
                  type="date"
                  value={editTarget.contract_end_on ?? ""}
                  onChange={(e) => setEditTarget({ ...editTarget, contract_end_on: e.target.value || null })}
                  error={errors.contract_end_on}
                />
              )}
            </FormGrid>

            <KitFormRow label="事業"><KitSelectField aria-label="事業" disabled={!canWrite} value={editTarget.business || ''} onChange={e=>setEditTarget({...editTarget,business:e.target.value || null})}>{BUSINESSES.map(b=><option key={b}>{b}</option>)}</KitSelectField></KitFormRow>
            {editTarget.created_at && <TeamHistoryPanel employeeId={editTarget.employee_id} canWrite={canWrite} onChanged={()=>{void fetchEmployees().then(setEmployees).catch(e=>setError(e.message));}}/>}
            </div>
            <div hidden={editTab!=='address'}><RosterProfileFields categories={['address','contact']} draft={profileDraft} onChange={changeProfile} disabled={!canWrite || !profileReady}/></div>
            <div hidden={editTab!=='employment'}><RosterProfileFields categories={['employment']} draft={profileDraft} onChange={changeProfile} disabled={!canWrite || !profileReady}/></div>
            <div hidden={editTab!=='bank'}>

            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px 0", color: colors.textMuted }}>口座1</h3>
            <FormGrid cols={3}>
              <TextField label="銀行名" required={bankRequired} value={editTarget.bank_name} onChange={(e) => setEditTarget({ ...editTarget, bank_name: e.target.value })} error={errors.bank_name} />
              <TextField label="金融機関コード（4桁）" required={bankRequired} maxLength={4} inputMode="numeric" value={editTarget.bank_code} onChange={(e) => setEditTarget({ ...editTarget, bank_code: e.target.value })} error={errors.bank_code} />
              <FieldLabel label="口座種別"><RadioGroup name="bank-account-type" label="口座種別" required={bankRequired} options={ACCOUNT_TYPES} value={editTarget.account_type} onChange={value => setEditTarget({...editTarget,account_type:value})}/></FieldLabel>
              <TextField label="支店名" required={bankRequired} value={editTarget.branch_name} onChange={(e) => setEditTarget({ ...editTarget, branch_name: e.target.value })} error={errors.branch_name} />
              <TextField label="支店コード（3桁）" required={bankRequired} maxLength={3} inputMode="numeric" value={editTarget.branch_code} onChange={(e) => setEditTarget({ ...editTarget, branch_code: e.target.value })} error={errors.branch_code} />
              <TextField label="口座番号（7桁）" required={bankRequired} maxLength={7} inputMode="numeric" value={editTarget.account_number} onChange={(e) => setEditTarget({ ...editTarget, account_number: e.target.value })} error={errors.account_number} />
              <TextField label="口座名義" required={bankRequired} value={editTarget.account_holder} onChange={(e) => setEditTarget({ ...editTarget, account_holder: e.target.value })} error={errors.account_holder} />
              <TextField label="口座名義カナ" required={bankRequired} value={editTarget.account_holder_kana} onChange={(e) => setEditTarget({ ...editTarget, account_holder_kana: e.target.value })} error={errors.account_holder_kana} />
            </FormGrid>

            <RosterProfileFields categories={['sub_account','commute']} draft={profileDraft} onChange={changeProfile} disabled={!canWrite || !profileReady}/>
            </div><div hidden={editTab!=='basic'}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px 0", color: colors.textMuted }}>給与・源泉徴収</h3>
            <FormGrid>
              <SelectField
                label="年末調整 甲/乙欄"
                value={editTarget.kou_otsu ?? ""}
                onChange={(e) => setEditTarget({
                  ...editTarget,
                  kou_otsu: (e.target.value || null) as "kou" | "otsu" | null,
                })}
                error={errors.kou_otsu}
              >
                {KOU_OTSU_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectField>
              <TextField
                label="扶養家族人数（0〜20）"
                type="number"
                min={0}
                max={20}
                step={1}
                value={editTarget.dependents_count ?? 0}
                onChange={(e) => setEditTarget({
                  ...editTarget,
                  dependents_count: e.target.value === "" ? 0 : Number(e.target.value),
                })}
                error={errors.dependents_count}
              />
            </FormGrid>

            {rootUser?.garden_role === "super_admin" && editTarget.created_at && <KotEmployeePanel key={editTarget.employee_id} employeeId={editTarget.employee_id} name={editTarget.name} />}
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px 0", color: colors.textMuted }}>外部ID連携</h3>
            <FormGrid>
              <TextField label="キングオブタイムID" value={editTarget.kot_employee_id ?? ""} onChange={(e) => setEditTarget({ ...editTarget, kot_employee_id: e.target.value || null })} />
              <TextField
                label="INNOVERA 内線番号（PC）"
                maxLength={6}
                inputMode="numeric"
                value={editTarget.innovera_extension ?? ""}
                onChange={(e) => setEditTarget({ ...editTarget, innovera_extension: e.target.value || null })}
                error={errors.innovera_extension}
              />
              <TextField
                label="INNOVERA 内線番号（モバイル）"
                maxLength={6}
                inputMode="numeric"
                value={editTarget.innovera_mobile_extension ?? ""}
                onChange={(e) => setEditTarget({ ...editTarget, innovera_mobile_extension: e.target.value || null })}
                error={errors.innovera_mobile_extension}
              />
              <TextField
                label="FileMaker 社員名"
                value={editTarget.filemaker_employee_name ?? ""}
                onChange={(e) => setEditTarget({ ...editTarget, filemaker_employee_name: e.target.value.trim() || null })}
                error={errors.filemaker_employee_name}
              />
              <TextField label="マネーフォワード クラウド給与 ID" value={editTarget.mf_employee_id ?? ""} onChange={(e) => setEditTarget({ ...editTarget, mf_employee_id: e.target.value || null })} />
            </FormGrid>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px 0", color: colors.textMuted }}>INNOVERA履歴・録音</h3>
            <FormGrid>
              <SelectField
                label="INNOVERA録音の権限"
                value={editTarget.call_recording_access ?? "default"}
                onChange={(e) => setEditTarget({
                  ...editTarget,
                  call_recording_access: e.target.value as CallRecordingOverride,
                })}
                error={errors.call_recording_access}
              >
                {CALL_RECORDING_OVERRIDE_OPTIONS.map((value) => (
                  <option key={value} value={value}>{CALL_RECORDING_OVERRIDE_LABELS[value]}</option>
                ))}
              </SelectField>
            </FormGrid>
            <div style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.6, marginTop: -8, marginBottom: 12 }}>
              既定では、マネージャー以上は全員の通話と録音、社員・業務委託は全員の履歴と自分の録音、CSは自分の通話と録音、クローザー・トスは使わせない設定です。ここで変更すると役職より優先されます。
            </div>
            <TextField
              label="Chatwork ID"
              inputMode="numeric"
              maxLength={12}
              value={editTarget.chatwork_account_id ?? ""}
              onChange={(e) => setEditTarget({ ...editTarget, chatwork_account_id: e.target.value.trim() || null })}
              error={errors.chatwork_account_id}
            />
            <p style={{ color: colors.textMuted, fontSize: 12 }}>
              通知の宛先（TO）に使う番号です。Chatwork のプロフィールに出る数字を入れます
            </p>
            {canManageChatworkToken && editTarget.created_at && (
              <section style={{ marginTop: 16, padding: 12, border: `1px solid ${colors.border}`, borderRadius: 6, background: colors.bgPanel }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px 0", color: colors.textMuted }}>Chatwork 連携</h3>
                <div style={{ fontSize: 13, color: colors.text, marginBottom: 10 }}>
                  状態：{chatworkTokenLoading ? "確認中" : chatworkTokenStatus.registered ? (
                    <>
                      登録済み
                      {chatworkTokenStatus.accountName && `（Chatwork 表示名：${chatworkTokenStatus.accountName}${chatworkTokenStatus.updatedAt ? `・${formatChatworkTokenUpdatedAt(chatworkTokenStatus.updatedAt)}` : ""}）`}
                    </>
                  ) : "未登録"}
                  {chatworkTokenStatus.registered && (
                    <Button
                      variant="secondary"
                      onClick={handleChatworkTokenDelete}
                      disabled={chatworkTokenSaving}
                      style={{ marginLeft: 12 }}
                    >
                      削除
                    </Button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
                  <TextField
                    label="API トークン"
                    type="password"
                    autoComplete="off"
                    value={chatworkTokenInput}
                    onChange={(e) => setChatworkTokenInput(e.target.value)}
                  />
                  <Button onClick={handleChatworkTokenSave} disabled={chatworkTokenSaving || !chatworkTokenInput.trim()}>
                    {chatworkTokenSaving ? "確認中..." : "接続を確認して保存"}
                  </Button>
                </div>
                {chatworkTokenError && (
                  <div role="alert" style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 10px", borderRadius: 4, marginBottom: 8, fontSize: 13 }}>
                    {chatworkTokenError}
                  </div>
                )}
                <div style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.6 }}>
                  ※ 本人が Chatwork の「サービス連携 → API Token」で発行したものを貼ります。<br />
                  Kintone 従業員名簿に登録がある人は名簿からの取り込みが優先されます
                </div>
              </section>
            )}
            <TextareaField label="備考" value={editTarget.notes ?? ""} onChange={(e) => setEditTarget({ ...editTarget, notes: e.target.value || null })} />

            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, borderTop: `1px solid ${colors.border}`, paddingTop: 16 }}>
              <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={saving}>キャンセル</Button>
              <Button onClick={handleSave} disabled={saving || !canWrite || (!!editTarget.created_at && !profileReady)} title={!canWrite ? "編集権限がありません（管理者以上）" : undefined}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
