import type { CSSProperties } from "react";
import type { OrganizationNode } from "../_data/company-doc";
import styles from "../docs.module.css";

function columnCount(node: OrganizationNode): number {
  return node.children?.length ? node.children.reduce((total, child) => total + columnCount(child), 0) : 1;
}

function Branch({ node }: { node: OrganizationNode }) {
  return <li className={styles.orgBranch} data-org-branch={node.label} style={{ flexGrow: columnCount(node) }}>
    <div className={styles.orgUnit}>
      <div className={styles.orgNode} data-org-label><strong>{node.label}</strong></div>
      {!!node.members?.length && <div className={styles.orgMembers} data-org-members>
        {node.members.map(member => <div className={styles.orgMember} data-org-member key={`${member.role ?? ""}:${member.name}`}>
          {member.role && <span className={styles.orgMemberRole}>{member.role}</span>}
          {/* 全角換算で余裕を持たせ、長い氏名も文字を切らず箱幅に収める。 */}
          <span className={styles.orgMemberName} data-org-name style={{ "--org-name-length": Array.from(member.name).length + 0.25 } as CSSProperties}>{member.name}</span>
        </div>)}
      </div>}
    </div>
    {node.children?.length ? <ul className={styles.orgChildren}>
      {node.children.map(child => <Branch key={child.label} node={child} />)}
    </ul> : null}
  </li>;
}

export default function OrganizationChart({ root }: { root: OrganizationNode }) {
  return <ul className={styles.orgTree} aria-label="組織図"><Branch node={root} /></ul>;
}
