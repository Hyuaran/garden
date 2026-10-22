// 画面（ブラウザ）からも使うので、exceljs や node:fs を読み込む agent-details.ts とは分けておく
// 支払明細の名前と、月次報告の Excel・現場の呼び名が違う人（東海林さん 2026-10-21：後道健一さん＝瀧さん）
export const AGENT_ALIASES: Record<string, string> = { "後道健一": "瀧さん（後道健一）" };
export const agentName = (name: string) => { const base = name.replace(/様/g, "").replace(/株式会社/g, "").trim(); return AGENT_ALIASES[base] ?? base; };
