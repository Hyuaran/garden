export const COMPANY_SLUGS = {
  hyuaran: "COMP-001",
  centerrise: "COMP-002",
  "link-support": "COMP-003",
  arata: "COMP-004",
  taiyou: "COMP-005",
  ichi: "COMP-006",
  stonebase: "COMP-007",
} as const;

export type CompanySlug = keyof typeof COMPANY_SLUGS;

export function companyIdFromSlug(slug: string): string | null {
  return Object.prototype.hasOwnProperty.call(COMPANY_SLUGS, slug)
    ? COMPANY_SLUGS[slug as CompanySlug]
    : null;
}
