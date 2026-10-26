import { RecruitMailView } from "@/lib/auth/sprout-rill-view.server";
import { SystemViewButton } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import SproutShell from '../sprout-shell';
import SystemBreadcrumb from '@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb';
import SystemTabs from '@/app/system/_components/SystemTabs/SystemTabs';
import BaitoruPanel from './baitoru-panel';
import styles from '../sprout.module.css';
export default async function PostingsPage() {

 return <RecruitMailView page="sprout-postings" fallback={<p>準備中です</p>}><SproutShell current="掲載管理"><div className={styles.heading}><SystemBreadcrumb root={{label:'Sprout',href:'/sprout'}} items={[{label:'掲載管理'}]}/><h1>掲載管理</h1></div><SystemTabs actions={<SystemViewButton tabKey="baitoru" />}><button role="tab" aria-selected>バイトル</button></SystemTabs><BaitoruPanel/></SproutShell></RecruitMailView>;
}
