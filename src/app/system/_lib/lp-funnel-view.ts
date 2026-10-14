// WEBインバウンドの「対応」（表A）と「結果」（表B）の行の並びと文字の形（仕様書 v1.7 §5.6.5）。
// 画面（4 つ目のタブ）と PDF（第 2 部）が同じ行を使う。純粋な整形だけ。

import type { LpFunnelBusiness, LpFunnelCounts, LpFunnelResult } from "./lp-funnel";

export const formatLpRate = (value: number | null | undefined) => value == null ? "-" : `${(value * 100).toFixed(1)}％`;
export const formatLpCount = (value: number | null | undefined) => value == null ? "-" : value.toLocaleString("ja-JP");

// 「3（2・1・0）」＝合計（繋がった・繋がらない・発信なし）。判定待ちは「繋がった」が起きないので 2 つだけ
function counts3(value: LpFunnelCounts | null | undefined) {
  if (!value) return "-";
  return `${value.connected + value.notConnected + value.noCall}（${value.connected}・${value.notConnected}・${value.noCall}）`;
}
function counts2(value: LpFunnelCounts | null | undefined) {
  if (!value) return "-";
  return `${value.connected + value.notConnected + value.noCall}（${value.notConnected}・${value.noCall}）`;
}

export type LpFunnelViewRow = { label: string; values: string[]; indent?: number };

function columnsOf(result: LpFunnelResult) {
  return [...result.businesses, ...(result.totals ? [result.totals] : [])];
}

export function lpFunnelHeaders(result: LpFunnelResult) {
  return ["指標", ...columnsOf(result).map((biz) => biz.bizName)];
}

// 表A「対応」
export function lpFunnelTableA(result: LpFunnelResult): LpFunnelViewRow[] {
  const cols = columnsOf(result);
  const row = (label: string, pick: (biz: LpFunnelBusiness) => string, indent = 0): LpFunnelViewRow => ({ label, values: cols.map(pick), indent });
  return [
    row("総数（入電＋フォーム）", (b) => formatLpCount(b.total)),
    row("入電（番号あり）", (b) => formatLpCount(b.inbound)),
    row("うち応答できた", (b) => formatLpCount(b.answered), 1),
    row("うち応答できなかった", (b) => formatLpCount(b.unanswered), 1),
    row("折り返して繋がった", (b) => formatLpCount(b.callbackConnected), 2),
    row("折り返しても繋がらない", (b) => formatLpCount(b.callbackNotConnected), 2),
    row("折り返していない", (b) => formatLpCount(b.noCallback), 2),
    row("フォーム", (b) => formatLpCount(b.forms)),
    row("うち指定あり", (b) => formatLpCount(b.withSlot), 1),
    row("時間指定どおり（繋がった・繋がらない）", (b) => b.onTime ? `${b.onTime.connected + b.onTime.notConnected + b.onTime.noCall}（${b.onTime.connected}・${b.onTime.notConnected}）` : "-", 2),
    row("どおりでない（繋がった・繋がらない・発信なし）", (b) => counts3(b.late), 2),
    row("判定待ち（繋がらない・発信なし）", (b) => counts2(b.pendingWithSlot), 2),
    row("うち指定なし", (b) => formatLpCount(b.noSlot), 1),
    row("締切まで（繋がった・繋がらない）", (b) => b.noSlotOnTime ? `${b.noSlotOnTime.connected + b.noSlotOnTime.notConnected + b.noSlotOnTime.noCall}（${b.noSlotOnTime.connected}・${b.noSlotOnTime.notConnected}）` : "-", 2),
    row("締切超（繋がった・繋がらない・発信なし）", (b) => counts3(b.noSlotLate), 2),
    row("判定待ち（繋がらない・発信なし）", (b) => counts2(b.noSlotPending), 2),
    row("うち番号不備", (b) => formatLpCount(b.invalidNumberForms), 1),
    row("応答率（応答できた ÷ 入電）", (b) => formatLpRate(b.answerRate)),
    row("（参考）番号不明・形式外の着信（回数・総数に含めない）", (b) => formatLpCount(b.unknownInboundCalls)),
  ];
}

// 表B「結果」
export function lpFunnelTableB(result: LpFunnelResult): LpFunnelViewRow[] {
  const cols = columnsOf(result);
  const row = (label: string, pick: (biz: LpFunnelBusiness) => string, indent = 0): LpFunnelViewRow => ({ label, values: cols.map(pick), indent });
  return [
    row("応答（話せた）", (b) => formatLpCount(b.spoke)),
    row("うち入電で応答", (b) => formatLpCount(b.spokeInbound), 1),
    row("うち折り返して繋がった", (b) => formatLpCount(b.spokeCallback), 1),
    row("うちフォームで繋がった", (b) => formatLpCount(b.spokeForm), 1),
    row("受注", (b) => formatLpCount(b.won)),
    row("対応中", (b) => formatLpCount(b.inProgress)),
    row("見送り", (b) => formatLpCount(b.lost)),
    row("対象外", (b) => formatLpCount(b.excluded)),
    row("記録なし", (b) => formatLpCount(b.noRecord)),
    row("対応率（話せた ÷ 総数）", (b) => formatLpRate(b.contactRate)),
    row("受注率（受注 ÷ 話せた）", (b) => formatLpRate(b.wonRate)),
    row("対象外率（対象外 ÷ 話せた）", (b) => formatLpRate(b.excludedRate)),
    row("有効受注率（受注 ÷（話せた − 対象外））", (b) => formatLpRate(b.effectiveWonRate)),
  ];
}

// 記録なしの一覧（事業ごとの一覧を 1 つにまとめる・着信日時の昇順）
export function lpFunnelNoRecordList(result: LpFunnelResult) {
  return result.businesses
    .flatMap((biz) => biz.noRecordList.map((item) => ({ ...item, bizName: biz.bizName })))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function lpFunnelCalcNotes(result: LpFunnelResult) {
  return [...new Set([...result.notes, ...result.businesses.flatMap((biz) => biz.calcNotes)])];
}

export const LP_FUNNEL_LEAD_NOTE = "数字は集計した時点の状態です。折り返しや対応状況は後から変わるので、前日の数字も更新されます。";
export const LP_FUNNEL_FILTER_NOTE = "WEBインバウンドは事業ごとの数字です。リスト名・従業員名の絞り込みは効きません。";
export const LP_FUNNEL_START_NOTE = "フォームと結果は kintone の記録がある期間だけ（ヒカリのプロ＝2026-06-05〜・電気開始受付センター＝2026-08-21〜）。INNOVERA の写しは 2026-01-01 から。それより前の期間は参考値です。";

// 定義方法の 6 表目「WEBインバウンドの対応と結果」（仕様書 v1.7 §5.6.6）
export const LP_FUNNEL_DEFINITIONS: string[][] = [
  ["入電", "WEBインバウンドの 0120 番号にかかってきた電話を、かけてきた番号ごとに 1 件（同じ人の複数回は 1 件。自動留守電と番号の分からない着信は含めない）。本文の「着信」は電話の回数で、こちらは番号の数"],
  ["フォーム", "申込みページから送られた受付（kintone の流入元＝HP）1 件。電話もかけてきた人はフォームの 1 件に寄せる"],
  ["応答できた／できなかった", "その番号の電話に 1 回でも出た／期間中に一度も出なかった"],
  ["折り返し", "出られなかった番号へ、担当の内線からかけ直した電話（どの回線からでも）。繋がった＝かけ直しで通話成功が 1 回以上"],
  ["時間指定どおり", "フォームの「ご希望の時間帯」の終わりまでに、時間帯の中に発信したか、話せた（時間帯より前でも）。受付が時間帯の後なら翌日の同じ時間帯まで。時間帯の指定が無いフォームは受付から 2 時間以内の発信か通話（受付時間 10:00〜21:00 の外に来た分は、次の 10:00 から 2 時間）"],
  ["判定待ち", "時間帯の終わり（指定なしは受付から 2 時間、受付時間外は次の 12:00）がまだ来ていないフォームで、まだ話せていないもの"],
  ["記録なしのアラート", "記録なしが 1 件以上あると、本文の事業の行に「⚠記録なし n件」が付く。番号はポータルの「WEBインバウンド」タブの表B の下で確かめ、kintone に登録する"],
  ["応答（話せた）", "入電で応答できた＋折り返して繋がった＋フォームで繋がった"],
  ["受注／対応中／見送り／対象外／記録なし", "kintone の対応状況＝申込み／未対応・対応中・前確待ち／見送り・前確NG／対象外の 3 つ／番号に一致する記録が無い（集計した時点の値）"],
  ["応答率", "応答できた ÷ 入電"],
  ["対応率", "応答（話せた）÷ 総数（入電＋フォーム）"],
  ["受注率／対象外率／有効受注率", "受注 ÷ 応答（話せた）／対象外 ÷ 応答（話せた）／受注 ÷（応答（話せた）− 対象外）。記録なしは分母に入れる"],
  ["数字が後から変わる", "折り返しと対応状況は集計した時点の状態なので、翌日以降に前日の数字も更新される。複数日の期間では同じ番号の 2 日分の電話が 1 件になるので、日ごとの合計とは一致しない。前日に出られず翌日にお客様がかけ直して話せた場合、前日は「折り返していない」のまま（折り返しは発信だけを見る）"],
  ["数字の始まり", LP_FUNNEL_START_NOTE],
];
