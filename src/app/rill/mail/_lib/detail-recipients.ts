export type GraphRecipient = { emailAddress?: { address?: string | null } | null };

export function detailRecipientAddresses(value: GraphRecipient[] | null | undefined) {
  return (value ?? [])
    .map((recipient) => recipient.emailAddress?.address?.trim() ?? "")
    .filter(Boolean);
}
