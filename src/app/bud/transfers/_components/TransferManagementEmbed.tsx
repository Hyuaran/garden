"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { TransferApprovalPanel } from "./TransferApprovalPanel";
import { TransferAmountCalendar } from "./TransferAmountCalendar";
import { TransferPaymentCategoryPanel } from "./TransferPaymentCategoryPanel";

export function TransferManagementEmbed() {
  const [calendarMount, setCalendarMount] = useState<HTMLElement | null>(null);
  const [approvalMount, setApprovalMount] = useState<HTMLElement | null>(null);
  const [scheduleMount, setScheduleMount] = useState<HTMLElement | null>(null);
  const [listMount, setListMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const nextCalendarMount = document.getElementById(
        "trf-overview-calendar-mount",
      );
      const nextApprovalMount = document.getElementById("trf-approval-mount");
      const nextScheduleMount = document.getElementById("trf-schedule-mount");
      const nextListMount = document.getElementById("trf-list-mount");
      if (nextCalendarMount) {
        setCalendarMount((current) =>
          current === nextCalendarMount ? current : nextCalendarMount,
        );
      }
      if (nextApprovalMount) {
        setApprovalMount((current) =>
          current === nextApprovalMount ? current : nextApprovalMount,
        );
      }
      if (nextScheduleMount) {
        setScheduleMount((current) =>
          current === nextScheduleMount ? current : nextScheduleMount,
        );
      }
      if (nextListMount) {
        setListMount((current) =>
          current === nextListMount ? current : nextListMount,
        );
      }
    };
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 300);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  const updateInboxCount = useCallback((count: number) => {
    const badge = document.getElementById("trf-inbox-tab-badge");
    if (!badge) return;
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }, []);

  return (
    <>
      {calendarMount && createPortal(<TransferAmountCalendar />, calendarMount)}
      {approvalMount &&
        createPortal(
          <TransferApprovalPanel onInboxCountChange={updateInboxCount} />,
          approvalMount,
        )}
      {scheduleMount &&
        createPortal(
          <TransferPaymentCategoryPanel scope="pending" />,
          scheduleMount,
        )}
      {listMount && createPortal(<TransferPaymentCategoryPanel />, listMount)}
    </>
  );
}
