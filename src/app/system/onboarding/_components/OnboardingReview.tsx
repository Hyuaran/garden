import { commuteTotals, DEPENDENT_FIELDS, DEPENDENT_LABELS, displayDependentValue, displayValue, FIELD_LABELS, formatYen, normalizeAmountText, parseAmount, STEP_FIELDS, STEPS, type CommuteRoute, type OnboardingInput, type TextField } from "../_lib/onboarding";
import styles from "../onboarding.module.css";
import type { ReactNode } from "react";

function Value({ value }: { value: string }) { return value ? <>{value}</> : <span className={styles.empty}>未入力</span>; }
type MyNumberReveal = {
  value: (kind: "self" | "dependent", index?: number) => string;
  busy: (kind: "self" | "dependent", index?: number) => boolean;
  onShow: (kind: "self" | "dependent", index?: number) => void;
  onHide: (kind: "self" | "dependent", index?: number) => void;
};
function MyNumberValue({ masked, kind, index, reveal }: { masked: string; kind: "self" | "dependent"; index?: number; reveal?: MyNumberReveal }) {
  if (!reveal) return <Value value={masked} />;
  const full = reveal.value(kind, index);
  const busy = reveal.busy(kind, index);
  return <span className={styles.myNumberView}>
    <span>{full || masked || <span className={styles.empty}>未入力</span>}</span>
    {masked || full ? <button type="button" disabled={busy} onClick={() => full ? reveal.onHide(kind, index) : reveal.onShow(kind, index)}>{full ? "隠す" : "見る"}</button> : null}
    {full && <span className={styles.hint}>この画面を離れると、また伏せ字に戻ります</span>}
  </span>;
}
function MoneyValue({ value }: { value: string }) {
  return normalizeAmountText(value) ? <>{formatYen(parseAmount(value))}</> : <Value value={value} />;
}
function RouteSummary({ route }: { route: CommuteRoute }) {
  return <>{route.kind || "未入力"}／{route.from_station || "未入力"} → {route.to_station || "未入力"}／{route.line || "未入力"}／定期代 <MoneyValue value={route.pass_monthly} />／片道 <MoneyValue value={route.fare_oneway} /></>;
}
export default function OnboardingReview({ values, onEdit, myNumberReveal, slots }: { values: OnboardingInput; onEdit?: (step: number) => void; myNumberReveal?: MyNumberReveal; slots?: Partial<Record<TextField, ReactNode>> }) {
  return <div className={styles.review}>{STEPS.slice(0, -1).map((title, index) => <section key={title} aria-label={title}>
    <div className={styles.reviewHeading}><h3>{title}</h3>{onEdit && <button type="button" onClick={() => onEdit(index)} aria-label={`${title}を直す`}>直す</button>}</div>
    <dl>{STEP_FIELDS[index].map(key => <div key={key}><dt>{FIELD_LABELS[key]}</dt><dd>{slots?.[key] ?? (key === "my_number" ? <MyNumberValue masked={displayValue(key, values[key])} kind="self" reveal={myNumberReveal} /> : <Value value={displayValue(key, values[key])} />)}</dd></div>)}</dl>
    {index === 2 && (values.dependents.length ? values.dependents.map((person, personIndex) => <div key={personIndex}>
      <h4>扶養家族 {personIndex + 1}人目</h4><dl>{DEPENDENT_FIELDS.map(key => <div key={key}><dt>{DEPENDENT_LABELS[key]}</dt><dd>{key === "my_number" ? <MyNumberValue masked={displayDependentValue(key, person[key])} kind="dependent" index={personIndex} reveal={myNumberReveal} /> : <Value value={displayDependentValue(key, person[key])} />}</dd></div>)}</dl>
    </div>) : <p>扶養家族：0人</p>)}
    {index === 5 && <dl>
      {values.commute_routes.length ? values.commute_routes.map((route, routeIndex) => <div key={routeIndex}><dt>{routeIndex + 1}区間目</dt><dd><RouteSummary route={route} /></dd></div>) : <div><dt>1区間目</dt><dd><span className={styles.empty}>未入力</span></dd></div>}
      <div><dt>定期代の合計</dt><dd>{commuteTotals(values.commute_routes).hasAnyAmount ? formatYen(commuteTotals(values.commute_routes).passMonthly) : <span className={styles.empty}>未入力</span>}</dd></div>
      <div><dt>片道の運賃の合計</dt><dd>{commuteTotals(values.commute_routes).hasAnyAmount ? formatYen(commuteTotals(values.commute_routes).fareOneway) : <span className={styles.empty}>未入力</span>}</dd></div>
    </dl>}
    {index === 9 && <p>{values.nda_agreed ? "内容を確認しました" : <span className={styles.empty}>未入力（同意の確認なし）</span>}</p>}
  </section>)}</div>;
}
