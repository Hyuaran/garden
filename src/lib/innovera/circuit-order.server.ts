import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { InnoveraCircuit } from "./client";

export type CircuitSummary = { id: string; name: string; number: string; freeNumber: string; circuitNum: string };
export type CircuitGroup = { id: string | null; name: string; circuits: CircuitSummary[] };
export type CircuitOrderInput = { groups: { id?: string; name: string; circuitIds: string[] }[]; other: string[] };
export function circuitSummary(c: InnoveraCircuit): CircuitSummary {
  const text = (v: unknown) => v == null ? "" : String(v);
  return { id: text(c.id), name: text(c.name), number: text(c.number), freeNumber: text(c.free_number), circuitNum: text(c.circuit_num) };
}
export function validateCircuitOrder(value: unknown): value is CircuitOrderInput {
  if (!value || typeof value !== "object") return false;
  const body = value as CircuitOrderInput;
  if (!Array.isArray(body.groups) || !Array.isArray(body.other)) return false;
  const names = new Set<string>(), ids = new Set<string>(), circuits = new Set<string>();
  const checkIds = (values: unknown) => Array.isArray(values) && values.every(id => {
    if (typeof id !== "string" || !id.trim() || circuits.has(id)) return false;
    circuits.add(id); return true;
  });
  for (const g of body.groups) {
    if (!g || typeof g.name !== "string" || !g.name || g.name !== g.name.trim() || [...g.name].length > 30 || names.has(g.name)) return false;
    names.add(g.name);
    if (g.id !== undefined) {
      if (typeof g.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(g.id) || ids.has(g.id)) return false;
      ids.add(g.id);
    }
    if (!checkIds(g.circuitIds)) return false;
  }
  return checkIds(body.other);
}

export async function orderedCircuits(circuits: InnoveraCircuit[]) {
  const db = getSupabaseAdmin();
  const [groups, positions] = await Promise.all([
    db.from("system_innovera_circuit_groups").select("id,name,sort_order").order("sort_order"),
    db.from("system_innovera_circuit_positions").select("circuit_id,group_id,sort_order").order("sort_order"),
  ]);
  if (groups.error || positions.error) throw new Error("回線の並び順を取得できませんでした");
  const byId = new Map(circuits.map(c => [String(c.id), circuitSummary(c)]));
  const used = new Set<string>();
  const take = (groupId: string | null) => (positions.data ?? []).filter(p => p.group_id === groupId).flatMap(p => {
    const c = byId.get(p.circuit_id);
    if (!c || used.has(c.id)) return [];
    used.add(c.id); return [c];
  });
  const circuitGroups: CircuitGroup[] = (groups.data ?? []).map(g => ({ id: g.id, name: g.name, circuits: take(g.id) }));
  const other = take(null);
  for (const c of byId.values()) if (!used.has(c.id)) other.push(c);
  if (other.length) circuitGroups.push({ id: null, name: "その他", circuits: other });
  return { circuits: circuitGroups.flatMap(g => g.circuits), circuitGroups };
}
