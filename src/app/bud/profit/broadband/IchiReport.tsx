"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import UpdatedStamp from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import { refreshIchiReport } from "./ichi-actions";
import { billingMonths, number, object, perPerson, profit, ratio, rows, sum, missingCost, text, updatedDate, type Row } from "@/lib/bud/ichi-report/model";
import type { readSnapshot } from "@/lib/bud/ichi-report/snapshot";
import IchiChart from "./IchiChart";
import styles from "./ichi-report.module.css";
export type ReportResult = Awaited<ReturnType<typeof readSnapshot>>;
const fmt = (v: unknown) => number(v) === null ? "-" : Math.round(v as number).toLocaleString("ja-JP");
const yen = (v: unknown) => number(v) === null ? "-" : `${fmt(v)} 円`;
const pct = (a: unknown, b: unknown) => ratio(a, b) === null ? "-" : `${ratio(a, b)?.toFixed(1)}%`;
const methods = [
  "口座振替", "コンビニ", "クレジット"
];
const collecting = "集計中";
function Table({ title, heads, data }: {
  title: string;
  heads: string[];
  data: ReactNode[][];
}) {
  return <div className={styles.scroll}>
    <table>
      <caption>
        {title}</caption>
      <thead>
        <tr>
          {heads.map(h => <th key={h} scope="col">
            {h}</th>)}</tr></thead>
      <tbody>
        {data.length ? data.map((r, i) => <tr key={i}>
          {r.map((v, j) => <td key={j}>
            {v}</td>)}</tr>) : <tr>
          <td colSpan={heads.length}>該当する内容はありません</td></tr>}</tbody></table></div>;
}
function Tiles({ data }: {
  data: [
    string,
    ReactNode
  ][];
}) {
  return <dl className={styles.tiles}>
    {data.map(([label, value]) => <div key={label}>
      <dt>
        {label}</dt>
      <dd>
        {value}</dd></div>)}</dl>;
}
export default function IchiReport({ initial }: {
  initial: ReportResult;
}) {
  const [result, setResult] = useState(initial);
  const [busy, start] = useTransition();
  const router = useRouter();
  const snapshot = result.snapshot;
  const d = object(snapshot?.data), b = object(d.billing), bm = billingMonths(d), months = rows(d.months);
  const costs = bm.filter(r => Object.keys(object(r.cost)).length > 0);
  const latest = bm.at(-1), closed = bm.filter(r => !r.open).at(-1), t = object(latest?.["合計"]);
  const lastFull = months.filter(r => r.m !== d.partial).at(-1) ?? months.at(-1);
  const lastCost = costs.at(-1), p = profit(lastCost ?? {});
  const closedCosts = costs.filter(r => !r.open);
  const costTotal: Row = {
    "合計": Object.fromEntries([
      "amt", "paid", "carry"
    ].map(k => [k, sum(closedCosts.map(r => object(r["合計"])[k] ?? (k === "carry" ? 0 : null)))])),
    cost: Object.fromEntries([
      "ntt",
      "isp",
      "fee", "out"
    ].map(k => [k, sum(closedCosts.map(r => object(r.cost)[k]))])),
  };
  const label = (r: Row) => `${text(r.bm).replace(/^(\d{4})(\d{2})$/, "$1年$2月")}請求（${text(r.um)}利用）${r.open ? "・集計中" : ""}`;
  const record = (r: Row) => {
    const rec = typeof r.rec === "number" ? String(r.rec) : text(r.rec);

    const base = text(d.kintone_url);

    let safe = false;
    try {
      const url = new URL(base);

      safe = url.protocol === "https:" && url.hostname.endsWith(".cybozu.com");
    }
    catch { /* No link for an invalid address. */ }

    return rec && safe ? <a href={base + encodeURIComponent(rec)} target="_blank" rel="noopener noreferrer">
      {rec}</a> : rec || "-";
  };
  const warnings = rows(d.warnings);
  const acquisitionRows: ReactNode[][] = [...months.map(r => [text(r.m) + (r.m === d.partial ? "・集計中" : ""), ...[
    "order",
    "cancel",
    "c1",
    "c2",
    "c3",
    "done",
    "left",
    "open",
    "churn", "users"
  ].map(k => fmt(r[k]))]), [
    "合計", ...[
      "order",
      "cancel",
      "c1",
      "c2",
      "c3",
      "done",
      "left",
      "open", "churn"
    ].map(k => fmt(sum(months.map(r => r[k])))), fmt(months.at(-1)?.users)
  ]];
  const billingRows: ReactNode[][] = bm.map(r => {
    const x = object(r["合計"]); return [
      label(r),
      fmt(x.n),
      yen(x.amt),
      yen(x.carry ?? 0),
      yen(perPerson(x)),
      ...r.open ? Array(5).fill(collecting) : [
        fmt(x.paid_n),
        yen(x.paid),
        number(x.n) !== null && number(x.paid_n) !== null ? fmt((x.n as number) - (x.paid_n as number)) : "-",
        yen(profit(r).unpaid),
        pct(x.paid, x.amt)
      ]
    ];
  });
  const methodRows: ReactNode[][] = bm.flatMap(r => methods.map(m => {
    const x = object(r[m]); return [
      label(r),
      m,
      fmt(x.n),
      yen(x.amt),
      yen(x.carry ?? 0),
      yen(perPerson(x)),
      ...r.open ? Array(5).fill(collecting) : [
        fmt(x.paid_n),
        yen(x.paid),
        fmt(number(x.n) !== null && number(x.paid_n) !== null ? (x.n as number) - (x.paid_n as number) : null),
        yen(number(x.amt) !== null && number(x.paid) !== null ? (x.amt as number) - (x.paid as number) : null),
        pct(x.paid, x.amt)
      ]
    ];
  }));
  const costRows: ReactNode[][] = [...costs, ...(closedCosts.length ? [costTotal] : [])].map((r, i) => {
    const p = profit(r), c = object(r.cost); return [
      r === costTotal ? "締め済みの月の合計" : label(r),
      yen(p.billed),
      yen(p.carry),
      yen(p.sales),
      yen(c.ntt),
      r !== costTotal && missingCost(costs, i, "isp") ? "未取り込み？" : yen(c.isp),
      yen(p.cost),
      yen(p.gross),
      pct(p.gross, p.sales),
      ...r.open ? Array(7).fill(collecting) : [
        r !== costTotal && missingCost(costs, i, "fee") ? "未取り込み？" : yen(c.fee),
        yen(c.out),
        yen(p.op),
        pct(p.op, p.sales),
        yen(p.opPaid),
        yen(p.paid),
        yen(p.unpaid)
      ]
    ];
  });
  const agingRows: ReactNode[][] = rows(object(b.aging).by_month).map(r => [
    text(r.bm) + (bm.some(m => m.bm === r.bm && m.open) ? "・集計中" : ""), fmt(r.n), yen(r.amt)
  ]);
  const customerRows: ReactNode[][] = rows(object(b.aging).long).map(r => [
    record(r),
    text(r.status) || "-",
    text(r.meth),
    text(r.start),
    text(r.last),
    fmt(r.n),
    yen(r.amt),
    yen(r.billed)
  ]);
  const checkRows: ReactNode[][] = rows(d.checks).map(r => [
    record(r), text(r.kind), text(r.opened) || "-", text(r.status) || "-", text(r.detail) || text(r.message) || "-"
  ]);

  return <div className={styles.report}>
    <UpdatedStamp

      label="後道さんの"

      labelSuffix="更新"

      date={updatedDate(d.updated)}

      emptyText={text(d.updated) || "未取得"}

      busy={busy}

      refreshLabel="Ichi光事業の最新を読み直す"

      onRefresh={() => start(async () => {
        try {
          setResult(await refreshIchiReport());

          router.refresh();
        }
        catch {
          setResult(current => ({
            ...current, warning: true
          }));
        }
      })} />

    {result.warning && <p role="alert">最新を読めませんでした
      {snapshot ? `（前回 ${snapshot.updated || snapshot.fetched_at} の内容）` : "。時間をおいてもう一度お試しください。"}</p>}

    {snapshot && <>
      <section>
        <h2>ユーザー・獲得</h2>
        <Tiles
          data={[
            ["現在のユーザー数", fmt(months.at(-1)?.users)],
            ["開通待ち（受注済み）", fmt(d.pending)],
            [`${text(lastFull?.m)}の受注`, fmt(lastFull?.order)],
            [`${text(lastFull?.m)}の開通`, fmt(lastFull?.open)]
          ]} />

        <div className={styles.charts}>
          <IchiChart

            title="ユーザー数の推移"

            labels={months.map(r => text(r.m))}
            series={[{
              label: "ユーザー数", values: months.map(r => number(r.users))
            }]} />
          <IchiChart

            title="獲得の推移（受注・開通・解約）"

            labels={months.map(r => text(r.m))} series={[
              {
                label: "受注", values: months.map(r => number(r.order))
              },
              {
                label: "開通", values: months.map(r => number(r.open))
              },
              {
                label: "解約", values: months.map(r => number(r.churn))
              }
            ]} />
        </div>
        <Table

          title="月ごとの獲得・開通・解約"
          heads={[
            "月",
            "受注",
            "キャンセル",
            "キャンセル①",
            "キャンセル②",
            "キャンセル③",
            "開通済み",
            "未開通（残り）",
            "開通",
            "解約", "ユーザー数"
          ]}

          data={acquisitionRows} />
      </section>
      <section>
        <h2>請求・入金</h2>
        <Tiles
          data={[
            [`${text(latest?.um)}利用の請求金額`, yen(t.amt)],
            ["1人あたりの請求額（その月の分）", yen(perPerson(t))],
            ["入金率（締め済み）", pct(object(closed?.["合計"]).paid, object(closed?.["合計"]).amt)],
            ["未納金額（締め済み）", yen(profit(closed ?? {}).unpaid)]
          ]} />

        <div className={styles.charts}>
          <IchiChart

            title="請求金額の推移"

            labels={bm.map(label)}

            series={methods.map(m => ({
              label: m, values: bm.map(r => number(object(r[m]).amt))
            }))}
            stacked />
          <IchiChart

            title="入金率の推移"

            labels={bm.map(label)}

            series={["合計", ...methods].map(m => ({
              label: m, values: bm.map(r => r.open ? null : ratio(object(r[m]).paid, object(r[m]).amt))
            }))} line />
        </div>
        <Table

          title="請求・入金の推移"
          heads={[
            "請求月（利用月）",
            "請求件数",
            "請求金額",
            "うち前月未納の上乗せ",
            "1人あたり（その月の分）",
            "入金件数",
            "入金金額",
            "未納件数",
            "未納金額", "入金率"
          ]}

          data={billingRows} />
        <Table

          title="請求方法別"
          heads={[
            "請求月（利用月）",
            "請求方法",
            "請求件数",
            "請求金額",
            "前月未納の上乗せ",
            "1人あたり（その月の分）",
            "入金件数",
            "入金金額",
            "未納件数",
            "未納金額", "入金率"
          ]}

          data={methodRows} />

        <p>請求金額は前月未納の再請求を含みます。1人あたりは上乗せを除いたその月の分です。</p>
      </section>
      <section>
        <h2>原価・利益</h2>
        <Tiles
          data={[
            ["粗利", yen(p.gross)], ["粗利率", pct(p.gross, p.sales)], ["1人あたりの粗利", number(object(lastCost?.["合計"]).n) ? yen(p.gross === null ? null : p.gross / (object(lastCost?.["合計"]).n as number)) : "-"]
          ]} />

        <div className={styles.charts}>
          <IchiChart

            title="請求金額の内訳"

            labels={costs.map(label)} stacked
            series={[
              {
                label: "営業利益", values: costs.map(r => profit(r).op === null ? null : Math.max(0, profit(r).op!))
              },
              {
                label: "NTT原価", values: costs.map(r => number(object(r.cost).ntt))
              },
              {
                label: "ISP原価", values: costs.map(r => number(object(r.cost).isp))
              },
              {
                label: "決済・委託費用", values: costs.map(r => r.open ? null : profit(r).exp)
              },
            ]} />
          <IchiChart

            title="利益率の推移"

            labels={costs.map(label)} line
            series={[
              {
                label: "粗利率", values: costs.map(r => ratio(profit(r).gross, profit(r).sales))
              },
              {
                label: "営業利益率", values: costs.map(r => r.open ? null : ratio(profit(r).op, profit(r).sales))
              },
              {
                label: "営業利益率（入金ベース）", values: costs.map(r => r.open ? null : ratio(profit(r).opPaid, profit(r).paid))
              },
            ]} />
        </div>
        <Table

          title="月ごとの請求・原価・粗利・営業利益"
          heads={[
            "請求月（利用月）",
            "請求金額",
            "前月未納の上乗せ",
            "その月の売上",
            "NTT原価",
            "ISP原価",
            "原価合計",
            "粗利",
            "粗利率",
            "決済手数料",
            "委託費用",
            "営業利益",
            "営業利益率",
            "営業利益（入金ベース）",
            "入金金額",
            "未納（翌月再請求）"
          ]}

          data={costRows} />

        {rows(b.cost_notes).map((v, i) => <p key={i}>
          {text(v.text)}</p>)}

        {Array.isArray(b.cost_notes) && b.cost_notes.filter(v => typeof v === "string").map((v, i) => <p key={i}>
          {v}</p>)}

        {text(b.cost_error) && <p role="alert">
          {text(b.cost_error)}</p>}
      </section>
      <section>
        <h2>要確認リスト</h2>
        <Table

          title="いま残っている未納（請求月ごと）"
          heads={[
            "請求月", "件数", "金額"
          ]}

          data={agingRows} />
        <Table

          title="未納が2回以上続いているお客様"
          heads={[
            "レコード番号",
            "状態",
            "支払い方法",
            "最初の未納月",
            "最後の未納月",
            "未納回数",
            "未納金額", "請求金額"
          ]}

          data={customerRows} />
        <Table

          title="確認が必要な内容"
          heads={[
            "レコード番号", "種類", "開通日", "商材ステータス", "確認してほしいこと"
          ]}

          data={checkRows} />

        {warnings.map((r, i) => <p key={i}>
          {text(r.message) || text(r.detail)}</p>)}

        {Array.isArray(d.warnings) && d.warnings.filter(v => typeof v === "string").map((v, i) => <p key={i}>
          {v}</p>)}
      </section>
    </>}
  </div>;
}
