import { sproutUser } from '@/lib/sprout/access.server';
import SproutShell from '../sprout-shell';
import SystemBreadcrumb from '@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb';
import SystemTabs from '@/app/system/_components/SystemTabs/SystemTabs';
import BaitoruPanel from './baitoru-panel';
export default async function PostingsPage() {
 if(!await sproutUser()) return <p>準備中です</p>;
 return <SproutShell current="掲載管理"><SystemBreadcrumb root={{label:'Sprout',href:'/sprout'}} items={[{label:'掲載管理'}]}/><h1>掲載管理</h1><SystemTabs><button role="tab" aria-selected>バイトル</button></SystemTabs><BaitoruPanel/></SproutShell>;
}
