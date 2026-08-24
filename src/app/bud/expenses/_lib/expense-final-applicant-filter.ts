export function buildFinalApplicantOptions<T>(rows: T[], applicantName: (row: T) => string) {
  return Array.from(new Set(rows.map(applicantName))).sort((left, right) => left.localeCompare(right, "ja"));
}

export function filterFinalRowsByApplicant<T>(rows: T[], filter: string, applicantName: (row: T) => string) {
  if (filter === "all") return rows;
  return rows.filter((row) => applicantName(row) === filter);
}
