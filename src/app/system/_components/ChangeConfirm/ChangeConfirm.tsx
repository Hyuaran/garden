import type { ReactNode } from "react";
import Modal from "../Modal/Modal";
import styles from "./change-confirm.module.css";
type Props = {title:string;beforeLabel:string;before:string;afterLabel:string;after:string;question:string;actions:ReactNode;onClose:()=>void;same?:boolean;selectedAnswer?:string;children?:ReactNode;embedded?:boolean};
export default function ChangeConfirm({title,beforeLabel,before,afterLabel,after,question,actions,onClose,same=false,selectedAnswer,children,embedded=false}:Props){const content=<>
{selectedAnswer && <p className={styles.selected}>選んだ答え：{selectedAnswer}</p>}
<dl className={styles.change}>{!same && <div className={styles.row}><dt>{beforeLabel}</dt><dd>{before}</dd></div>}<div className={styles.row+" "+styles.next}><dt>{afterLabel}</dt><dd>{after}</dd></div></dl>
<p className={styles.ask}>{same?"整える所はありませんでした":question}</p>{children}<div data-modal-actions>{actions}</div></>;return embedded?content:<Modal title={title} size="sm" onClose={onClose}>{content}</Modal>;}
