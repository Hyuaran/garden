import styles from "./shacho-transition-loading.module.css";

export default function ShachoTransitionLoading() {
  return <div className={styles.screen} data-testid="shacho-transition-loading" aria-hidden="true" />;
}
