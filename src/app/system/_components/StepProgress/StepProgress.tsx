import type { ReactNode } from "react";
import styles from "./step-progress.module.css";
export default function StepProgress({total,value,label,name,step,className=""}:{total:number;value:number;label:ReactNode;name:string;step?:number;className?:string}) {
 const continuous=step===undefined && total>30;
 return <div className={`${styles.progress} ${className}`} style={{gridTemplateColumns:`repeat(${continuous?1:Math.max(total,1)},minmax(0,1fr))`}} role="progressbar" aria-label={name} aria-valuemin={step===undefined?0:1} aria-valuemax={total} aria-valuenow={value}>
 <span className={styles.label}>{label}</span>
 {continuous?<span className={styles.cell} aria-hidden="true"><span className={styles.fill} style={{width:`${value/total*100}%`}}/></span>:Array.from({length:total},(_,i)=><span key={i} className={styles.cell} data-step-status={step===undefined?(i<value?"answered":"upcoming"):i<step?"passed":i===step?"current":"upcoming"} aria-hidden="true"/>)}
 </div>;
}
