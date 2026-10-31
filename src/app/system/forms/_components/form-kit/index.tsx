"use client";
import HelpButton from "@/app/system/_components/HelpButton/HelpButton";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import type { ComponentProps, ReactNode } from 'react';
import SystemBreadcrumb from '@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb';
import styles from './form-kit.module.css';
export { styles as formStyles };
export function FormPage({ mobile = false, embedded = false, hideHeading = false, compactTitle = false, title, submitterName, employeeNumber, description, guide, tabs, children }: { mobile?: boolean; embedded?: boolean; hideHeading?: boolean; compactTitle?: boolean; title: string; submitterName: string; employeeNumber: string; description?: string; guide?: ReactNode; tabs?: ReactNode; children: ReactNode }) {
  return <main data-form-mobile={mobile} className={[styles.pageShell, mobile ? styles.mobile : '', embedded ? styles.embedded : ''].join(' ')}>{!hideHeading && <><header className={styles.header}>{!mobile && !embedded && <SystemBreadcrumb items={[{ label: '業務管理ツール', href: '/system/forms' }, { label: title }]} />}<div className={styles.mobileTitleRow}><div className="garden-help-heading"><h1 className={compactTitle ? styles.compactTitle : undefined}>{title}</h1><HelpButton /></div>{mobile && !embedded && submitterName && <p className={styles.mobileSender} data-clarity-mask="true">{submitterName} さん</p>}</div>{!mobile && !embedded && description && <p className={styles.lead}>{description}</p>}</header>{(!tabs || mobile || embedded) && <SystemTabs />}</>}{!mobile && !embedded && <>{guide}{tabs}<p className={styles.sender} data-clarity-mask="true">送信者　{submitterName}（{employeeNumber}）</p></>}{children}</main>;
}
export function FormRow({ label, children, expanded = false, grouped = false }: { label: ReactNode; children: ReactNode; grouped?: boolean; expanded?: boolean }) { return <section data-form-row className={[styles.panel, expanded ? styles.expanded : ''].join(' ')}><h2>{label}</h2>{grouped ? <div className={styles.fields}>{children}</div> : children}</section>; }
export function RadioGroup({ name, label, options, value, onChange, required }: { name: string; label: string; options: readonly string[]; value: string; onChange: (value: string) => void; required?: boolean }) { return <div role="radiogroup" aria-label={label} className={styles.choices}>{options.map(item => <label key={item} className="garden-radio"><input type="radio" name={name} required={required} checked={value === item} onChange={() => onChange(item)} /><span>{item}</span></label>)}</div>; }
export function SelectField({ children, ...props }: ComponentProps<'select'>) { return <select {...props} className={[styles.field, props.className ?? ''].join(' ')}><option value="">選んでください</option>{children}</select>; }
export function TextField(props: ComponentProps<'input'>) { return <input {...props} className={[styles.field, props.className ?? ''].join(' ')} />; }
export function NumberField({ unit, ...props }: ComponentProps<'input'> & { unit?: string }) { const input = <TextField inputMode="numeric" pattern="[0-9]+" {...props} />; return unit ? <div className={styles.amount}>{input}<span>{unit}</span></div> : input; }
export function TextArea(props: ComponentProps<'textarea'>) { return <textarea {...props} className={[styles.field, styles.area, props.className ?? ''].join(' ')} />; }
export function FixedValue({ children }: { children: ReactNode }) { return <p className={styles.fixedText}>{children}</p>; }
export function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { const change = (next: number) => onChange(Number.isFinite(next) ? Math.max(0, Math.trunc(next)) : 0); return <div className={styles.counter}><span>{label}</span><button type="button" aria-label={label + 'を減らす'} onClick={() => change(value - 1)}>－</button><input type="number" min={0} step={1} inputMode="numeric" aria-label={label + 'の件数'} value={value} onChange={e => change(e.currentTarget.valueAsNumber)} /><button type="button" aria-label={label + 'を増やす'} onClick={() => change(value + 1)}>＋</button></div>; }
export function SubmitButton({ busy, children, ...props }: ComponentProps<'button'> & { busy: boolean }) { return <button type="button" {...props} className={styles.primary} disabled={busy || props.disabled}>{busy ? '送信中...' : children}</button>; }
export function ResultMessage({ children, success = false }: { children: ReactNode; success?: boolean }) { return children ? <p role="status" className={success ? styles.message : styles.error}>{children}</p> : null; }
export function RecentList({ title = '自分の最近の報告', items, children }: { title?: string; items?: ReactNode[]; children?: ReactNode }) { return <section className={styles.history}><h2>{title}</h2>{children ?? (items?.length ? <div className={styles.historyBox}>{items}</div> : <p className={styles.empty}>まだありません</p>)}</section>; }
/** 始めと終わりの時刻を 1 行で（［14:00］～［21:00］）。後ろに稼働時間などを足せる */
export function TimeRange({ start, end, onStart, onEnd, disabled, children }: { start: string; end: string; onStart: (value: string) => void; onEnd: (value: string) => void; disabled?: boolean; children?: ReactNode }) { return <div className={styles.timeRange}><TextField aria-label="開始時間" type="time" required disabled={disabled} value={start} onChange={e => onStart(e.target.value)} /><span>～</span><TextField aria-label="終了時間" type="time" required disabled={disabled} value={end} onChange={e => onEnd(e.target.value)} />{children}</div>; }

/** 行の中の小さな操作（編集する・試しに送るなど）。送信ボタンより控えめな枠つき */
export function ActionButton({ children, ...props }: ComponentProps<'button'>) { return <button type="button" {...props} className={[styles.actionButton, props.className ?? ''].join(' ')}>{children}</button>; }
/** 状態の札（使用中・使用しないなど） */
export function StatusBadge({ children, muted = false }: { children: ReactNode; muted?: boolean }) { return <span className={[styles.statusBadge, muted ? styles.statusMuted : ''].join(' ')}>{children}</span>; }
/** 操作ボタンを横に並べる */
export function ActionRow({ children }: { children: ReactNode }) { return <div className={styles.actionRow}>{children}</div>; }

export function FieldGrid({ children }: {children: ReactNode}) { return <div className={styles.fieldGrid}>{children}</div>; }
export function FieldLabel({ label, children }: {label: string; children: ReactNode}) { return <div className={styles.fieldLabel}><span>{label}</span>{children}</div>; }
