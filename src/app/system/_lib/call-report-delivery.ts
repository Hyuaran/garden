import type { CallMetricsResponse } from "./call-metrics";
import { callMetricsPdfFilename, renderCallMetricsPdf } from "./call-metrics-pdf";
import { sendCallReportMessage, sendCallReportWithAttachment, type CallReportRoomTarget } from "./chatwork";

type DeliveryDependencies = {
  renderPdf: typeof renderCallMetricsPdf;
  sendAttachment: typeof sendCallReportWithAttachment;
  sendMessage: typeof sendCallReportMessage;
};

const defaultDependencies: DeliveryDependencies = {
  renderPdf: renderCallMetricsPdf,
  sendAttachment: sendCallReportWithAttachment,
  sendMessage: sendCallReportMessage,
};

export async function deliverCallReport(
  text: string,
  metrics: CallMetricsResponse,
  now = new Date(),
  dependencies: DeliveryDependencies = defaultDependencies,
  target: CallReportRoomTarget = "live",
) {
  const filename = callMetricsPdfFilename(now);
  try {
    const pdf = await dependencies.renderPdf(metrics, { generatedAt: now });
    await dependencies.sendAttachment(text, pdf, filename, fetch, target);
    return { attached: true as const, filename };
  } catch (error) {
    console.error("[system/call-report] PDF attachment failed; falling back to text", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    await dependencies.sendMessage(text, fetch, target);
    return { attached: false as const, filename: null };
  }
}
