import { getSupabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "bud-attachments";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const GRAPH_FILE_ATTACHMENT_TYPE = "#microsoft.graph.fileAttachment";
const SUPPORTED_ATTACHMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

type GraphTokenResponse = { access_token: string };
type GraphListResponse<T> = { value?: T[] };
type GraphMessage = {
  id: string;
  subject?: string | null;
  from?: { emailAddress?: { address?: string | null; name?: string | null } | null } | null;
  receivedDateTime?: string | null;
  hasAttachments?: boolean | null;
};
type GraphAttachment = {
  "@odata.type"?: string;
  id?: string;
  name?: string | null;
  contentType?: string | null;
  contentBytes?: string | null;
};

export type MailImportResult = {
  driveFileId: string;
  fileName: string;
  status: "imported" | "skipped" | "failed" | "unsupported";
  error?: string;
};

export type MailImportSummary =
  | {
      ok: true;
      skipped: true;
      reason: "not configured";
      total: 0;
      imported: 0;
      skippedCount: 0;
      failed: 0;
      unsupported: 0;
      results: MailImportResult[];
    }
  | {
      ok: true;
      total: number;
      imported: number;
      skipped: number;
      failed: number;
      unsupported: number;
      results: MailImportResult[];
    };

export function isSupportedMailAttachment(attachment: Pick<GraphAttachment, "@odata.type" | "contentType" | "contentBytes">) {
  return (
    attachment["@odata.type"] === GRAPH_FILE_ATTACHMENT_TYPE &&
    Boolean(attachment.contentBytes) &&
    Boolean(attachment.contentType && SUPPORTED_ATTACHMENT_TYPES.has(attachment.contentType))
  );
}

export function buildMailInboxDriveFileId(messageId: string, attachmentId: string) {
  return `mail:${messageId}:${attachmentId}`;
}

export async function importTransferInboxFromMail(): Promise<MailImportSummary> {
  const config = readGraphConfig();
  if (!config) {
    return {
      ok: true,
      skipped: true,
      reason: "not configured",
      total: 0,
      imported: 0,
      skippedCount: 0,
      failed: 0,
      unsupported: 0,
      results: [],
    };
  }

  const supabase = getSupabaseAdmin();
  const token = await getGraphAccessToken(config);
  const messages = await listMessages(config.mailbox, token);
  const results: MailImportResult[] = [];

  for (const message of messages) {
    const attachments = await listAttachments(config.mailbox, message.id, token);
    for (const attachment of attachments) {
      const fileName = attachment.name ?? "attachment";
      const attachmentId = attachment.id ?? "";
      const driveFileId = attachmentId ? buildMailInboxDriveFileId(message.id, attachmentId) : `mail:${message.id}:`;

      if (!attachmentId || !isSupportedMailAttachment(attachment)) {
        results.push({ driveFileId, fileName, status: "unsupported" });
        continue;
      }

      try {
        const { data: existing, error: existingError } = await supabase
          .from("bud_transfer_inbox")
          .select("id")
          .eq("drive_file_id", driveFileId)
          .maybeSingle();

        if (existingError) throw existingError;
        if (existing) {
          results.push({ driveFileId, fileName, status: "skipped" });
          continue;
        }

        const buffer = Buffer.from(attachment.contentBytes ?? "", "base64");
        const storagePath = buildMailStoragePath(message.id, attachmentId, fileName);
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, buffer, {
            contentType: attachment.contentType ?? "application/octet-stream",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);

        const { error: insertError } = await supabase
          .from("bud_transfer_inbox")
          .insert({
            drive_file_id: driveFileId,
            file_name: fileName,
            mime_type: attachment.contentType,
            storage_path: storagePath,
            public_url: publicData.publicUrl,
            imported_at: message.receivedDateTime ?? new Date().toISOString(),
            status: "pending",
            source: "mail",
            mail_meta: {
              message_id: message.id,
              attachment_id: attachmentId,
              from: formatSender(message),
              subject: message.subject ?? null,
              received_at: message.receivedDateTime ?? null,
            },
          });
        if (insertError) throw insertError;

        results.push({ driveFileId, fileName, status: "imported" });
      } catch (error) {
        results.push({
          driveFileId,
          fileName,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    ok: true,
    total: results.length,
    imported: results.filter((result) => result.status === "imported").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    unsupported: results.filter((result) => result.status === "unsupported").length,
    results,
  };
}

function readGraphConfig() {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
  const mailbox = process.env.BUD_INVOICE_MAILBOX;
  if (!tenantId || !clientId || !clientSecret || !mailbox) return null;
  return { tenantId, clientId, clientSecret, mailbox };
}

async function getGraphAccessToken(config: NonNullable<ReturnType<typeof readGraphConfig>>) {
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  if (!res.ok) throw new Error(`Graph token error: ${res.status} ${await res.text()}`);
  return ((await res.json()) as GraphTokenResponse).access_token;
}

async function listMessages(mailbox: string, token: string) {
  // NOTE: $filter=hasAttachments と $orderby の併用は Graph が InefficientFilter (400) で拒否する
  // （2026-07-06 実測）。既定ソートが receivedDateTime desc のため、素の一覧を取得して
  // hasAttachments はクライアント側で絞る。
  const params = new URLSearchParams({
    "$top": "25",
    "$select": "id,subject,from,receivedDateTime,hasAttachments",
  });
  const res = await graphFetch(`/users/${encodeURIComponent(mailbox)}/messages?${params.toString()}`, token);
  if (!res.ok) throw new Error(`Graph messages error: ${res.status} ${await res.text()}`);
  const messages = ((await res.json()) as GraphListResponse<GraphMessage>).value ?? [];
  return messages.filter((message) => message.hasAttachments === true);
}

async function listAttachments(mailbox: string, messageId: string, token: string) {
  const res = await graphFetch(
    `/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(messageId)}/attachments`,
    token,
  );
  if (!res.ok) throw new Error(`Graph attachments error: ${res.status} ${await res.text()}`);
  return ((await res.json()) as GraphListResponse<GraphAttachment>).value ?? [];
}

async function graphFetch(path: string, token: string) {
  return fetch(`${GRAPH_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function buildMailStoragePath(messageId: string, attachmentId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `transfer-inbox/mail/${messageId}/${attachmentId}_${safeName}`;
}

function formatSender(message: GraphMessage) {
  const address = message.from?.emailAddress?.address ?? null;
  const name = message.from?.emailAddress?.name ?? null;
  if (name && address) return `${name} <${address}>`;
  return name ?? address;
}
