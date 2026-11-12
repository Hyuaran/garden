import { pointFor, type PointRow } from "@/lib/product-points";
import { extractPointOrder } from "@/app/system/_lib/call-report-v3";
import { fieldValue, type KanriSourceRow } from "./kanri-core";
import type { KanriPointMaster } from "./calc/kanri-sheet";
export function soilPointMasters(rows: PointRow[]): KanriPointMaster[] {
    const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order || a.product.localeCompare(b.product));
    return [...new Set(sorted.map(r => r.product))].map(product => {
        const soilRows = sorted.filter(r => r.product === product);
        const r = soilRows.find(r => r.channel === "hakuchi") ?? soilRows[0];
        return { product, category: { kaisen: "光回線", credit: "クレカ", denki: "電気" }[r.category], kintone_names: r.kintone_names, coefficient: r.total_points, unit_price: r.unit_price, sort_order: r.sort_order, soilRows };
    });
}
export function kanriOrders(rows: KanriSourceRow[], month: string) {
    return rows.flatMap(source => {
        if (!["kintone_customer", "credit_card"].includes(source.source))
            return [];
        const credit = source.source === "credit_card";
        const text = (key: string) => String(fieldValue(source.payload, key) ?? "").trim();
        const date = credit ? text("日付_4") || text("紹介日") : text("実績日");
        if (!date.startsWith(month + "-"))
            return [];
        const orderDate = credit ? date : text("受注日") || date;
        const order = extractPointOrder(source.payload, orderDate, credit);
        if (!order) return [];
        const unknownBusiness = order.channel === null
            ? text("事業名") || (credit ? text("文字列__1行__14") : "") || "事業名なし"
            : null;
        return [{
            source,
            date,
            order: { ...order, channel: order.channel ?? "hakuchi" as const },
            unknownBusiness,
            team: credit ? text("文字列__1行__26") || text("チーム名") : text("チーム名"),
        }];
    });
}
export function unknownKanriChannels(rows: KanriSourceRow[], month: string) {
    const counts = new Map<string, number>();
    for (const { unknownBusiness } of kanriOrders(rows, month)) {
        if (unknownBusiness !== null) {
            counts.set(unknownBusiness, (counts.get(unknownBusiness) ?? 0) + 1);
        }
    }
    return [...counts].map(([business, count]) => ({
        code: "point_channel_unknown" as const,
        message: `獲得方法が分からない受注（白地で数えた）：${business === "事業名なし" ? business : `事業名${business}`} ${count}件`,
    }));
}
export function matchedKanriOrders(rows: KanriSourceRow[], points: KanriPointMaster[], month: string) {
    const table = points.flatMap(p => p.soilRows ?? []);
    return kanriOrders(rows, month).flatMap(item => {
        const find = (order: typeof item.order) => pointFor(table, order) ?? (order.masterProduct ? pointFor(table, { ...order, productName: order.masterProduct }) : null);
        // 受注日の時点で表に行が無い（例：受注日 10/30・実績日 11/2。付与ポイント表は 2026-11-01 から）ときは実績日の時点の行で当てる
        const point = find(item.order) ?? find({ ...item.order, orderDate: item.date });
        return point ? [{ ...item, point }] : [];
    });
}
export function missingKanriProducts(rows: KanriSourceRow[], points: KanriPointMaster[], month: string) {
    if (month < "2026-11")
        return [];
    const matched = new Set(matchedKanriOrders(rows, points, month).map(i => i.source));
    const missing = new Map<string, number>();
    for (const item of kanriOrders(rows, month))
        if (!matched.has(item.source))
            missing.set(item.order.productName, (missing.get(item.order.productName) ?? 0) + 1);
    return [...missing].map(([product, count]) => ({ code: "point_product_missing" as const, message: `ポイント表に無い商材：${product} ${count}件` }));
}
