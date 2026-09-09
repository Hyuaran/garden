"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GARDEN_ROLE_LABELS,
  GARDEN_ROLE_ORDER,
  type Employee,
  type GardenRole,
} from "../_constants/types";
import { colors } from "../_constants/colors";
import { PageHeader } from "../_components/PageHeader";
import { Button } from "../_components/Button";
import { DataTable, type Column } from "../_components/DataTable";
import { StatusBadge } from "../_components/StatusBadge";
import { fetchEmployees } from "../_lib/queries";

export type PermissionMatrixRow = {
  key: string;
  label: string;
  group: "System" | "Root" | "API";
  kind: "画面" | "タブ" | "操作" | "API";
  source: string;
  roles: Record<GardenRole, boolean>;
};

type EmployeePermissionRow = {
  employee_number: string;
  name: string;
  employment_type: string;
  garden_role: GardenRole;
  is_active: boolean;
};

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function roleLabel(role: GardenRole) {
  return GARDEN_ROLE_LABELS[role];
}

function isRosterHistoryRow(employee: Employee) {
  return /^R/i.test(employee.employee_number);
}

function toEmployeeRow(employee: Employee): EmployeePermissionRow {
  return {
    employee_number: employee.employee_number,
    name: employee.name,
    employment_type: employee.employment_type === "outsource" ? "外注" : employee.employment_type,
    garden_role: employee.garden_role ?? "staff",
    is_active: employee.is_active,
  };
}

export function buildCsv(permissionRows: PermissionMatrixRow[], employeeRows: EmployeePermissionRow[]) {
  const lines: string[] = [];
  lines.push("役職ごとに使える画面");
  lines.push(["画面／機能", "区分", ...GARDEN_ROLE_ORDER.map(roleLabel)].map(escapeCsvCell).join(","));
  permissionRows.forEach((row) => {
    lines.push([
      row.label,
      row.kind,
      ...GARDEN_ROLE_ORDER.map((role) => row.roles[role] ? "○" : "×"),
    ].map(escapeCsvCell).join(","));
  });
  lines.push("");
  lines.push("人ごとの役職");
  lines.push(["社員番号", "氏名", "雇用形態", "役職", "状態"].map(escapeCsvCell).join(","));
  employeeRows.forEach((employee) => {
    lines.push([
      employee.employee_number,
      employee.name,
      employee.employment_type,
      roleLabel(employee.garden_role),
      employee.is_active ? "有効" : "無効",
    ].map(escapeCsvCell).join(","));
  });
  return `\uFEFF${lines.join("\r\n")}`;
}

export default function PermissionsClient({
  initialPermissionRows,
}: {
  initialPermissionRows: PermissionMatrixRow[];
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<"" | GardenRole>("");
  const [activeOnly, setActiveOnly] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const rows = await fetchEmployees();
        if (!cancelled) setEmployees(rows);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "従業員を読み込めませんでした");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const employeeRows = useMemo(() => {
    return employees
      .filter((employee) => !isRosterHistoryRow(employee))
      .filter((employee) => !activeOnly || employee.is_active)
      .filter((employee) => !filterRole || (employee.garden_role ?? "staff") === filterRole)
      .sort((left, right) => left.employee_number.localeCompare(right.employee_number, "ja", { numeric: true }))
      .map(toEmployeeRow);
  }, [activeOnly, employees, filterRole]);

  const employeeColumns: Column<EmployeePermissionRow>[] = [
    { key: "number", header: "社員番号", render: (employee) => employee.employee_number, width: 100 },
    { key: "name", header: "氏名", render: (employee) => employee.name, width: 160 },
    { key: "employment", header: "雇用形態", render: (employee) => employee.employment_type, width: 120 },
    { key: "role", header: "役職", render: (employee) => roleLabel(employee.garden_role), width: 120 },
    { key: "status", header: "状態", render: (employee) => <StatusBadge active={employee.is_active} />, width: 90, align: "center" },
  ];

  function handleCsvExport() {
    const csv = buildCsv(initialPermissionRows, employeeRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "root-permissions.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="権限一覧"
        description="役職ごとに使える画面と、Root 従業員マスタ上の人ごとの役職を確認します。"
        actions={<Button variant="secondary" onClick={handleCsvExport}>CSV 書き出し</Button>}
      />

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 16, color: colors.text }}>
          役職ごとに使える画面
        </h2>
        <div style={{ background: colors.bgPanel, border: `1px solid ${colors.border}`, borderRadius: 6, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
                <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, whiteSpace: "nowrap" }}>画面／機能</th>
                <th style={{ textAlign: "left", padding: "10px 12px", color: colors.textMuted, whiteSpace: "nowrap" }}>区分</th>
                {GARDEN_ROLE_ORDER.map((role) => (
                  <th key={role} style={{ textAlign: "center", padding: "10px 12px", color: colors.textMuted, whiteSpace: "nowrap" }}>
                    {roleLabel(role)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialPermissionRows.map((row) => (
                <tr key={row.key} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: "10px 12px", color: colors.text, whiteSpace: "nowrap" }}>{row.label}</td>
                  <td style={{ padding: "10px 12px", color: colors.textMuted, whiteSpace: "nowrap" }}>{row.kind}</td>
                  {GARDEN_ROLE_ORDER.map((role) => {
                    const allowed = row.roles[role];
                    return (
                      <td key={role} style={{ padding: "10px 12px", textAlign: "center", color: allowed ? colors.success : colors.textMuted, fontWeight: allowed ? 700 : 500 }}>
                        {allowed ? "○" : "×"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "8px 0 0", color: colors.textMuted, fontSize: 12 }}>
          ○＝使える　×＝使えない。Bud・Forest・Bloom は各モジュールの権限で管理。
        </p>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 16, color: colors.text }}>人ごとの役職</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", color: colors.text, fontSize: 13 }}>
              役職で絞る
              <select
                value={filterRole}
                onChange={(event) => setFilterRole(event.target.value as "" | GardenRole)}
                style={{ padding: "6px 10px", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13 }}
              >
                <option value="">すべて</option>
                {GARDEN_ROLE_ORDER.map((role) => (
                  <option key={role} value={role}>{roleLabel(role)}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", color: colors.text, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
              />
              在籍中だけ
            </label>
          </div>
        </div>
        {error && (
          <div role="alert" style={{ background: colors.dangerBg, color: colors.danger, padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 13 }}>
            {error}
          </div>
        )}
        {loading ? (
          <div style={{ color: colors.textMuted, padding: 40, textAlign: "center" }}>読込中...</div>
        ) : (
          <DataTable columns={employeeColumns} rows={employeeRows} />
        )}
      </section>
    </>
  );
}
