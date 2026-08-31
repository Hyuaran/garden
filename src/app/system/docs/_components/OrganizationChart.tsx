import type { OrganizationNode } from "../_data/company-doc";
import styles from "../docs.module.css";

function Branch({ node }: { node: OrganizationNode }) {
  return <li className={styles.orgBranch}>
    <div className={styles.orgNode}>
      <strong>{node.label}</strong>
      {node.people?.map(person => <p key={person}>{person}</p>)}
    </div>
    {node.children?.length ? <ul className={styles.orgChildren}>
      {node.children.map(child => <Branch key={child.label} node={child} />)}
    </ul> : null}
  </li>;
}

export default function OrganizationChart({ root }: { root: OrganizationNode }) {
  return <ul className={styles.orgTree} aria-label="組織図"><Branch node={root} /></ul>;
}
