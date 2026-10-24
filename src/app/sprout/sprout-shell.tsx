import Link from 'next/link';
import type { ReactNode } from 'react';
import { ModuleIcon } from '@/app/_components/ModuleIcon/ModuleIcon';
import shell from '@/app/system/_components/ShachoShell/shacho-shell.module.css';
import styles from './sprout.module.css';
export default function SproutShell({current,children}:{current:'掲載管理'|'採用管理';children:ReactNode}) {
 return <div className={`${shell.shell} ${styles.shell}`}>
 <aside className={shell.rail}><div className={shell.railInner}>{(['root','bud','sprout'] as const).map(id=><Link key={id} href={`/${id}`} aria-label={id} className={shell.app}><ModuleIcon id={id}/></Link>)}</div></aside>
 <aside className={`${shell.side} ${styles.sidebar}`}><div className={styles.brand}>Garden<br/><strong>Sprout</strong></div><nav className={shell.nav}>{[['/sprout/postings','掲載管理'],['/sprout','採用管理']].map(([href,label])=><Link key={href} href={href} className={current===label?shell.active:undefined} aria-current={current===label?'page':undefined}>{label}</Link>)}</nav></aside>
 <main className={`${shell.main} ${styles.main}`}>{children}</main></div>;
}
