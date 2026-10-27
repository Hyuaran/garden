import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261027000455_relay_agent_rpc.sql", "utf8").toLowerCase();

describe("relay agent RPC migration", () => {
  it("authenticates both definer functions with the stored hash and fixed search path", () => {
    expect(sql).toContain("add column if not exists agent_secret_hash text");
    for (const name of ["pull", "result"]) expect(sql).toContain(`function public.system_relay_agent_${name}(`);
    expect(sql.match(/security definer/g)).toHaveLength(2);
    expect(sql.match(/set search_path = public, extensions/g)).toHaveLength(2);
    expect(sql.match(/encode\(extensions.digest\(p_secret, 'sha256'\), 'hex'\) is distinct from secret_hash/g)).toHaveLength(2);
    expect(sql.match(/raise exception 'unauthorized'/g)).toHaveLength(2);
    expect(sql.match(/nullif\(secret_hash, ''\) is null or p_secret is null/g)).toHaveLength(2);
  });
  it("claims unexpired jobs atomically and preserves heartbeat notification state", () => {
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("where status = 'queued' and expires_at <= now()");
    expect(sql).toContain("where status = 'queued' and expires_at > now()");
    expect(sql).toContain("order by created_at asc limit 1");
    expect(sql).toContain("set status = 'running', started_at = now()");
    expect(sql).toContain("set last_seen_at = now(), agent_version = p_agent_version, updated_at = now()");
    expect(sql).not.toContain("notified_down_at =");
    expect(sql).toContain("coalesce(nullif(p_error, ''), 'relay_failed')");
    expect(sql).toContain("return found;");
  });
  it("grants anon only RPC execution after revoking public execution", () => {
    for (const signature of ["pull(text, text)", "result(text, uuid, boolean, jsonb, text)"]) {
      const revoke = `revoke all on function public.system_relay_agent_${signature} from public;`;
      const grant = `grant execute on function public.system_relay_agent_${signature} to anon;`;
      expect(sql).toContain(revoke);
      expect(sql).toContain(grant);
      expect(sql.indexOf(revoke)).toBeLessThan(sql.indexOf(grant));
    }
    expect(sql.match(/grant\s+[^;]+\s+to\s+anon/g)).toHaveLength(2);
    expect(sql).not.toMatch(/grant\s+(?:all|select|insert|update|delete|references|trigger)\b/);
  });
});