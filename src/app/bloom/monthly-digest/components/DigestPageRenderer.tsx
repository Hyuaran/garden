"use client";

import type { DigestPage, MonthlyDigest } from "../../_types/monthly-digest";
import { AchievementsPage } from "./AchievementsPage";
import { CustomPage } from "./CustomPage";
import { DigestCoverPage } from "./DigestCoverPage";
import { NextMonthGoalsPage } from "./NextMonthGoalsPage";
import { ProgressGraphPage } from "./ProgressGraphPage";
import { WorkSummaryPage } from "./WorkSummaryPage";

type Props = {
  page: DigestPage;
  digest?: MonthlyDigest;
  projection?: boolean;
};

export function DigestPageRenderer({ page, digest, projection = false }: Props) {
  switch (page.kind) {
    case "cover":
      return (
        <DigestCoverPage
          page={page}
          projection={projection}
          context={{
            digestMonthLabel: digest?.digest_month ? digest.digest_month.slice(0, 7) : undefined,
            summary: digest?.summary ?? null,
          }}
        />
      );
    case "achievements":
      return <AchievementsPage page={page} projection={projection} />;
    case "progress_graph":
      return <ProgressGraphPage page={page} projection={projection} />;
    case "next_month_goals":
      return <NextMonthGoalsPage page={page} projection={projection} />;
    case "work_summary":
      return <WorkSummaryPage page={page} projection={projection} />;
    case "custom":
    default:
      return <CustomPage page={page} projection={projection} />;
  }
}
