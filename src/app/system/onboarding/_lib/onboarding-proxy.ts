import { STEP_FIELDS, type OnboardingInput } from "./onboarding";

export const PROXY_PRIVATE_FIELDS = [...STEP_FIELDS[6], "my_number"] as const;
export const PROXY_RESTRICTED_MESSAGE = "この画面は全権管理者だけが代わりに入力できます";

export function proxyPayload(values: OnboardingInput, sensitive: boolean) {
  const payload: Record<string, unknown> = { ...values };
  if (!sensitive) {
    for (const key of PROXY_PRIVATE_FIELDS) delete payload[key];
    payload.dependents = values.dependents.map(({ my_number: _private, ...dependent }) => dependent);
  }
  return payload;
}

export function hasProxyPrivateInput(input: Record<string, unknown>) {
  return PROXY_PRIVATE_FIELDS.some(key => Object.hasOwn(input, key)) ||
    (Array.isArray(input.dependents) && input.dependents.some(row => row && typeof row === "object" && Object.hasOwn(row, "my_number")));
}
