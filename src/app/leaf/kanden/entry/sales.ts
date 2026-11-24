type SalesEmployee = {
  name: string | null;
  filemaker_employee_name: string | null;
};

export function normalizeSalesName(name: string | null | undefined) {
  return (name ?? "").replace(/[\uFE00-\uFE0F\u{E0100}-\u{E01EF}\s]/gu, "");
}

export function matchSalesEmployee<T extends SalesEmployee>(name: string, employees: T[]): T | null {
  const key = normalizeSalesName(name);
  if (!key) return null;
  const exact = employees.filter(employee => normalizeSalesName(employee.name) === key);
  const matches = exact.length ? exact : employees.filter(employee => {
    const [surname, givenName] = (employee.name ?? "").trim().split(/\s+/);
    return normalizeSalesName(employee.filemaker_employee_name) === key ||
      (givenName ? normalizeSalesName(surname) === key : normalizeSalesName(employee.name).startsWith(key));
  });
  return matches.length === 1 ? matches[0] : null;
}

export type SalesApplyCode = {
  apply_code: string;
  starts_on: string | null;
  ends_on: string | null;
};

export function selectApplyCode(caseCode: string | null, orderedOn: string | null, defaults: SalesApplyCode[]) {
  return caseCode?.trim() || defaults.find(rule =>
    (!rule.starts_on || (orderedOn && rule.starts_on <= orderedOn)) &&
    (!rule.ends_on || (orderedOn && rule.ends_on >= orderedOn)))?.apply_code || null;
}
