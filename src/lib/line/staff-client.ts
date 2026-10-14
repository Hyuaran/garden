const LINE_STAFF_API_BASE = "https://api.line.me/v2/bot";

type FetchImpl = typeof fetch;

type LineStaffOptions = {
  fetchImpl?: FetchImpl;
  token?: string;
};

function accessToken(options?: LineStaffOptions) {
  const token = options?.token ?? process.env.LINE_STAFF_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("line_staff:token_missing");
  return token;
}

async function lineStaffFetch(path: string, init: RequestInit, options?: LineStaffOptions) {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const response = await fetchImpl(`${LINE_STAFF_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken(options)}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`line_staff:http ${response.status}`);
  return response;
}

export async function replyLineStaff(replyToken: string, text: string, options?: LineStaffOptions) {
  await lineStaffFetch("/message/reply", {
    method: "POST",
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  }, options);
}

export async function pushLineStaff(userIds: string[], text: string, options?: LineStaffOptions) {
  if (userIds.length === 0) return;
  await lineStaffFetch("/message/multicast", {
    method: "POST",
    body: JSON.stringify({
      to: userIds.slice(0, 500),
      messages: [{ type: "text", text }],
    }),
  }, options);
}

export async function getLineStaffProfile(userId: string, options?: LineStaffOptions) {
  const response = await lineStaffFetch(`/profile/${encodeURIComponent(userId)}`, { method: "GET" }, options);
  const body = await response.json().catch(() => ({})) as { displayName?: unknown };
  return { displayName: typeof body.displayName === "string" ? body.displayName : "" };
}

export async function getLineStaffQuota(options?: LineStaffOptions) {
  const [quotaResponse, usageResponse] = await Promise.all([
    lineStaffFetch("/message/quota", { method: "GET" }, options),
    lineStaffFetch("/message/quota/consumption", { method: "GET" }, options),
  ]);
  const quotaBody = await quotaResponse.json().catch(() => ({})) as { type?: unknown; value?: unknown };
  const usageBody = await usageResponse.json().catch(() => ({})) as { totalUsage?: unknown };
  const quota = quotaBody.type === "limited" && typeof quotaBody.value === "number" ? quotaBody.value : null;
  const used = typeof usageBody.totalUsage === "number" ? usageBody.totalUsage : 0;
  return {
    quota,
    used,
    remaining: quota === null ? null : Math.max(0, quota - used),
  };
}
