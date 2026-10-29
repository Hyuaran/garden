import { randomUUID } from 'node:crypto';
import { renderMenuImage } from './richmenu-image.server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { checked, loadLineData } from './tags.server';
import { chunks, type Employee } from './tags';
import { menuDefinition, menuGroup, menuGroups, resolveContacts, type Contact, type MenuGroup } from './richmenu';
import { lineStaffFetch } from './staff-client';

type MenuRow = { group_key: MenuGroup; richmenu_id: string; created_at: string; applied_at: string | null; active: boolean };
export async function loadMenuSettings(employees?: Employee[]) {
  const db = getSupabaseAdmin();
  const contacts = checked(await db.from('system_line_contact').select('*').order('key')).data as Contact[];
  const menus = checked(await db.from('system_line_richmenu').select('*').eq('active', true)).data as MenuRow[];
  return { contacts: resolveContacts(contacts, employees ?? (await loadLineData(false)).employees), menus };
}
async function assignments() {
  const rows: { line_user_id: string; richmenu_id: string }[] = [];
  for (let offset = 0;; offset += 1000) {
    const page = checked(await getSupabaseAdmin().from('system_line_richmenu_assignment').select('*').order('line_user_id').range(offset, offset + 999)).data!;
    rows.push(...page); if (page.length < 1000) return rows;
  }
}
export const menuTransport = {
  async create(body: ReturnType<typeof menuDefinition>['body']) {
    const response = await lineStaffFetch('/richmenu', { method: 'POST', body: JSON.stringify(body) });
    const result = await response.json();
    if (typeof result.richMenuId !== 'string') throw new Error('メニューを作成できませんでした。');
    return result.richMenuId as string;
  },
  async upload(id: string, image: string, contacts: Contact[] = []) {
    const group = image === 'guest_2' ? 'guest' : image as MenuGroup;
    const result = await renderMenuImage(group, contacts);
    await lineStaffFetch('/richmenu/' + encodeURIComponent(id) + '/content', { method: 'POST', headers: { 'Content-Type': result.contentType }, body: new Uint8Array(result.data) }, undefined, true);
  },
  async setDefault(id: string) { await lineStaffFetch('/user/all/richmenu/' + encodeURIComponent(id), { method: 'POST' }); },
  async link(id: string, userIds: string[]) { await lineStaffFetch('/richmenu/bulk/link', { method: 'POST', body: JSON.stringify({ richMenuId: id, userIds }) }); },
  async unlink(userId: string) { await lineStaffFetch('/user/' + encodeURIComponent(userId) + '/richmenu', { method: 'DELETE' }); },
  async remove(id: string) {
    try { await lineStaffFetch('/richmenu/' + encodeURIComponent(id), { method: 'DELETE' }); }
    catch (error) { if (!(error instanceof Error) || error.message !== 'line_staff:http 404') throw error; }
  },
};
type Transport = typeof menuTransport;
// Export the sequence separately so tests never contact LINE or a database.
export async function deployMenus(contacts: Contact[], groups: Map<MenuGroup, string[]>, oldIds: string[], staleUsers: string[], save: (row: { group_key: MenuGroup; richmenu_id: string }) => Promise<void>, publish: (ids: string[]) => Promise<void>, transport: Transport = menuTransport, record: (id:string, users:string[]) => Promise<void> = async()=>{}) {
  const created: { group_key: MenuGroup; richmenu_id: string }[] = [];
  for (const group of menuGroups) {
    const definition = menuDefinition(group, contacts, process.env.NEXT_PUBLIC_LIFF_SHIFT_ID);
    const id = await transport.create(definition.body);
    const row = { group_key: group, richmenu_id: id };
    await save(row); created.push(row);
    await transport.upload(id, group === 'guest' ? 'guest_2' : group, contacts);
  }
  await transport.setDefault(created.find(r => r.group_key === 'guest')!.richmenu_id);
  for (const row of created) for (const batch of chunks(groups.get(row.group_key) ?? [])) {
    await transport.link(row.richmenu_id, batch);
    await record(row.richmenu_id, batch);
  }
  for (const id of staleUsers) await transport.unlink(id);
  await publish(created.map(r => r.richmenu_id));
  // No deletion can occur until every assignment and the atomic publication succeed.
  for (const id of oldIds) await transport.remove(id);
  return created;
}
async function withMenuLock<T>(work: (renew: () => Promise<void>) => Promise<T>) {
  const db = getSupabaseAdmin(), owner = randomUUID();
  if (!checked(await db.rpc('system_line_menu_lock', { p_owner: owner })).data) throw new Error('反映中です。少し待ってからもう一度お試しください。');
  const renew = async () => { if (!checked(await db.rpc('system_line_menu_lock', { p_owner: owner })).data) throw new Error('反映を再開してください。'); };
  try { return await work(renew); }
  finally { checked(await db.rpc('system_line_menu_lock', { p_owner: owner, p_release: true })); }
}
function guardedTransport(renew: () => Promise<void>): Transport {
  return {
    async create(body) { await renew(); return menuTransport.create(body); },
    async upload(id, image, contacts) { await renew(); await menuTransport.upload(id, image, contacts); },
    async setDefault(id) { await renew(); await menuTransport.setDefault(id); },
    async link(id, users) { await renew(); await menuTransport.link(id, users); },
    async unlink(id) { await renew(); await menuTransport.unlink(id); },
    async remove(id) { await renew(); await menuTransport.remove(id); },
  };
}
function grouped(data: Awaited<ReturnType<typeof loadLineData>>) {
  const groups = new Map<MenuGroup, string[]>();
  for (const e of data.employees) {
    const group = menuGroup(e, data.tags, data.members);
    if (group === 'guest') continue;
    groups.set(group, [...(groups.get(group) ?? []), e.line_user_id!]);
  }
  for (const [key, ids] of groups) groups.set(key, [...new Set(ids)]);
  return groups;
}
export async function applyRichMenus() {
  return withMenuLock(async renew => {
    const db = getSupabaseAdmin(), data = await loadLineData();
    const { contacts } = await loadMenuSettings(data.employees);
    const old = checked(await db.from('system_line_richmenu').select('*')).data as MenuRow[];
    const groups = grouped(data), users = new Set([...groups.values()].flat());
    const previous = await assignments();
    const stale = [...new Set([...previous.map(r => r.line_user_id), ...data.employees.filter(e => e.line_user_id).map(e => e.line_user_id!)])].filter(id => !users.has(id));
    const created = await deployMenus(contacts, groups, old.map(r => r.richmenu_id), stale,
      async row => { checked(await db.from('system_line_richmenu').insert(row)); },
      async ids => {
        await renew();
        checked(await db.rpc('system_line_menu_publish', { p_ids: ids }));
        for (const batch of chunks(stale)) checked(await db.from('system_line_richmenu_assignment').delete().in('line_user_id', batch));
      }, guardedTransport(renew), async (richmenu_id, users) => {
        checked(await db.from('system_line_richmenu_assignment').upsert(users.map(line_user_id => ({line_user_id,richmenu_id,updated_at:new Date().toISOString()}))));
      });
    for (const batch of chunks(old.map(r => r.richmenu_id))) checked(await db.from('system_line_richmenu').delete().in('richmenu_id', batch));
    return created;
  });
}
// Event-driven only. Persisted assignments make repeated calls idempotent and retain old IDs after unlinking.
export async function syncRichMenus(employeeId?: string) {
  const data = await loadLineData(true, employeeId);
  const { menus } = await loadMenuSettings(data.employees);
  if (!menus.length) return; // Preparation stage: never create or activate menus automatically.
  return withMenuLock(async renew => {
    const db = getSupabaseAdmin(), current = (await loadMenuSettings(data.employees)).menus;
    if (employeeId) data.employees = data.employees.filter(e=>e.employee_id===employeeId);
    const groups = grouped(data), previous = await assignments();
    const wanted = new Set([...groups.values()].flat());
    for (const [group, ids] of groups) {
      const menu = current.find(m => m.group_key === group);
      if (!menu) throw new Error('連絡先の画面からリッチメニューに反映してください。');
      const changed = ids.filter(id => !previous.some(r => r.line_user_id === id && r.richmenu_id === menu.richmenu_id));
      for (const batch of chunks(changed)) {
        await renew();
        await menuTransport.link(menu.richmenu_id, batch);
        checked(await db.from('system_line_richmenu_assignment').upsert(batch.map(line_user_id => ({ line_user_id, richmenu_id: menu.richmenu_id, updated_at: new Date().toISOString() }))));
      }
    }
    for (const row of previous.filter(r => !wanted.has(r.line_user_id) && (!employeeId || data.employees.some(e=>e.line_user_id===r.line_user_id)))) {
      await renew();
      await menuTransport.unlink(row.line_user_id);
      checked(await db.from('system_line_richmenu_assignment').delete().eq('line_user_id', row.line_user_id));
    }
  });
}
