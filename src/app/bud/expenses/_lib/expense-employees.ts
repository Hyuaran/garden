export type ExpenseEmployeeLookupRow = {
  employee_id: string;
  company_id: string | null;
  name: string | null;
  user_id?: string | null;
  expense_default_corp_id?: string | null;
};

type ExpenseEmployeeLookupOptions = {
  employeeIds: string[];
  userIds?: string[];
  supabase?: unknown;
};

export async function fetchExpenseEmployeeLookup({
  employeeIds,
  userIds = [],
  supabase,
}: ExpenseEmployeeLookupOptions): Promise<{
  employees: ExpenseEmployeeLookupRow[];
  userEmployees: ExpenseEmployeeLookupRow[];
}> {
  const uniqueEmployeeIds = uniqueNonEmpty(employeeIds);
  const uniqueUserIds = uniqueNonEmpty(userIds);
  if (uniqueEmployeeIds.length === 0 && uniqueUserIds.length === 0) {
    return { employees: [], userEmployees: [] };
  }

  let employees: ExpenseEmployeeLookupRow[] = [];
  let userEmployees: ExpenseEmployeeLookupRow[] = [];
  try {
    const res = await fetch("/api/bud/expense-employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeIds: uniqueEmployeeIds, userIds: uniqueUserIds }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      employees?: ExpenseEmployeeLookupRow[];
      userEmployees?: ExpenseEmployeeLookupRow[];
    };
    if (res.ok && json.ok) {
      employees = Array.isArray(json.employees) ? json.employees : [];
      userEmployees = Array.isArray(json.userEmployees) ? json.userEmployees : [];
    }
  } catch {
    employees = [];
    userEmployees = [];
  }

  if (employees.length === 0 && uniqueEmployeeIds.length > 0 && supabase) {
    const fallbackClient = supabase as {
      from: (table: "root_employees") => {
        select: (columns: string) => {
          in: (column: "employee_id", values: string[]) => PromiseLike<{ data: ExpenseEmployeeLookupRow[] | null }>;
        };
      };
    };
    const fallback = await fallbackClient.from("root_employees").select("employee_id,company_id,name").in("employee_id", uniqueEmployeeIds);
    employees = fallback.data ?? [];
  }

  return { employees, userEmployees };
}

export function buildEmployeeMap<T extends ExpenseEmployeeLookupRow>(employees: T[]) {
  const map: Record<string, T> = {};
  for (const employee of employees) {
    map[employee.employee_id] = employee;
  }
  return map;
}

export function buildUserNameMap(employees: ExpenseEmployeeLookupRow[]) {
  const map: Record<string, string> = {};
  for (const employee of employees) {
    if (employee.user_id && employee.name) map[employee.user_id] = employee.name;
  }
  return map;
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}
