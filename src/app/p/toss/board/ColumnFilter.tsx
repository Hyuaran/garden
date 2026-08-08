import styles from "./column-filter.module.css";

export function ColumnFilter({ label, values, selected, onChange }: { label: string; values: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  const toggle = (value: string, checked: boolean) => onChange(checked ? [...selected, value] : selected.filter(item => item !== value));
  return <details className={styles.filter} onClick={event => event.stopPropagation()}>
    <summary aria-label={`${label}フィルター`}>{selected.length ? `絞込 (${selected.length})` : "すべて"}</summary>
    <div className={styles.menu}><button type="button" onClick={() => onChange([])}>すべて選択</button><div className={styles.options}>
      {values.map(value => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={event => toggle(value, event.target.checked)} /><span>{value}</span></label>)}
      {!values.length && <small>選択肢なし</small>}
    </div></div>
  </details>;
}
