import 'server-only';
import { canView, viewPermissionContext, ViewPermissionError } from './view-permission.server';
import { BLOOM_TREE_VIEW_SCOPES, BLOOM_TREE_TABS } from './bloom-tree-view-scopes';

export async function requireBloomTreeRead(page: string, tab = '') {
  if (!BLOOM_TREE_VIEW_SCOPES.some(s => s.pageKey === page && s.tabKey === tab)) throw new ViewPermissionError('閲覧権限がありません');
  const context = await viewPermissionContext();
  const tabs = tab ? [tab] : (BLOOM_TREE_TABS[page]?.map(([key]) => key) ?? ['']);
  if (!(await Promise.all(tabs.map(key => canView(page,key,context.viewer)))).some(Boolean)) throw new ViewPermissionError('閲覧権限がありません');
  return context;
}
