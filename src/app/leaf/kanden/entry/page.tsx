import { withSystemView } from "@/lib/auth/system-view-page.server";
import { japanDate } from "@/lib/notices";
import { viewPermissionContext } from "@/lib/auth/view-permission.server";
import { ENTRY_SCOPE, ENTRY_START, ENTRY_TITLE, entryQuery } from "./entry";
import { readEntryPage } from "./queries.server";
import { loadEntryDetail } from "./actions";
import EntryScreen from "./EntryScreen";
import { ResultMessage } from "@/app/system/forms/_components/form-kit";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import styles from "@/app/soil/soil.module.css";

export const metadata = { title: `${ENTRY_TITLE} | Garden` };

async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const today = japanDate();
  const { viewer, userId } = await viewPermissionContext();
  // 12/1 の展開までは全権管理者だけ（試し使い）
  if (today < ENTRY_START && viewer.role !== "super_admin") {
    return <section className={styles.pageShell}>
      <SystemBreadcrumb root={{ label: "Leaf", href: "/leaf" }} items={[{ label: "関電" }]} />
      <h1>{ENTRY_TITLE}</h1>
      <ResultMessage success>2026年12月1日から利用できます。</ResultMessage>
    </section>;
  }
  const params = await searchParams;
  const query = { ...entryQuery, search: typeof params.q === "string" ? params.q : "" };
  const { list, calendar } = await readEntryPage(query);
  const row = list?.rows[0];
  const result = row ? await loadEntryDetail({ id: row[0], intake: false }) : null;
  return <EntryScreen list={list} initialQuery={query} calendar={calendar} today={today} viewerId={userId}
    initialDetail={result && "detail" in result ? result.detail : null}
    initialError={result && "error" in result ? result.error : undefined} />;
}

export default withSystemView(ENTRY_SCOPE, Page, undefined, "/leaf/kanden/entry");
