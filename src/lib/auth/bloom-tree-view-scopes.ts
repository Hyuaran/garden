import { GARDEN_ROLE_ORDER, isRoleAtLeast, type GardenRole } from '@/app/root/_constants/types';
import type { SystemViewScope } from './system-view-scopes';

export const BLOOM_TREE_PAGES = [
  ['bloom-home','/bloom','ホーム'], ['bloom-blueprint','/bloom/blueprint','設計図'],
  ['bloom-ceo-status','/bloom/ceo-status','経営状況'], ['bloom-daily-report','/bloom/daily-report','日報'],
  ['bloom-kpi','/bloom/kpi','経営指標'], ['bloom-monthly-digest','/bloom/monthly-digest','月次まとめ'],
  ['bloom-monthly-digest-month','/bloom/monthly-digest/[month]','月のまとめ'],
  ['bloom-monthly-digest-edit','/bloom/monthly-digest/[month]/edit','月次まとめの編集'],
  ['bloom-progress','/bloom/progress','開発進捗'], ['bloom-roadmap','/bloom/roadmap','ロードマップ'],
  ['bloom-workboard','/bloom/workboard','ワークボード'], ['bloom-workboard-ceo-status','/bloom/workboard/ceo-status','東海林さんの状況'],
  ['tree-home','/tree','ホーム'], ['tree-dashboard','/tree/dashboard','ダッシュボード'],
  ['tree-mypage','/tree/mypage','マイページ'], ['tree-call','/tree/call','通話画面'],
  ['tree-calling-branch','/tree/calling/branch','クローザー架電'], ['tree-calling-sprout','/tree/calling/sprout','トス架電'],
  ['tree-toss-wait','/tree/toss-wait','クローザー待ち'], ['tree-confirm-wait','/tree/confirm-wait','前確・後確待ち'],
  ['tree-wrap-up','/tree/wrap-up','業務終了報告'], ['tree-follow-call','/tree/follow-call','フォローコール'],
  ['tree-search','/tree/search','検索'], ['tree-scripts','/tree/scripts','スクリプト管理'],
  ['tree-qa','/tree/qa','質問と回答'], ['tree-videos','/tree/videos','動画'], ['tree-ranking','/tree/ranking','有効率'],
  ['tree-alerts','/tree/alerts','要フォロー'], ['tree-aporan','/tree/aporan','アポラン'],
  ['tree-birthday','/tree/birthday','誕生日'], ['tree-break-schedule','/tree/break-schedule','休憩予定'],
  ['tree-breeze','/tree/breeze','Breeze'], ['tree-chatwork','/tree/chatwork','Chatwork情報'],
  ['tree-monitoring','/tree/monitoring','モニタリング'], ['tree-feedback','/tree/feedback','フィードバック入力'],
  ['tree-feedback-list','/tree/feedback/list','フィードバック一覧'],
] as const;
export const BLOOM_TREE_TABS: Record<string, readonly (readonly [string,string])[]> = {
  'tree-monitoring': [['list','一覧'],['seat','座席表']],
  'tree-call': [['toss','トス'],['confirm','前後確']],
  'bloom-blueprint': [['overview','全体'],['modules','モジュール']],
  'bloom-ceo-status': [['overview','全体'],['performance','業績'],['decisions','判断・会議'],['settings','設定']],
  'bloom-progress': [['overview','全体'],['modules','モジュール'],['history','履歴']],
  'bloom-daily-report': [['Summary','サマリ'],['Achievements','達成事項'],['Progress','進捗グラフ'],['Next Goals','次の目標']],
  'bloom-monthly-digest': [['Summary','サマリ'],['Achievements','達成リスト'],['Progress','進捗グラフ'],['Next Goals','次月目標']],
  'bloom-workboard': [['today','ワークボード'],['weekly','週次'],['members','メンバー別']],
  'bloom-kpi': [['summary','サマリ'],['forest','売上'],['tree','架電'],['bud','経理'], ...['全社統合','ヒュアラン','センターライズ','ARATA','リンクサポート','たいよう','壱'].map(x => [x,x] as const)],
};
export function bloomTreeDefaultRoles(page: string): readonly GardenRole[] {
  // Tree の既存画面には入口の役職制限がない。メニュー条件とは別に維持する。
  if (page.startsWith('tree-')) return GARDEN_ROLE_ORDER;
  if (page === 'bloom-ceo-status') return ['super_admin'];
  if (page === 'bloom-monthly-digest-edit') return ['admin','super_admin'];
  return GARDEN_ROLE_ORDER.filter(role => isRoleAtLeast(role, 'staff'));
}
export const BLOOM_TREE_VIEW_SCOPES: SystemViewScope[] = BLOOM_TREE_PAGES.flatMap(([pageKey,,label]) => {
  const defaultRoles = bloomTreeDefaultRoles(pageKey);
  return [{pageKey,tabKey:'',label,defaultRoles}, ...(BLOOM_TREE_TABS[pageKey] ?? []).map(([tabKey,label]) => ({pageKey,tabKey,label,defaultRoles}))];
});
export function bloomTreePageKey(path: string) {
  return BLOOM_TREE_PAGES.find(([,href]) => new RegExp('^' + href.replace(/\[[^\]]+\]/g,'[^/]+') + '/?$').test(path.split('?')[0]))?.[0];
}
