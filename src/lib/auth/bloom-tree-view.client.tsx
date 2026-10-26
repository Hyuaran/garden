'use client';
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { bloomTreePageKey, BLOOM_TREE_TABS } from './bloom-tree-view-scopes';
import { effectivePermission, resolveCanView, type Viewer, type ViewPermission } from './view-permission';
import { SystemViewProvider } from '@/app/system/_components/ViewPermissionButton/SystemViewContext';
type State = {viewer: Viewer; rows: ViewPermission[]};
const Context = createContext<State | null>(null);
export function useBloomTreeView() {
  const state = useContext(Context);
  return useCallback((href: string, defaultAllowed?: boolean) => {
    const page = bloomTreePageKey(href);
    if (!page) return defaultAllowed ?? true;
    if (!state) return false;
    return (BLOOM_TREE_TABS[page]?.map(([key]) => key) ?? ['']).some(tab => resolveCanView(state.rows,page,tab,state.viewer,defaultAllowed));
  },[state]);
}
export function BloomTreeGate({children}: {children: ReactNode}) {
  const path = usePathname() ?? '';
  const page = bloomTreePageKey(path);
  const [result,setResult] = useState<{path:string; state?:State; error?:string} | null>(null);
  useEffect(() => {
    if (!page) return;
    const controller = new AbortController();
    const refresh = () => { fetch('/api/bloom/view-permissions',{cache:'no-store',signal:controller.signal})
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error); return data as State; })
      .then(state => setResult({path,state})).catch(e => { if (!controller.signal.aborted) setResult({path,error:String(e.message)}); }); };
    refresh();
    window.addEventListener('garden:view-permissions-updated',refresh);
    return () => { controller.abort(); window.removeEventListener('garden:view-permissions-updated',refresh); };
  },[page,path]);
  if (!page) return <>{children}</>;
  if (result?.path !== path) return <p>閲覧権限を確認中…</p>;
  if (!result.state) return <p>{result.error ?? '閲覧権限がありません'}</p>;
  const state = result.state;
  const canAdd = (tab: string) => page.startsWith('tree-') && !!effectivePermission(state.rows,page,tab)?.viewers_can_add && resolveCanView(state.rows,page,tab,state.viewer);
  const tabs = (BLOOM_TREE_TABS[page] ?? []).map(([key,label]) => ({key,label,allowed:resolveCanView(state.rows,page,key,state.viewer),canAdd:canAdd(key)}));
  const allowed = tabs.length ? tabs.some(t => t.allowed) : resolveCanView(state.rows,page,'',state.viewer);
  if (!allowed) return <p>閲覧権限がありません</p>;
  return <Context.Provider value={state}><SystemViewProvider value={{pageKey:page,admin:state.viewer.role === 'super_admin',tabs,canAdd:canAdd('')}}>{children}</SystemViewProvider></Context.Provider>;
}
