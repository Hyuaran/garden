import { DEPENDENT_FIELDS, DEPENDENT_LABELS, displayValue, FIELD_LABELS, STEP_FIELDS, STEPS, type OnboardingInput } from "../_lib/onboarding";
import styles from "../onboarding.module.css";

function Value({ value }: { value: string }) { return value ? <>{value}</> : <span className={styles.empty}>未入力</span>; }
export default function OnboardingReview({ values, onEdit }: { values: OnboardingInput; onEdit?: (step: number) => void }) {
  return <div className={styles.review}>{STEPS.slice(0, -1).map((title, index) => <section key={title} aria-label={title}>
    <div className={styles.reviewHeading}><h3>{title}</h3>{onEdit && <button type="button" onClick={() => onEdit(index)} aria-label={`${title}を直す`}>直す</button>}</div>
    <dl>{STEP_FIELDS[index].map(key => <div key={key}><dt>{FIELD_LABELS[key]}</dt><dd><Value value={displayValue(key, values[key])} /></dd></div>)}</dl>
    {index === 2 && (values.dependents.length ? values.dependents.map((person, personIndex) => <div key={personIndex}>
      <h4>扶養家族 {personIndex + 1}人目</h4><dl>{DEPENDENT_FIELDS.map(key => <div key={key}><dt>{DEPENDENT_LABELS[key]}</dt><dd><Value value={person[key]} /></dd></div>)}</dl>
    </div>) : <p>扶養家族：0人</p>)}
    {index === 9 && <p>{values.nda_agreed ? "内容を確認しました" : <span className={styles.empty}>未入力（同意の確認なし）</span>}</p>}
  </section>)}</div>;
}
